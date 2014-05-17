"use strict"

// unable to import from addon-chrome here
const clazz = "AwesomeBars";

function startup(data, reason) {
    Components.utils.import("chrome://"+clazz+"/content/library/AddonManager.jsm");
    AddonManager.init(clazz, "navigator:browser", ["overlay.css"], ["overlay.js"], ["defaultPrefs.js"]);
    Components.utils.import("chrome://"+clazz+"/content/library/OverlayManager.jsm");
    OverlayManager.addOverlays({
        "chrome://browser/content/browser.xul": {
            documents: ["chrome://"+clazz+"/content/addonbar.xul"],
            scripts: ["chrome://"+clazz+"/content/overlay.js"],
            styles: ["chrome://"+clazz+"/skin/common/overlay.css"]
        }
    });
}

function shutdown(data, reason) {
    AddonManager.uninit();
    Components.utils.unload("chrome://"+clazz+"/content/library/AddonManager.jsm");
    OverlayManager.unload();
    Components.utils.unload("chrome://"+clazz+"/content/library/OverlayManager.jsm");
}

function install(data, reason) {
}

function uninstall(data, reason) {
}
