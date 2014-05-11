// un-/load given js into each window of given type
// un-/load given css into *app context*
// load default preferences from given js
"use strict"

const EXPORTED_SYMBOLS = ["AddonManager"];

// imports
this.log = Components.utils.import("resource://gre/modules/devtools/Console.jsm", {}).console;
this.Services = Components.utils.import("resource://gre/modules/Services.jsm", {}).Services;

// public interface
const AddonManager = {
    init: function (clazz, windowtype, styles, scripts, prefs) {
        AddonManagerInternal.init(clazz, windowtype, styles, scripts, prefs);
    },
    uninit: function () {
        AddonManagerInternal.uninit();
    }
};

// private implementatioion
const AddonManagerInternal = {

    init: function (clazz, windowtype, styles, scripts, prefs) {
        if (!clazz || !windowtype) return false;

        this._clazz = clazz;
        this._windowtype = windowtype;
        this._styles = styles || [];
        this._scripts = scripts || [];

        let sss = this.getStyleSheetService();
        for (let style of this._styles)
            this.loadStyle(sss, style);

        for (let pref of prefs || [])
            this.loadDefaultPreferences(pref);

        Services.wm.addListener(this);
        for (let win of this._windows)
            for (let script of this._scripts)
                this.loadScript(win, script);
    },
    uninit: function () {
        let sss = this.getStyleSheetService();
        for (let style of this._styles)
            this.unloadStyle(sss, style);

        Services.wm.removeListener(this);
        for (let win of this._windows)
            for (let script of this._scripts)
                this.unloadScript(win, script);

        delete this._clazz;
        delete this._windowtype;
        delete this._styles;
        delete this._scripts;
    },

    // - nsIEventListener Interface

    handleEvent: function (e) {
        let win = e.target.defaultView;
        win.removeEventListener("load", this, true);
        if (e.target.documentElement.getAttribute("windowtype") == this._windowtype)
            this.loadScript(win);
    },

    // - nsIWindowMediatorListener Interface

    onOpenWindow: function (xulWindow) {
        xulWindow.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                 .getInterface(Components.interfaces.nsIDOMWindow)
                 .addEventListener("load", this, true);
    },
    onCloseWindow: function (xulWindow) {},
    onWindowTitleChange: function (xulWindow, title) {},

    // - internal

    get _windows() { // dynamic as not to keep window references
        let wins = [];
        let cw = Services.wm.getEnumerator(this._windowtype);
        while (cw.hasMoreElements()) 
            wins.push(cw.getNext().QueryInterface(Components.interfaces.nsIDOMWindow));
        return wins;
    },

    getStyleSheetService: function() {
        return Components.classes["@mozilla.org/content/style-sheet-service;1"]
               .getService(Components.interfaces.nsIStyleSheetService);
    },

    loadStyle: function (sss, style) {
        let uri = Services.io.newURI("chrome://"+this._clazz+"/skin/"+style, null, null);
        sss.sheetRegistered(uri, sss.USER_SHEET) || sss.loadAndRegisterSheet(uri, sss.USER_SHEET);
    },
    unloadStyle: function (sss, style) {
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
                        log.error(ex);
                    }
                }
            }, "UTF-8");
        } catch (ex) {
            log.error(ex);
        }
    }
};
