XPIFILE = urlAddonBar@zbinlin.xpi

TOP = install.rdf bootstrap.js options.xul chrome.manifest
CONTENT = content/overlay.js
SKIN = skin/overlay.css
DEFAULTS = defaults/preferences/options.js
LOCALE = locale/*/options.dtd

all: ${XPIFILE}

${XPIFILE}: ${TOP} ${CONTENT} ${SKIN} ${DEFAULTS} ${LOCALE}
	zip $@ $^

install:
	firefox ${XPIFILE}

clean:
	rm -f ${XPIFILE}
