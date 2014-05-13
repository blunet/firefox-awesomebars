"use strict"

const EXPORTED_SYMBOLS = ["Exception", "Interfaces", "Services", "Modules", "Classes", "console"];

Components.utils.import("resource://gre/modules/devtools/Console.jsm", this);
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm", this);

// 1. Components : The only non-standard always available global object
// 2. Interfaces : Shortcut for Components.interfaces without nsI prefix
//                 https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface
// 3. Services   : Shortcut & discoverability for Components.classes[…].getService(Components.interfaces.…)
// 4. Modules    : Shortcut & discoverability for Components.utils.import(…)
//                 https://developer.mozilla.org/en-US/docs/Mozilla/JavaScript_code_modules

// - Exception

const Exception = Components.Exception;

// - Interfaces

const Interfaces = Components.interfaces; // TODO remove prefixes

// - Services

Components.utils.import("resource://gre/modules/Services.jsm", this);

const servicesTable = [
	["syleSheet","content/style-sheet-service","StyleSheetService"],
	["categoryManager","categorymanager","CategoryManager"],
	["threadManager","thread-manager","ThreadManager"]
	// TODO add 2-char shortcut & fullname for all
];

for (let [name, id, iface] of servicesTable)
	if (! name in Services)
		XPCOMUtils.defineLazyServiceGetter(Services, name, "@mozilla.org/"+id+";1", "nsI"+iface);
	else
		throw new Components.Exception("Already defined. Could not bind getter to Services."+name);

// - Modules

const Modules = {};

const modulesTable = [
	["console","gre/modules/devtools/Console.jsm"],
	["xpcomUtils","gre/modules/XPCOMUtils.jsm"]
	// TODO add more & modules from addon
];

for (let [name, path, symbol] of modulesTable) {
 	Modules[name] = function(scope) { return "resource://" + path; };
}

// - Classes

const Classes = {};

const classesTable = [
	["xmlHttpRequest","@mozilla.org/xmlextras/xmlhttprequest;1","nsIXMLHttpRequest"],
	["principal","@mozilla.org/systemprincipal;1","nsIPrincipal"]
];

for (let [name, id, iface] of classesTable)
	Classes[name] = {createInstance: function() { return Components.classes[id].createInstance(Components.interfaces[iface]); }};

// - Enums & other non mozilla stuff