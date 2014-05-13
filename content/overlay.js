"use strict"

var UrlAddonBar = {
    init: function () {
        if (this._loaded) return;
        this._loaded = true;
        
        this.toggle() && window.addEventListener("beforecustomization", this, true);
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
    toggle: function () {
        let addonBar = document.getElementById("addon-bar");
        if (!addonBar) return false;
        if (this._isInUrlbar) {
            let browserBottombox = document.getElementById("browser-bottombox");
            if (!browserBottombox) return false;
            browserBottombox.appendChild(addonBar);
            addonBar.setAttribute("toolboxid", "navigator-toolbox");
            addonBar.setAttribute("context", "toolbar-context-menu");
            this._isInUrlbar = false;
        } else {
            let urlbarIcons = document.getElementById("urlbar-icons");
            if (!urlbarIcons) return false;
            urlbarIcons.insertBefore(addonBar, urlbarIcons.firstChild);
            addonBar.removeAttribute("toolboxid");
            addonBar.removeAttribute("context");
            this._isInUrlbar = true;
        }
        return true;
    },
    uninit: function () {
        this.toggle();
        window.removeEventListener("beforecustomization", this, true);
    }
};
