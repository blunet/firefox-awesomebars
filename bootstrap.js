"use strict"

// unable to import from addon-chrome here
const clazz = "AwesomeBars";

function startup(data, reason) {
    Components.utils.import("chrome://"+clazz+"/content/library/AddonManager.jsm");
    AddonManager.init(clazz, "navigator:browser", ["overlay.css"], ["overlay.js"], ["defaultPrefs.js"]);
}

function shutdown(data, reason) {
    AddonManager.uninit();
    Components.utils.unload("chrome://"+clazz+"/content/library/AddonManager.jsm");
}

function install(data, reason) {
}

function uninstall(data, reason) {
}
