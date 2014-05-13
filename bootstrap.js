"use strict"

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/Services.jsm");

let UrlAddonBar = {
    _windowtype: "navigator:browser",

    get _windows() {
        var wins = [];
        this._windowtype || (this._windowtype = "navigator:browser");
        var cw = Services.wm.getEnumerator(this._windowtype);
        while (cw.hasMoreElements()) {
            let win = cw.getNext();
            win.QueryInterface(Ci.nsIDOMWindow);
            wins.push(win);
        }
        return wins;
    },

    handleEvent: function (e) {
        var doc = e.target;
        var win = doc.defaultView;
        win.removeEventListener("load", this, true);
        if (doc.documentElement.getAttribute("windowtype") !=
            this._windowtype) return;
        this.loadScript(win);
    },

    loadStyle: function () {
        var sss = Cc["@mozilla.org/content/style-sheet-service;1"]
                     .getService(Ci.nsIStyleSheetService);
        var uri = Services.io.newURI("resource://urladdonbar/skin/overlay.css",
                                     null, null);
        sss.sheetRegistered(uri, sss.USER_SHEET)
            || sss.loadAndRegisterSheet(uri, sss.USER_SHEET);
    },
    unloadStyle: function () {
        var sss = Cc["@mozilla.org/content/style-sheet-service;1"]
                     .getService(Ci.nsIStyleSheetService);
        var uri = Services.io.newURI("resource://urladdonbar/skin/overlay.css",
                                     null, null);
        sss.sheetRegistered(uri, sss.USER_SHEET)
            && sss.unregisterSheet(uri, sss.USER_SHEET);
    },
    
    loadScript: function (win) {
        Services.scriptloader.loadSubScript(
            "resource://urladdonbar/content/overlay.js",
            win,
            "UTF-8"
        );
        "UrlAddonBar" in win && typeof win.UrlAddonBar.init === "function"
            && win.UrlAddonBar.init();
    },
    unloadScript: function (win) {
        "UrlAddonBar" in win && typeof win.UrlAddonBar.uninit === "function" 
            && win.UrlAddonBar.uninit();
        delete win.UrlAddonBar;
    },

    onOpenWindow: function (aWindow) {
        var win = aWindow.docShell.QueryInterface(Ci
            .nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindow);
        win.addEventListener("load", this, true);
    },
    onCloseWindow: function (aWindow) {},
    onWindowTitleChange: function (aWindow, aTitle) {},

    init: function () {
        this.loadStyle();
        this.loadDefaultPreferences();
        this._wm = Services.wm;
        this._wm.addListener(this);
        this._windows.forEach(function (win) {
            this.loadScript(win);
        }, this);
    },
    uninit: function () {
        this.unloadStyle();
        if (this._wm) this._wm.removeListener(this);
        delete this._wm;
        this._windows.forEach(function (win) {
            this.unloadScript(win);
        }, this);
    },

    loadDefaultPreferences: function () {
        var _ = {
            method: function (type) {
                return ({
                    "string": "setCharPref",
                    "number": "setIntPref",
                    "boolean": "setBoolPref"
                }[type]);
            },
            pref: function (name, value) {
                try {
                    let branch = Services.prefs.getDefaultBranch(null);
                    branch[this.method(typeof value)](name, value);
                } catch (ex) {
                    dump(ex);
                }
            }
        };
        const PREF = "resource://urladdonbar/defaults/preferences/options.js";
        try {
            Services.scriptloader.loadSubScript(PREF, _, "UTF-8");
        } catch (ex) {
            dump(ex);
        }
    }

}

let ResourceAlias = {
    register: function (alias, data) {
        var ios = Services.io;
        if (!alias) return false;
        this._alias = alias;
        if (this._resProtocolHandler) return false;
        this._resProtocolHandler = ios.getProtocolHandler("resource");
        this._resProtocolHandler.QueryInterface(Ci.nsIResProtocolHandler);
        var uri = data.resourceURI;
        if (!uri) { // packed
            if (data.installPath.isDirectory()) {
                uri = ios.newFileURI(data.installPath);
            } else { // unpacked
                let jarProtocolHandler = ios.getProtocolHandler("jar");
                jarProtocolHandler.QueryInterface(Ci.nsIJARProtocolHandler);
                let spec = "jar:" + ios.newFileURI(data.installPath).spec + "!/";
                uri = jarProtocolHandler.newURI(spec, null, null);
            }
        }
        this._resProtocolHandler.setSubstitution(alias, uri);
        return true;
    },
    unregister: function () {
        if (!this._resProtocolHandler) return false;
        this._resProtocolHandler.setSubstitution(this._alias, null);
        delete this._resProtocolHandler;
        delete this._alias;
        return true;
    }
}

// 启用
function startup(data, reason) {
    const alias = "urladdonbar";
    ResourceAlias.register(alias, data);
    UrlAddonBar.init();
}

// 禁用或应用程序退出
function shutdown(data, reason) {
    ResourceAlias.unregister();
    UrlAddonBar.uninit();
}

// 安装
function install(data, reason) {
}

// 卸载
function uninstall(data, reason) {
}
