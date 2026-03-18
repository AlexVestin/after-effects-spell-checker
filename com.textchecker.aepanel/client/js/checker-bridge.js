/**
 * Checker Bridge - Bridges the panel UI with the grammar/spell checking engine.
 * Uses Node.js (cep_node) to load the grammar engine.
 */
var CheckerBridge = (function () {
    var grammarEngine = null;
    var isReady = false;
    var customWords = [];
    var settings = {
        ignoreAllCaps: true,
        ignoreShortLayers: false
    };

    /** Write to the in-panel log (if available) */
    function log(msg, level) {
        if (typeof Log !== "undefined" && Log[level || "info"]) {
            Log[level || "info"]("[Bridge] " + msg);
        }
    }

    /**
     * Convert a file:// URI (as returned by csInterface.getSystemPath) to a
     * regular filesystem path that Node's require() can use.
     */
    function uriToPath(uri) {
        var p = String(uri || "");
        log("uriToPath input: " + p);
        // Strip file:// prefix
        if (p.indexOf("file:///") === 0) {
            p = p.substring(7);
        } else if (p.indexOf("file://") === 0) {
            p = p.substring(7);
        }
        // Decode percent-encoded characters (e.g. %20 → space)
        p = decodeURIComponent(p);
        // On Windows, paths may start with /C:/ — strip the leading slash
        if (/^\/[A-Za-z]:\//.test(p)) {
            p = p.substring(1);
        }
        log("uriToPath output: " + p);
        return p;
    }

    /**
     * Get the appropriate require function for the CEP Node.js context
     */
    function getNodeRequire() {
        if (typeof cep_node !== "undefined" && cep_node.require) {
            log("Using cep_node.require");
            return cep_node.require;
        }
        if (typeof require === "function") {
            log("Using global require");
            return require;
        }
        return null;
    }

    /**
     * Initialize the grammar checking engine via Node.js
     */
    function init(extensionPath) {
        log("init() called with extensionPath: " + extensionPath);
        return new Promise(function (resolve, reject) {
            try {
                var fsPath = uriToPath(extensionPath);
                var nodePath = fsPath + "/node/grammar-engine.js";
                log("Attempting require: " + nodePath);

                var nodeRequire = getNodeRequire();
                if (!nodeRequire) {
                    reject(new Error("No Node.js require available. cep_node=" +
                        (typeof cep_node) + ", require=" + (typeof require)));
                    return;
                }

                grammarEngine = nodeRequire(nodePath);
                log("grammar-engine.js loaded OK", "ok");

                log("Calling grammarEngine.init()...");
                grammarEngine.init(fsPath).then(function () {
                    isReady = true;
                    log("Harper.js initialized OK", "ok");
                    loadSettings(extensionPath);
                    resolve();
                }).catch(function (err) {
                    log("Harper init failed: " + err.message + " — trying fallback", "warn");
                    grammarEngine.initFallback(fsPath).then(function () {
                        isReady = true;
                        log("Typo.js fallback initialized OK", "ok");
                        loadSettings(extensionPath);
                        resolve();
                    }).catch(function (err2) {
                        log("Fallback also failed: " + err2.message, "error");
                        reject(err2);
                    });
                });
            } catch (e) {
                log("init() threw: " + e.message, "error");
                if (e.stack) log(e.stack, "error");
                reject(e);
            }
        });
    }

    /**
     * Load saved settings from file
     */
    function loadSettings(extensionPath) {
        try {
            var nodeRequire = getNodeRequire();
            if (!nodeRequire) { log("No require for settings load", "warn"); return; }
            var fs = nodeRequire("fs");
            var path = nodeRequire("path");
            var fsPath = uriToPath(extensionPath);
            var settingsPath = path.join(fsPath, "dictionaries", "settings.json");
            if (fs.existsSync(settingsPath)) {
                var data = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
                if (data.ignoreAllCaps !== undefined) settings.ignoreAllCaps = data.ignoreAllCaps;
                if (data.ignoreShortLayers !== undefined) settings.ignoreShortLayers = data.ignoreShortLayers;
                if (data.customWords) customWords = data.customWords;
                log("Loaded settings.json", "ok");
            }

            var dictPath = path.join(fsPath, "dictionaries", "custom-words.txt");
            if (fs.existsSync(dictPath)) {
                var words = fs.readFileSync(dictPath, "utf8").split("\n").filter(function (w) {
                    return w.trim().length > 0;
                });
                customWords = customWords.concat(words);
                log("Loaded " + words.length + " custom dictionary words", "ok");
            }
        } catch (e) {
            log("loadSettings failed: " + e.message, "warn");
        }
    }

    /**
     * Save settings to file
     */
    function saveSettings(extensionPath, newSettings) {
        try {
            var nodeRequire = getNodeRequire();
            if (!nodeRequire) { log("No require for settings save", "warn"); return; }
            var fs = nodeRequire("fs");
            var path = nodeRequire("path");
            var fsPath = uriToPath(extensionPath);
            var settingsPath = path.join(fsPath, "dictionaries", "settings.json");

            if (newSettings.ignoreAllCaps !== undefined) settings.ignoreAllCaps = newSettings.ignoreAllCaps;
            if (newSettings.ignoreShortLayers !== undefined) settings.ignoreShortLayers = newSettings.ignoreShortLayers;
            if (newSettings.customWords) customWords = newSettings.customWords;

            fs.writeFileSync(settingsPath, JSON.stringify({
                ignoreAllCaps: settings.ignoreAllCaps,
                ignoreShortLayers: settings.ignoreShortLayers,
                customWords: customWords
            }, null, 2));

            var dictPath = path.join(fsPath, "dictionaries", "custom-words.txt");
            fs.writeFileSync(dictPath, customWords.join("\n"));
            log("Settings saved to disk", "ok");
        } catch (e) {
            log("saveSettings failed: " + e.message, "error");
        }
    }

    /**
     * Check a single text string for issues
     */
    function checkText(text) {
        if (!isReady || !grammarEngine) {
            return Promise.reject(new Error("Grammar engine not initialized"));
        }

        if (settings.ignoreAllCaps && text === text.toUpperCase() && text.length > 0) {
            return Promise.resolve([]);
        }

        if (settings.ignoreShortLayers) {
            var wordCount = text.trim().split(/\s+/).length;
            if (wordCount < 3) {
                return Promise.resolve([]);
            }
        }

        var normalizedText = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
        return grammarEngine.check(normalizedText, customWords);
    }

    /**
     * Check multiple text layers
     */
    function checkLayers(layers) {
        var promises = layers.map(function (layer) {
            return checkText(layer.text).then(function (issues) {
                return { layer: layer, issues: issues };
            });
        });
        return Promise.all(promises);
    }

    /**
     * Add a word to the custom dictionary
     */
    function addToCustomDictionary(word, extensionPath) {
        if (customWords.indexOf(word.toLowerCase()) === -1) {
            customWords.push(word.toLowerCase());
            saveSettings(extensionPath, { customWords: customWords });
        }
    }

    return {
        init: init,
        checkText: checkText,
        checkLayers: checkLayers,
        saveSettings: saveSettings,
        addToCustomDictionary: addToCustomDictionary,
        getSettings: function () { return settings; },
        getCustomWords: function () { return customWords; },
        isReady: function () { return isReady; }
    };
})();
