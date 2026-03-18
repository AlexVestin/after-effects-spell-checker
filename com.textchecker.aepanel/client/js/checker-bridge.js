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

    /**
     * Convert a file:// URI (as returned by csInterface.getSystemPath) to a
     * regular filesystem path that Node's require() can use.
     */
    function uriToPath(uri) {
        var p = uri;
        // Strip file:// prefix
        if (p.indexOf("file:///") === 0) {
            // On macOS/Linux: file:///Users/... → /Users/...
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
        return p;
    }

    /**
     * Initialize the grammar checking engine via Node.js
     */
    function init(extensionPath) {
        return new Promise(function (resolve, reject) {
            try {
                var fsPath = uriToPath(extensionPath);
                var nodePath = fsPath + "/node/grammar-engine.js";
                // In CEP, require is available through cep_node
                var nodeRequire = (typeof cep_node !== "undefined") ? cep_node.require : require;
                grammarEngine = nodeRequire(nodePath);
                grammarEngine.init(fsPath).then(function () {
                    isReady = true;
                    loadSettings(extensionPath);
                    resolve();
                }).catch(function (err) {
                    console.warn("[CheckerBridge] Grammar engine init failed, using fallback:", err);
                    grammarEngine.initFallback(fsPath).then(function () {
                        isReady = true;
                        loadSettings(extensionPath);
                        resolve();
                    }).catch(reject);
                });
            } catch (e) {
                reject(e);
            }
        });
    }

    /**
     * Load saved settings from file
     */
    function loadSettings(extensionPath) {
        try {
            var nodeRequire = (typeof cep_node !== "undefined") ? cep_node.require : require;
            var fs = nodeRequire("fs");
            var path = nodeRequire("path");
            var fsPath = uriToPath(extensionPath);
            var settingsPath = path.join(fsPath, "dictionaries", "settings.json");
            if (fs.existsSync(settingsPath)) {
                var data = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
                if (data.ignoreAllCaps !== undefined) settings.ignoreAllCaps = data.ignoreAllCaps;
                if (data.ignoreShortLayers !== undefined) settings.ignoreShortLayers = data.ignoreShortLayers;
                if (data.customWords) customWords = data.customWords;
            }

            var dictPath = path.join(fsPath, "dictionaries", "custom-words.txt");
            if (fs.existsSync(dictPath)) {
                var words = fs.readFileSync(dictPath, "utf8").split("\n").filter(function (w) {
                    return w.trim().length > 0;
                });
                customWords = customWords.concat(words);
            }
        } catch (e) {
            console.log("[CheckerBridge] No saved settings found");
        }
    }

    /**
     * Save settings to file
     */
    function saveSettings(extensionPath, newSettings) {
        try {
            var nodeRequire = (typeof cep_node !== "undefined") ? cep_node.require : require;
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

            // Also save custom words to the text file
            var dictPath = path.join(fsPath, "dictionaries", "custom-words.txt");
            fs.writeFileSync(dictPath, customWords.join("\n"));
        } catch (e) {
            console.error("[CheckerBridge] Failed to save settings:", e);
        }
    }

    /**
     * Check a single text string for issues
     * @returns Promise<Array<Issue>>
     */
    function checkText(text) {
        if (!isReady || !grammarEngine) {
            return Promise.reject(new Error("Grammar engine not initialized"));
        }

        // Pre-filter: skip ALL CAPS if setting enabled
        if (settings.ignoreAllCaps && text === text.toUpperCase() && text.length > 0) {
            return Promise.resolve([]);
        }

        // Pre-filter: skip short text if setting enabled
        if (settings.ignoreShortLayers) {
            var wordCount = text.trim().split(/\s+/).length;
            if (wordCount < 3) {
                return Promise.resolve([]);
            }
        }

        // Normalize AE line breaks (\r) to \n
        var normalizedText = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

        return grammarEngine.check(normalizedText, customWords);
    }

    /**
     * Check multiple text layers
     * @param layers Array of {index, name, text}
     * @returns Promise<Array<{layer, issues}>>
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
