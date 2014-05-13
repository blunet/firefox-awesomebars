"use strict"

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/Services.jsm");

var UrlAddonBar = {
    _windowtype: "navigator:browser",

    get _windows() {
        let wins = [];
        this._windowtype || (this._windowtype = "navigator:browser");
        let cw = Services.wm.getEnumerator(this._windowtype);
        while (cw.hasMoreElements()) {
            let win = cw.getNext();
            win.QueryInterface(Ci.nsIDOMWindow);
            wins.push(win);
        }
        return wins;
    },

    handleEvent: function (e) {
        let doc = e.target;
        let win = doc.defaultView;
        win.removeEventListener("load", this, true);
        if (doc.documentElement.getAttribute("windowtype") !=
            this._windowtype) return;
        this.loadScript(win);
    },

    loadStyle: function () {
        let sss = Cc["@mozilla.org/content/style-sheet-service;1"]
                     .getService(Ci.nsIStyleSheetService);
        let uri = Services.io.newURI("resource://urladdonbar/skin/overlay.css",
                                     null, null);
        sss.sheetRegistered(uri, sss.USER_SHEET)
            || sss.loadAndRegisterSheet(uri, sss.USER_SHEET);
    },
    unloadStyle: function () {
        let sss = Cc["@mozilla.org/content/style-sheet-service;1"]
                     .getService(Ci.nsIStyleSheetService);
        let uri = Services.io.newURI("resource://urladdonbar/skin/overlay.css",
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
        let win = aWindow.docShell.QueryInterface(Ci
            .nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindow);
        win.addEventListener("load", this, true);
    },
    onCloseWindow: function (aWindow) {},
    onWindowTitleChange: function (aWindow, aTitle) {},

    init: function () {
        this.loadStyle();
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

}

let ResourceAlias = {
    register: function (alias, data) {
        let ios = Services.io;
        if (!alias) return false;
        this._alias = alias;
        if (this._resProtocolHandler) return false;
        this._resProtocolHandler = ios.getProtocolHandler("resource");
        this._resProtocolHandler.QueryInterface(Ci.nsIResProtocolHandler);
        let uri = data.resourceURI;
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
