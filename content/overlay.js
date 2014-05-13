"use strict";

var UrlAddonBar = {
    AUTOHIDE: "url-addon-bar-auto-hide",
    AUTOHIDEFOCUS: "url-addon-bar-auto-hide-focus",
    init: function () {
        if (this._loaded) return;
        this._loaded = true;
        let (addonBar = document.getElementById("addon-bar")) {
            if (!addonBar) return;
            this._addonBar = addonBar;
            if (addonBar.getAttribute("customizing") === "true") {
                window.addEventListener("aftercustomization", this, false);
            } else {
                this.toggle() && window.addEventListener("beforecustomization", this, true);
            }
            Services.prefs.getBoolPref("extensions.urladdonbar.autohide") && this.autoHide(0);
            Services.prefs.addObserver("extensions.urladdonbar.", this, false);
        }
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
        this.toggle();
        Services.prefs.removeObserver("extensions.urladdonbar.", this);
        this.autoHide(1);
        window.removeEventListener("beforecustomization", this, true);
        window.removeEventListener("aftercustomization", this, false);
        delete this._loaded;
        delete this._addonBar;
    }
};
