const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

//Cu.import("resource://gre/modules/PopupNotifications.jsm");
Cu.import("resource://gre/modules/Services.jsm");

var UrlAddonBar = {
    //cs: Services.console,  // nsIConsoleService
    //ww: Services.ww,       // nsIWindowWatcher
    wm: Services.wm,       // nsIWindowMediator

    init: function (win) {
        var uabcsstext = (<><![CDATA[
@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);

#urlbar-icons > #addon-bar > .toolbarbutton-1 > .toolbarbutton-menubutton-dropmarker,
#urlbar-icons > #addon-bar > .toolbarbutton-1 > .toolbarbutton-menu-dropmarker,
#urlbar-icons #mproxy-toolbar-button > .toolbarbutton-menu-dropmarker {
    display: none !important;
}

#urlbar-icons > #addon-bar {
    -moz-appearance: none !important;
    height: 18px !important;
    min-height: 18px !important;
    border-style: none !important;
    background-color: transparent !important;
}

#urlbar-icons > #addon-bar toolbarbutton,
#urlbar-icons > #addon-bar > #status-bar statusbarpanel {
    border-style: none !important;
    height: 18px !important;
    min-width: 18px !important;
    min-height: 18px !important;
    padding: 0 1.5px !important;
    margin: 0 0.5px !important;
}

#urlbar-icons > #addon-bar > #status-bar statusbarpanel:first-child {
    padding-left: 0 !important;
    margin-left: 0 !important;
}
#urlbar-icons > #addon-bar > #status-bar statusbarpanel:last-child {
    padding-right: 0 !important;
    margin-right: 0 !important;
}

#urlbar-icons > #addon-bar > #status-bar {
    padding: 0 1.5px !important;
    margin: 0 0.5px !important;
}

#urlbar-icons > #addon-bar toolbarspring {
    display: none !important;
}
        ]]></>).toString();
        var doc = win.document;
        doc.insertBefore(doc.createProcessingInstruction("xml-stylesheet", "title=\"url-addon-bar-512\" href=\"data:text/css;base64," + win.btoa(uabcsstext) + "\" type=\"text/css\""), doc.getElementById("main-window"));
        var closeButton = doc.getElementById("addonbar-closebutton");
        var urlbarIcons = doc.getElementById("urlbar-icons");
        var addonBar = doc.getElementById("addon-bar");
        closeButton.toggleUA = function (e) {
            if (e.button != 1) return;
            var doc = e.target.ownerDocument;
            var addonBar = doc.getElementById("addon-bar");
            if (addonBar.getAttribute("data-inub") == "true") {
                var browserBottombox = doc.getElementById("browser-bottombox");
                browserBottombox.appendChild(addonBar);
                addonBar.setAttribute("data-inub", "false");
                addonBar.setAttribute("toolboxid", "navigator-toolbox");
                addonBar.setAttribute("context", "toolbar-context-menu");
            } else {
                var urlbarIcons = doc.getElementById("urlbar-icons");
                urlbarIcons.insertBefore(addonBar, urlbarIcons.firstChild);
                addonBar.setAttribute("data-inub", "true");
                addonBar.removeAttribute("toolboxid");
                addonBar.removeAttribute("context");
            }
        };
        closeButton.setAttribute("onclick", "this.toggleUA(event);");
        urlbarIcons.insertBefore(addonBar, urlbarIcons.firstChild);
        addonBar.setAttribute("data-inub", "true");
        addonBar.removeAttribute("toolboxid");
        addonBar.removeAttribute("context");
    },
    uninit: function (win) {
        var doc = win.document;
        var sheets = doc.styleSheets;
        var len = sheets.length;
        while (--len) {
            if (sheets[len].title == "url-addon-bar-512") {
                var cssuab = sheets[len].ownerNode;
                if (cssuab)
                    doc.removeChild(cssuab);
                break;
            }
        }
        var closeButton = doc.getElementById("addonbar-closebutton");
        closeButton.removeAttribute("onclick");
        var addonBar = doc.getElementById("addon-bar");
        if (addonBar.getAttribute("data-inub")) {
            var browserBottombox = doc.getElementById("browser-bottombox");
            browserBottombox.appendChild(addonBar);
            addonBar.removeAttribute("data-inub");
            addonBar.setAttribute("toolboxid", "navigator-toolbox");
            addonBar.setAttribute("context", "toolbar-context-menu");
        }
    },

    aListener: {
        onOpenWindow: function (aWindow) {
            var win = aWindow.docShell.QueryInterface(Ci
                .nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindow);
            win.addEventListener("load", function () {
                win.removeEventListener("load", arguments.callee, true);
                if (win.document.documentElement.getAttribute("windowtype") !=
                    "navigator:browser") return;
                UrlAddonBar.init(win);
            }, true);
        },
        onCloseWindow: function (aWindow) {},
        onWindowTitleChange: function (aWindow, aTitle) {},
    },

    startup: function () {
        this.wm.addListener(this.aListener);
        var cw = this.wm.getEnumerator("navigator:browser");
        while (cw.hasMoreElements()) {
            var win = cw.getNext().QueryInterface(Ci.nsIDOMWindow);
            this.init(win);
        }
    },
    shutdown: function () {
        this.wm.removeListener(this.aListener);
        var cw = this.wm.getEnumerator("navigator:browser");
        while (cw.hasMoreElements()) {
            var win = cw.getNext().QueryInterface(Ci.nsIDOMWindow);
            this.uninit(win);
        }
    }
}


// 启用
function startup(data, reason) {
    var cs = Services.console;
    UrlAddonBar.startup();
}

// 禁用或应用程序退出
function shutdown(data, reason) {
    UrlAddonBar.shutdown();
}

// 安装
function install(data, reason) {
}

// 卸载
function uninstall(data, reason) {
}
