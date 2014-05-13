"use strict";

var UrlAddonBar = {
    init: function () {
        if (this._loaded) return;
        this._loaded = true;
        let (addonBar = document.getElementById("addon-bar")) {
            if (!addonBar) return;
            if (addonBar.getAttribute("customizing") === "true") {
                window.addEventListener("aftercustomization", this, false);
            } else {
                this.toggle() && window.addEventListener("beforecustomization", this, true);
            }
        }
    },
    handleEvent: function (e) {
        switch (e.type) {
            case "beforecustomization" :
                window.addEventListener("aftercustomization", this, false);
                break;
            case "aftercustomization" :
                window.removeEventListener("aftercustomization", this, false);
                break;
        }
        this.toggle();
    },
    contains: function (otherNode) {
        if (!this instanceof Node || !otherNode instanceof Node) return false;
        return (this === otherNode) || !!(this.compareDocumentPosition(otherNode) & this.DOCUMENT_POSITION_CONTAINED_BY);
    },
    toggle: function () {
        let addonBar = document.getElementById("addon-bar");
        if (!addonBar) return false;
        if (this._isInUrlbar) {
            let browserBottombox = document.getElementById("browser-bottombox");
            if (this.contains.bind(browserBottombox)(addonBar)) return false;
            if (!browserBottombox) return false;
            browserBottombox.appendChild(addonBar);
            addonBar.setAttribute("toolboxid", "navigator-toolbox");
            addonBar.setAttribute("context", "toolbar-context-menu");
            this._isInUrlbar = false;
        } else {
            let urlbarIcons = document.getElementById("urlbar-icons");
            if (!urlbarIcons) return false;
            if (this.contains.bind(urlbarIcons)(addonBar)) return false;
            urlbarIcons.insertBefore(addonBar, urlbarIcons.firstChild);
            addonBar.removeAttribute("toolboxid");
            addonBar.removeAttribute("context");
            this._isInUrlbar = true;
        }
        return true;
    },
    uninit: function () {
        this._isInUrlbar = true;
        this.toggle();
        window.removeEventListener("beforecustomization", this, true);
        window.removeEventListener("aftercustomization", this, false);
    }
};
