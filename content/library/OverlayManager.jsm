/*
 * This Source Code is subject to the terms of the Mozilla Public License, v. 2.0.
 * A copy of the MPL can be obtained at http://mozilla.org/MPL/2.0/.
 */
"use strict"

const EXPORTED_SYMBOLS = ["OverlayManager"];

// imports
this.console = Components.utils.import("resource://gre/modules/devtools/Console.jsm", {}).console;
this.Services = Components.utils.import("resource://gre/modules/Services.jsm", {}).Services;

const {classes: Cc, interfaces: Ci, utils: Cu, Exception: Ce} = Components;

// TODO move this to mozilla.jsm
function createSandbox(principal, scriptUrl, prototype) {

  let sandbox = Components.utils.Sandbox(principal, {
    sandboxName: scriptUrl,
    sandboxPrototype: prototype || {}
  });

  try {
    Components.utils.evalInSandbox("Components.classes['@mozilla.org/moz/jssubscript-loader;1']" +
                                   ".createInstance(Components.interfaces.mozIJSSubScriptLoader)" +
                                   ".loadSubScript('" + scriptUrl + "',this,'UTF-8');", sandbox, "ECMAv5");
  }
  catch (e) {
    console.warn("Exception loading script " + scriptUrl, e);
  }
  return sandbox;
}

// public interface
const OverlayManager = {
  addOverlays: function(overlayMap) {
    OverlayManagerInternal.addOverlays(overlayMap);
  },

  addComponent: function(cId, componentUrl, contract) {
    OverlayManagerInternal.addComponent(cId, componentUrl, contract);
  },

  addCategory: function(category, entry, value) {
    OverlayManagerInternal.addCategory(category, entry, value);
  },

  addPreference: function(name, value) {
    OverlayManagerInternal.addPreference(name, value);
  },

  getScriptContext: function(window, scriptUrl) {
    return OverlayManagerInternal.getScriptContext(window, scriptUrl);
  },

  unload: function() {
    OverlayManagerInternal.unload();
  }
};

// private implementation
const OverlayManagerInternal = {
  windowEntryMap: new WeakMap(), // do not prevent keys (window objects) from being garbage collected
  windowEntries: {},
  overlays: {}, // track overlays per windowUrl
  components: [],
  categories: [],
  contracts: [],
  preferences: [],

  init: function() {
    console.info("init()");
    Services.wm.addListener(this);
  },

  unload: function() {
    console.info("unload() ",this.windowEntries);

    try {
      Services.wm.removeListener(this);

      // unload window entries
      for (let windowUrl in this.windowEntries)
        for (let windowEntry of this.windowEntries[windowUrl])
          this.destroyWindowEntry(windowEntry);

      // unload categories
      let cm = Cc["@mozilla.org/categorymanager;1"].getService(Ci.nsICategoryManager);
      for (let [category, entry, oldValue] of this.categories)
        if (oldValue)
          cm.addCategoryEntry(category, entry, oldValue, false, true);
        else
          cm.deleteCategoryEntry(category, entry, false);

      // unload components & contracts
      let cr = Components.manager.QueryInterface(Ci.nsIComponentRegistrar);
      for (let cId of this.components)
        cr.unregisterFactory(cId, cr.getClassObject(cId, Ci.nsIFactory));
      // Restore an overridden contract ID 
      for (let [contract, cId] of this.contracts)
        cr.registerFactory(cId, null, contract, null);

      // unload preferences
      for (let [name, type, value] of this.preferences)
        if (value === null)
          Services.prefs.clearUserPref(name);
        else
          // Restore an overridden pref
          Services.prefs["set" + type](name, value);
    }
    catch (e) {
      console.error("Exception during unload", e);
    }
  },

  createWindowEntry: function(domWindow, overlays) {
    console.info("createWindowEntry(",domWindow,overlays,")");

    domWindow.addEventListener("unload", this, false);

    let newEntry = {window: domWindow, scripts: {}, nodes: []};
    let windowUrl = domWindow.location.toString();

    if (this.windowEntryMap.has(domWindow))
      throw new Ce("Already registered window entry for " + windowUrl);
    this.windowEntryMap.set(domWindow, newEntry);

    if (!(windowUrl in this.windowEntries))
      this.windowEntries[windowUrl] = [];
    this.windowEntries[windowUrl].push(newEntry);

    this.applyWindowEntryOverlays(newEntry, overlays);
    return newEntry;
  },

  destroyWindowEntry: function(windowEntry) {
    console.info("destroyWindowEntry(",windowEntry,")");

    windowEntry.window.removeEventListener("unload", this, false);

    // unloadScriptOverlays
    for (let [,sandbox] in Iterator(windowEntry.scripts)) {
      try {
        if ("OverlayListener" in sandbox && "unload" in sandbox.OverlayListener)
          sandbox.OverlayListener.unload();
      }
      catch (e) {
        console.error("Exception calling script unload listener", e);
      }
      Components.utils.nukeSandbox(sandbox);
    }

    // unloadDocumentAndStyleOverlays
    for (let node of windowEntry.nodes)
      node.parentNode.removeChild(node);

    // remove windowEntry
    this.windowEntryMap.delete(windowEntry.window);

    // TODO in theory we shouldn't leak. do we ?
  },

  applyWindowEntryOverlays: function(windowEntry, overlays) {
    console.info("applyWindowEntryOverlays(",windowEntry,overlays,")");

    if ("documents" in overlays)
      for (let documentUrl of overlays.documents)
        this.loadDocumentOverlay(windowEntry, documentUrl);

    if ("styles" in overlays)
      for (let styleUrl of overlays.styles)
        this.loadStyleOverlay(windowEntry, styleUrl);

    if ("scripts" in overlays)
      for (let scriptUrl of overlays.scripts)
        this.loadScriptOverlay(windowEntry, scriptUrl);
  },

  loadDocumentOverlay: function(windowEntry, documentUrl) {
    console.info("loadDocumentOverlay(",windowEntry,documentUrl,")");

    // TODO make this async (beware or overlay-scripts may execute before!)
    let xhr = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);
    xhr.open("GET", documentUrl, false);
    xhr.send();

    let overlayDoc = xhr.responseXML;
    if (overlayDoc.documentElement.namespaceURI == "http://www.mozilla.org/newlayout/xml/parsererror.xml")
      return;

    let targetDoc = windowEntry.window.document;

    function walkDocumentNodes(document) {
      let node = document.documentElement;

      while (node) {
        let currentNode = node;

        if (node.firstChild)
          // If possible to descend then do so
          node = node.firstChild;
        else {
          // Otherwise find the next node in the document by walking up the tree
          // until there is a nextSibling (or we hit the documentElement)
          while (!node.nextSibling && node.parentNode != overlayDoc.documentElement)
            node = node.parentNode;

          node = node.nextSibling; // or null if we hit the top
        }

        yield currentNode;
      }
    }

    function elementChildren(element) {
      let node = element.firstChild;
      while (node) {
        let currentNode = node;

        node = node.nextSibling;

        if (currentNode instanceof Ci.nsIDOMElement)
          yield currentNode;
      }
    }

    // Remove all empty text nodes from overlay
    for (let node in walkDocumentNodes(overlayDoc))
      if (node.nodeType == Ci.nsIDOMNode.TEXT_NODE && node.nodeValue.trim() == "")
        node.parentNode.removeChild(node);

    for (let containerElement in elementChildren(overlayDoc.documentElement)) {
      if (!containerElement.id)
        continue;

      let targetElement = targetDoc.getElementById(containerElement.id);
      if (!targetElement || targetElement.localName != containerElement.localName)
        continue;

      // TODO apply attributes to the target element

      for (let newElement in elementChildren(containerElement)) {
        let insertBefore = null;

        if (newElement.hasAttribute("insertbefore")) {
          insertBefore = targetDoc.getElementById(newElement.getAttribute("insertbefore"));
          if (insertBefore && insertBefore.parentNode != targetElement)
            insertBefore = null;
        }

        if (!insertBefore && newElement.hasAttribute("insertafter")) {
          insertBefore = targetDoc.getElementById(newElement.getAttribute("insertafter"));
          if (insertBefore) {
            if (insertBefore.parentNode != targetElement)
              insertBefore = null
            else
              insertBefore = insertBefore.nextSibling;
          }
        }

        // TODO can not insert after last chlid...
        targetElement.insertBefore(newElement, insertBefore);
        windowEntry.nodes.push(newElement);
      }
    }
  },

  loadStyleOverlay: function(windowEntry, styleUrl) {
    console.info("loadStyleOverlay(",windowEntry,styleUrl,")");

    let doc = windowEntry.window.document;
    let styleNode = doc.createProcessingInstruction("xml-stylesheet", "href=\"" + styleUrl + "\" type=\"text/css\"");
    doc.insertBefore(styleNode, doc.documentElement);

    windowEntry.nodes.push(styleNode);
  },

  loadScriptOverlay: function(windowEntry, scriptUrl) {
    console.info("loadScriptOverlay(",windowEntry,scriptUrl,")");

    let sandbox = createSandbox(windowEntry.window, scriptUrl, windowEntry.window);
    windowEntry.scripts[scriptUrl] = sandbox;

    if ("OverlayListener" in sandbox && "load" in sandbox.OverlayListener) {
      try {
        sandbox.OverlayListener.load();
      }
      catch (e) {
        console.warn("Exception calling script load event " + scriptUrl, e);
      }
    }
  },

  addOverlays: function(overlayMap) {
    console.info("addOverlays(",overlayMap,")");

    try {
      for (let windowUrl in overlayMap) {
        let overlays = overlayMap[windowUrl];

        // Add new overlays into known overlays
        if (!(windowUrl in this.overlays))
          this.overlays[windowUrl] = {};

        for (let type of ["documents", "styles", "scripts"])
          if (type in overlays) {
            if (!(type in this.overlays[windowUrl]))
              this.overlays[windowUrl][type] = overlays[type].slice(0);
            else
              this.overlays[windowUrl][type].push(overlays[type]);
          }

        // Apply new overlays to any already tracked windows
        if (windowUrl in this.windowEntries)
          for(let windowEntry in this.windowEntries[windowUrl])
            this.applyWindowEntryOverlays(windowEntry, overlays);
      }

      // Search over existing windows, add new overlays & track as needed
      let windows = Services.wm.getEnumerator(null);
      while (windows.hasMoreElements()) {
        let domWindow = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
        let windowUrl = domWindow.location.toString();

        if ((windowUrl in overlayMap) && !this.windowEntryMap.has(domWindow))
          this.createWindowEntry(domWindow, overlayMap[windowUrl]);
      }
    }
    catch (e) {
      console.error("Exception adding overlay list", e);
    }
  },

  addComponent: function(cId, componentUrl, contract) {
    let cr = Components.manager.QueryInterface(Ci.nsIComponentRegistrar);
    if (contract)
      try {
        // It's possible to have a contract to CID mapping when the CID doesn't exist
        let ccid = cr.contractIDToCID(contract);
        if (cr.isCIDRegistered(ccid))
          // Allows reverting an overridden contract ID 
          this.contracts.push([contract, ccid]);
      }
      catch (e) { }

    cId = Components.ID(cId);
    cr.registerFactory(cId, null, contract, {
      _sandbox: null,

      createInstance: function(outer, iId) {
        try {
          if (!this._sandbox) {
            let principal = Cc["@mozilla.org/systemprincipal;1"].createInstance(Ci.nsIPrincipal);
            this._sandbox = createSandbox(principal, componentUrl);
          }
          return this._sandbox.NSGetFactory(cId).createInstance(outer, iId);
        }
        catch (e) {
          console.error("Exception initialising component",contract,"from",componentUrl,e);
          throw e;
        }
      }
    });
    this.components.push(cId);
  },

  addCategory: function(category, entry, value) {
    let cm = Cc["@mozilla.org/categorymanager;1"].getService(Ci.nsICategoryManager);
    let oldValue = null;
    try {
      oldValue = cm.getCategoryEntry(category, entry);
    }
    catch (e) { }
    cm.addCategoryEntry(category, entry, value, false, true);
    this.categories.push([category, entry, oldValue]);
  },

  // TODO we need defaultPrefs!
  
  // Allows overriding preferences of app & other extensions
  addPreference: function(name, value) {
    let oldValue = null;
    let type = typeof value;
    type = (type == "number") ? "IntPref" : (type == "boolean") ? "BoolPref" : "CharPref";

    if (Services.prefs.getPrefType(name) != Ci.nsIPrefBranch.PREF_INVALID)
      oldValue = Services.prefs["get" + type](name);

    Services.prefs["set" + type](name, value);
    this.preferences.push([name, type, oldValue]);
  },

  getScriptContext: function(domWindow, scriptUrl) {
    let windowEntry = this.windowEntryMap.get(domWindow);
    if (windowEntry && scriptUrl in windowEntry.scripts)
      return windowEntry.scripts[scriptUrl];
    return null;
  },

  // - nsIEventListener implementation

  handleEvent: function(event) {
    try {
      let domWindow = event.currentTarget;
      let windowUrl = domWindow.location.toString();

      if (event.type === "load") {
        domWindow.removeEventListener("load", this, false);

        // NOTE removed deferred loading (see 2ea67167116d145dbe982dc0ea71a2be25d48a5c)
        if (windowUrl in this.overlays)
          this.createWindowEntry(domWindow, this.overlays[windowUrl]);
      }
      else if (event.type === "unload") {
        let windowEntry = this.windowEntryMap.get(domWindow);
        this.destroyWindowEntry(windowEntry);

        let entries = this.windowEntries[windowUrl];
        entries.splice(entries.indexOf(windowEntry), 1);
      }
    }
    catch (e) {
      console.error("Error during window ", event.type, e);
    }
  },

  // - nsIWindowMediatorListener implementation

  onOpenWindow: function(xulWindow) {
    xulWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindow).addEventListener("load", this, false);
  },
  onWindowTitleChange: function() { },
  onCloseWindow: function() { },
};

OverlayManagerInternal.init();
