"use strict"

const { console } = Components.utils.import("resource://gre/modules/devtools/Console.jsm", {});
const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/Services.jsm");

var AddonLoader = {

    get _windows() {
        let wins = [];
        let cw = Services.wm.getEnumerator(this._windowtype);
        while (cw.hasMoreElements()) {
            let win = cw.getNext();
            win.QueryInterface(Ci.nsIDOMWindow);
            wins.push(win);
        }
        return wins;
    },

    // - nsIEventListener Interface

    handleEvent: function (e) {
        let doc = e.target;
        let win = doc.defaultView;
        win.removeEventListener("load", this, true);
        if (doc.documentElement.getAttribute("windowtype") == this._windowtype)
            this.loadScript(win);
    },

    // - nsIWindowMediatorListener Interface

    onOpenWindow: function (aWindow) {
        let win = aWindow.docShell.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindow);
        win.addEventListener("load", this, true);
    },
    onCloseWindow: function (aWindow) {},
    onWindowTitleChange: function (aWindow, aTitle) {},

    // - Entry Points
    
    init: function (alias, windowtype, styles, scripts, prefs) {
        if (!alias || !windowtype) return false;

        this._alias = alias;
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
    uninit: function () 
        for (let style of this._styles)
            this.unloadStyle(style);

        Services.wm.removeListener(this);
        for (let win of this._windows)
            for (let script of this._scripts)
                this.unloadScript(win, script);

        delete this._alias;
        delete this._windowtype;
        delete this._styles;
        delete this._scripts;
    },

    // - internal

    loadStyle: function (style) {
        let sss = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);
        let uri = Services.io.newURI("chrome://"+this._alias+"/skin/common/"+style, null, null);
        sss.sheetRegistered(uri, sss.USER_SHEET) || sss.loadAndRegisterSheet(uri, sss.USER_SHEET);
    },
    unloadStyle: function (style) {
        let sss = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);
        let uri = Services.io.newURI("chrome://"+this._alias+"/skin/common/"+style, null, null);
        sss.sheetRegistered(uri, sss.USER_SHEET) && sss.unregisterSheet(uri, sss.USER_SHEET);
    },
    
    loadScript: function (win, script) {
        Services.scriptloader.loadSubScript("chrome://"+this._alias+"/content/"+script, win, "UTF-8");
        "AddonBars" in win && typeof win.AddonBars.init === "function" && win.AddonBars.init();
    },
    unloadScript: function (win, script) {
        "AddonBars" in win && typeof win.AddonBars.uninit === "function" && win.AddonBars.uninit();
        delete win.AddonBars;
    },

    loadDefaultPreferences: function (script) {
        try {
            Services.scriptloader.loadSubScript("chrome://"+this._alias+"/content/"+script, {
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
}

// - Entry Points

function startup(data, reason) {
    AddonLoader.init("awesomebars", "navigator:browser", ["overlay.css"], ["overlay.js"], ["defaultPrefs.js"]);
}

function shutdown(data, reason) {
    AddonLoader.uninit();
}

function install(data, reason) {
}

function uninstall(data, reason) {
}
