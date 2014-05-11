"use strict"

const EXPORTED_SYMBOLS = ["AddonManager"];

Components.utils.import("resource://gre/modules/devtools/Console.jsm", this);
Components.utils.import("resource://gre/modules/Services.jsm", this);

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

// un-/load given js into each window of given type
// un-/load given css into *app context*
// load default preferences from given js
const AddonManager = {

    get _windows() { // dynamic as not to keep window references
        let wins = [];
        let cw = Services.wm.getEnumerator(this._windowtype);
        while (cw.hasMoreElements()) 
            wins.push(cw.getNext().QueryInterface(Ci.nsIDOMWindow));
        return wins;
    },

    // - nsIEventListener Interface

    handleEvent: function (e) {
        let win = e.target.defaultView;
        win.removeEventListener("load", this, true);
        if (e.target.documentElement.getAttribute("windowtype") == this._windowtype)
            this.loadScript(win);
    },

    // - nsIWindowMediatorListener Interface

    onOpenWindow: function (window) {
        let win = window.docShell.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindow);
        win.addEventListener("load", this, true);
    },
    onCloseWindow: function (window) {},
    onWindowTitleChange: function (window, title) {},

    // - Entry Points
    
    init: function (clazz, windowtype, styles, scripts, prefs) {
        if (!clazz || !windowtype) return false;

        this._clazz = clazz;
        this._windowtype = windowtype;
        this._styles = styles || [];
        this._scripts = scripts || [];

        for (let style of this._styles)
            this.loadStyle(style);

        for (let pref of prefs || [])
            this.loadDefaultPreferences(pref);

        Services.wm.addListener(this);
        for (let win of this._windows)
            for (let script of this._scripts)
                this.loadScript(win, script);
    },
    uninit: function () {
        for (let style of this._styles)
            this.unloadStyle(style);

        Services.wm.removeListener(this);
        for (let win of this._windows)
            for (let script of this._scripts)
                this.unloadScript(win, script);

        delete this._clazz;
        delete this._windowtype;
        delete this._styles;
        delete this._scripts;
    },

    // - internal

    loadStyle: function (style) {
        let sss = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);
        let uri = Services.io.newURI("chrome://"+this._clazz+"/skin/"+style, null, null);
        sss.sheetRegistered(uri, sss.USER_SHEET) || sss.loadAndRegisterSheet(uri, sss.USER_SHEET);
    },
    unloadStyle: function (style) {
        let sss = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);
        let uri = Services.io.newURI("chrome://"+this._clazz+"/skin/"+style, null, null);
        sss.sheetRegistered(uri, sss.USER_SHEET) && sss.unregisterSheet(uri, sss.USER_SHEET);
    },
    
    loadScript: function (win, script) {
        Services.scriptloader.loadSubScript("chrome://"+this._clazz+"/content/"+script, win, "UTF-8");
        this._clazz in win && typeof win[this._clazz].init === "function" && win[this._clazz].init();
    },
    unloadScript: function (win, script) {
        [this._clazz] in win && typeof win[this._clazz].uninit === "function" && win[this._clazz].uninit();
        delete win[this._clazz];
    },

    loadDefaultPreferences: function (script) {
        try {
            Services.scriptloader.loadSubScript("chrome://"+this._clazz+"/content/"+script, {
                method: function (type) {
                    return ({
                        "string": "setCharPref",
                        "number": "setIntPref",
                        "boolean": "setBoolPref"
                    }[type]);
                },
                pref: function (name, value) {
                    try {
                        Services.prefs.getDefaultBranch(null)[this.method(typeof value)](name, value);
                    } catch (ex) {
                        console.log(ex);
                    }
                }
            }, "UTF-8");
        } catch (ex) {
            console.log(ex);
        }
    }
};
