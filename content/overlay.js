"use strict";

let CustomizableUI = window.CustomizableUI || (function () {
    try {
        return Components.utils.import("resource:///modules/CustomizableUI.jsm", {}).CustomizableUI;
    } catch (ex) {
        return;
    };
})();

this.UrlAddonBar = {
    ID: "uab-addon-bar",
    AUTOHIDE: "url-addon-bar-auto-hide",
    AUTOHIDEFOCUS: "url-addon-bar-auto-hide-focus",
    init: function () {
        if (this._loaded) return;
        this._loaded = true;

        /* For australis */
        if (CustomizableUI) {
            this._addonBar = this.createCustomizableToolbar();
        } else {
            let (addonBar = document.getElementById("addon-bar")) {
                if (!addonBar) return;
                this._addonBar = addonBar;
                if (addonBar.getAttribute("customizing") === "true") {
                    window.addEventListener("aftercustomization", this, false);
                } else {
                    this.toggle() && window.addEventListener("beforecustomization", this, true);
                }
            }
        }

        Services.prefs.getBoolPref("extensions.urladdonbar.autohide") && this.autoHide(0);
        Services.prefs.addObserver("extensions.urladdonbar.", this, false);
    },
    createCustomizableToolbar: function () {
        const ID = this.ID, TID = ID + "-customization-target";

        var hbox = document.createElement("hbox");
        hbox.id = TID;
        hbox.classList.add("addon-bar");
        var urlbarIcons = document.getElementById("urlbar-icons");
        urlbarIcons.insertBefore(hbox, urlbarIcons.firstChild);

        var toolbar = document.createElement("toolbar");
        var navbox = document.getElementById("navigator-toolbox");
        toolbar.id = ID;
        for (let [key, value] of Iterator({
                           "mode": navbox && navbox.getAttribute("mode") || "icons",
                       "iconsize": navbox && navbox.getAttribute("iconsize") || "small",
                    "toolbarname": "Addon-bar",
                   "customizable": true,
                     "defaultset": let (navbar = document.getElementById("nav-bar")) navbar && navbar.getAttribute("defaultset") || "" /* or call: CustomizableUI.registerArea(ID, {}); */,
                        "context": "toolbar-context-menu",
            "customizationtarget": TID,
        })) {
            toolbar.setAttribute(key, value);
        }
        toolbar.classList.add("toolbar-primary");
        toolbar.classList.add("chromeclass-toolbar");
        toolbar.addEventListener("toolbarvisibilitychange", function (evt) {
            const HIDING_ATTR = "collapsed";
            var visible = evt.detail.visible;
            hbox.setAttribute(HIDING_ATTR, !visible);
        });

        var navbar = document.getElementById("nav-bar");
        navbar.parentNode.insertBefore(toolbar, navbar.nextSibling);

        hbox.addEventListener("areaNodeUnregistered", function _(evt) {
            hbox.removeEventListener("areaNodeUnregistered", _);
            listener.onAreaNodeUnregistered(...evt.detail);
        });
        var listener = Object.create(null);
        listener.onCustomizeStart = function (aWindow) {
            toolbar.appendChild(hbox);
        };
        listener.onCustomizeEnd = function (aWindow) {
            urlbarIcons.insertBefore(hbox, urlbarIcons.firstChild);
        };
        listener.onAreaNodeUnregistered = function (aArea, aContainer, aReason) {
            if (aArea === ID) {
                hbox.parentNode.removeChild(hbox);
                toolbar.parentNode.removeChild(toolbar);
                CustomizableUI.removeListener(listener);
            }
        };
        Object.freeze(listener);
        CustomizableUI.addListener(listener);
        return hbox;
    },
    autoHide: function (midx) {
        var addonBar = this._addonBar;
        if (!addonBar) return;
        var urlbar = document.getElementById("urlbar");
        if (!urlbar) return;
        var input = urlbar.inputField;
        if (!input) return;
        var method = ["addEventListener", "removeEventListener"][midx];
        if (!method) return;
        input[method]("focus", this, false);
        input[method]("blur", this, false);
        addonBar[method]("transitionend", this, false);
        addonBar.classList[["add", "remove"][midx] || "remove"](this.AUTOHIDE);
    },
    handleEvent: function (e) {
        var addonBar = this._addonBar;
        switch (e.type) {
            case "transitionend":
                if (addonBar === e.target && "width" === e.propertyName && !addonBar.classList.contains(this.AUTOHIDEFOCUS)) {
                    addonBar.style.width = "";
                }
                break;
            case "focus":
                addonBar.style.width = window.getComputedStyle(addonBar, null)["width"];
                let self = this;
                setTimeout(function () {
                    addonBar.classList.add(self.AUTOHIDEFOCUS);
                }, 30);
                break;
            case "blur":
                addonBar.classList.remove(this.AUTOHIDEFOCUS);
                break;
            case "beforecustomization":
                this.autoHide(0);
                window.addEventListener("aftercustomization", this, false);
                this.toggle();
                break;
            case "aftercustomization":
                this.autoHide(1);
                window.removeEventListener("aftercustomization", this, false);
                this.toggle();
                break;
        }
    },
    observe: function (aSubject, aTopic, aData) {
        if ("nsPref:changed" !== aTopic) return;
        aSubject.QueryInterface(Ci.nsIPrefBranch);
        if ("extensions.urladdonbar.autohide" === aData) {
            this.autoHide(aSubject.getBoolPref(aData) ? 0 : 1);
        }

    },
    contains: function (otherNode) {
        if (!this instanceof Node || !otherNode instanceof Node) return false;
        return (this === otherNode) || !!(this.compareDocumentPosition(otherNode) & this.DOCUMENT_POSITION_CONTAINED_BY);
    },
    toggle: function () {
        var addonBar = this._addonBar;
        if (!addonBar) return false;
        if (this._isInUrlbar) {
            let browserBottombox = document.getElementById("browser-bottombox");
            if (this.contains.bind(browserBottombox)(addonBar)) return false;
            if (!browserBottombox) return false;
            browserBottombox.appendChild(addonBar);
            //addonBar.setAttribute("toolboxid", "navigator-toolbox");
            addonBar.setAttribute("context", "toolbar-context-menu");
            this._isInUrlbar = false;
        } else {
            let urlbarIcons = document.getElementById("urlbar-icons");
            if (!urlbarIcons) return false;
            if (this.contains.bind(urlbarIcons)(addonBar)) return false;
            urlbarIcons.insertBefore(addonBar, urlbarIcons.firstChild);
            //addonBar.removeAttribute("toolboxid");
            addonBar.removeAttribute("context");
            this._isInUrlbar = true;
        }
        return true;
    },
    uninit: function () {
        this._isInUrlbar = true;
        if (CustomizableUI) {
            CustomizableUI.unregisterArea(this.ID);
            CustomizableUI.REASON_AREA_UNREGISTERED || /* Firefox 29 */
                this._addonBar.dispatchEvent(new CustomEvent("areaNodeUnregistered", {
                    "detail": [this.ID, this._addonBar, "area-unregistered"]
                }));
        } else {
            this.toggle();
            window.removeEventListener("beforecustomization", this, true);
            window.removeEventListener("aftercustomization", this, false);
        }
        Services.prefs.removeObserver("extensions.urladdonbar.", this);
        this.autoHide(1);
        delete this._loaded;
        delete this._addonBar;
    }
};
