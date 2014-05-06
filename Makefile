XPIFILE = awesomeBars@blunet.cc.xpi

TOP = install.rdf bootstrap.js options.xul chrome.manifest
CONTENT = content/*
LIBRARY = content/library/*
SKIN = skin/*/*
LOCALE = locale/*/*

all: ${XPIFILE}

${XPIFILE}: ${TOP} ${CONTENT} ${LIBRARY} ${SKIN} ${LOCALE}
	zip $@ $^

install:
	open -a Firefox.app ${XPIFILE}

clean:
	rm -f ${XPIFILE}
