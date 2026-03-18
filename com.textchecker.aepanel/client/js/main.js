/**
 * Main Panel Controller - Text Layer Checker
 * Orchestrates text extraction from AE, grammar checking, and results display.
 */

/* ── In-panel debug logger ── */
var Log = (function () {
    var logOutput = null;
    var logPanel = null;

    function getEls() {
        if (!logOutput) logOutput = document.getElementById("log-output");
        if (!logPanel) logPanel = document.getElementById("log-panel");
    }

    function write(msg, level) {
        getEls();
        if (!logOutput) return;
        var entry = document.createElement("div");
        entry.className = "log-entry log-" + (level || "info");
        var now = new Date();
        var ts = ("0" + now.getHours()).slice(-2) + ":" +
                 ("0" + now.getMinutes()).slice(-2) + ":" +
                 ("0" + now.getSeconds()).slice(-2);
        entry.innerHTML = '<span class="log-time">' + ts + '</span>' +
            msg.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        logOutput.appendChild(entry);
        logOutput.scrollTop = logOutput.scrollHeight;
    }

    return {
        info:  function (m) { write(m, "info"); },
        ok:    function (m) { write(m, "ok"); },
        warn:  function (m) { write(m, "warn"); },
        error: function (m) { write(m, "error"); },
        clear: function () { getEls(); if (logOutput) logOutput.innerHTML = ""; },
        show:  function () { getEls(); if (logPanel) logPanel.style.display = "flex"; },
        hide:  function () { getEls(); if (logPanel) logPanel.style.display = "none"; },
        toggle: function () {
            getEls();
            if (!logPanel) return;
            var hidden = logPanel.style.display === "none" || logPanel.style.display === "";
            logPanel.style.display = hidden ? "flex" : "none";
        }
    };
})();

/* ── App ── */
var App = (function () {
    var csInterface = null;
    var extensionPath = "";
    var isScanning = false;

    // DOM refs
    var btnScan, btnScanAll, btnSettings, btnLog;
    var btnCloseSettings, btnSaveSettings;
    var statusText, resultsList, emptyState, summaryBar, summaryText;
    var settingsModal, customDictTextarea, chkIgnoreCaps, chkIgnoreShort;

    /* ── helpers ── */
    function setStatus(message, showSpinner) {
        if (!statusText) return;
        statusText.innerHTML = (showSpinner ? '<span class="spinner"></span>' : "") + message;
    }

    function $(id) { return document.getElementById(id); }

    /* ── init ── */
    function init() {
        Log.info("init() called");

        // ── 1. Cache DOM refs ──
        try {
            btnScan          = $("btn-scan");
            btnScanAll       = $("btn-scan-all");
            btnSettings      = $("btn-settings");
            btnLog           = $("btn-log");
            btnCloseSettings = $("btn-close-settings");
            btnSaveSettings  = $("btn-save-settings");
            statusText       = $("status-text");
            resultsList      = $("results-list");
            emptyState       = $("empty-state");
            summaryBar       = $("summary-bar");
            summaryText      = $("summary-text");
            settingsModal    = $("settings-modal");
            customDictTextarea = $("custom-dict");
            chkIgnoreCaps    = $("chk-ignore-caps");
            chkIgnoreShort   = $("chk-ignore-short");
            Log.ok("DOM refs cached");
        } catch (e) {
            Log.error("DOM caching failed: " + e.message);
        }

        // ── 2. Bind ALL events FIRST (before any async work) ──
        try {
            if (btnScan)          btnScan.addEventListener("click", function () { Log.info("Scan clicked"); scan(false); });
            if (btnScanAll)       btnScanAll.addEventListener("click", function () { Log.info("Scan All clicked"); scan(true); });
            if (btnSettings)      btnSettings.addEventListener("click", function () { Log.info("Settings clicked"); openSettings(); });
            if (btnLog)           btnLog.addEventListener("click", function () { Log.toggle(); });
            if (btnCloseSettings) btnCloseSettings.addEventListener("click", function () { Log.info("Close settings clicked"); closeSettings(); });
            if (btnSaveSettings)  btnSaveSettings.addEventListener("click", function () { Log.info("Save settings clicked"); saveSettings(); });

            var btnClearLog = $("btn-clear-log");
            var btnCloseLog = $("btn-close-log");
            if (btnClearLog) btnClearLog.addEventListener("click", function () { Log.clear(); });
            if (btnCloseLog) btnCloseLog.addEventListener("click", function () { Log.hide(); });

            Log.ok("Event listeners bound");
        } catch (e) {
            Log.error("Event binding failed: " + e.message);
        }

        // ── 3. Disable scan buttons until engine ready ──
        if (btnScan) btnScan.disabled = true;
        if (btnScanAll) btnScanAll.disabled = true;

        // ── 4. CSInterface ──
        try {
            csInterface = new CSInterface();
            Log.ok("CSInterface created");
        } catch (e) {
            Log.error("CSInterface creation failed: " + e.message);
            setStatus("Error: CSInterface not available");
            return;
        }

        try {
            extensionPath = csInterface.getSystemPath(CSInterface.prototype.EXTENSION_PATH || "extension");
            Log.info("extensionPath = " + extensionPath);
            ResultsRenderer.setExtensionPath(extensionPath);
        } catch (e) {
            Log.error("getSystemPath failed: " + e.message);
        }

        // ── 5. Theme ──
        try {
            ThemeManager.init();
            Log.ok("ThemeManager initialized");
        } catch (e) {
            Log.warn("ThemeManager failed (non-fatal): " + e.message);
        }

        // ── 6. Grammar engine ──
        setStatus("Initializing grammar engine...", true);
        Log.info("Starting grammar engine init...");
        Log.info("cep_node available: " + (typeof cep_node !== "undefined"));
        Log.info("window.require available: " + (typeof require !== "undefined"));

        CheckerBridge.init(extensionPath).then(function () {
            Log.ok("Grammar engine ready (primary)");
            setStatus("Ready — open a composition and click Scan");
            if (btnScan) btnScan.disabled = false;
            if (btnScanAll) btnScanAll.disabled = false;
        }).catch(function (err) {
            Log.error("Grammar engine init failed: " + err.message);
            if (err.stack) Log.error("Stack: " + err.stack);
            setStatus("Error: Could not initialize grammar engine. " + err.message);
            // Still enable buttons so user can at least try
            if (btnScan) btnScan.disabled = false;
            if (btnScanAll) btnScanAll.disabled = false;
        });

        // Show the log panel by default so user can see startup
        Log.show();
    }

    /* ── scan ── */
    function scan(allComps) {
        if (isScanning) {
            Log.warn("Scan already in progress, ignoring");
            return;
        }
        if (!csInterface) {
            Log.error("csInterface is null, cannot scan");
            return;
        }
        if (!CheckerBridge.isReady()) {
            Log.warn("Grammar engine not ready yet");
            setStatus("Grammar engine not ready — please wait");
            return;
        }

        isScanning = true;
        if (btnScan) btnScan.disabled = true;
        if (btnScanAll) btnScanAll.disabled = true;

        setStatus("Extracting text layers...", true);
        var scriptCall = allComps ? "getAllTextLayersFromProject()" : "getAllTextLayers()";
        Log.info("evalScript: " + scriptCall);

        csInterface.evalScript(scriptCall, function (response) {
            Log.info("evalScript response length: " + (response ? response.length : "null"));
            Log.info("evalScript response (first 300 chars): " + (response || "").substring(0, 300));

            if (!response || response === "EvalScript_Not_Available" || response === "undefined") {
                Log.error("ExtendScript not available. Response: " + response);
                setStatus("Error: ExtendScript returned no data. Is a composition open?");
                finishScan();
                return;
            }

            try {
                var data = JSON.parse(response);
                Log.info("Parsed response OK");

                if (data.error) {
                    Log.warn("ExtendScript error: " + data.error);
                    setStatus(data.error);
                    finishScan();
                    return;
                }

                var layers;
                if (allComps) {
                    layers = [];
                    if (Array.isArray(data)) {
                        data.forEach(function (comp) {
                            if (comp.layers) {
                                comp.layers.forEach(function (layer) { layers.push(layer); });
                            }
                        });
                    }
                } else {
                    layers = data.layers || [];
                }

                Log.info("Found " + layers.length + " text layer(s)");

                if (layers.length === 0) {
                    setStatus("No text layers found.");
                    if (emptyState) {
                        emptyState.innerHTML = '<p>No text layers found in ' +
                            (allComps ? 'the project' : 'the active composition') + '.</p>' +
                            '<p class="hint">Make sure your composition contains text layers.</p>';
                        emptyState.style.display = "";
                    }
                    if (resultsList) resultsList.style.display = "none";
                    if (summaryBar) summaryBar.style.display = "none";
                    finishScan();
                    return;
                }

                setStatus("Checking " + layers.length + " text layer" +
                    (layers.length > 1 ? "s" : "") + "...", true);

                CheckerBridge.checkLayers(layers).then(function (results) {
                    Log.ok("Check complete");
                    displayResults(results);
                    finishScan();
                }).catch(function (err) {
                    Log.error("checkLayers failed: " + err.message);
                    setStatus("Error checking text: " + err.message);
                    finishScan();
                });

            } catch (e) {
                Log.error("JSON parse failed: " + e.message);
                Log.error("Raw response: " + (response || "").substring(0, 500));
                setStatus("Error reading layers: " + e.message);
                finishScan();
            }
        });
    }

    /* ── display results ── */
    function displayResults(results) {
        if (emptyState) emptyState.style.display = "none";
        if (resultsList) {
            resultsList.style.display = "";
            resultsList.innerHTML = "";
        }

        var stats = ResultsRenderer.render(results, resultsList);

        if (summaryBar) summaryBar.style.display = "";
        if (stats.totalIssues > 0) {
            if (summaryText) {
                summaryText.textContent = stats.totalIssues + " issue" +
                    (stats.totalIssues > 1 ? "s" : "") + " in " +
                    stats.layersWithIssues + " of " + stats.totalLayers + " layer" +
                    (stats.totalLayers > 1 ? "s" : "");
            }
            setStatus("Scan complete — " + stats.totalIssues + " issue" +
                (stats.totalIssues > 1 ? "s" : "") + " found");
            Log.warn("Found " + stats.totalIssues + " issue(s) in " + stats.layersWithIssues + " layer(s)");
        } else {
            if (summaryText) {
                summaryText.textContent = "All " + stats.totalLayers + " layer" +
                    (stats.totalLayers > 1 ? "s" : "") + " clean!";
            }
            setStatus("Scan complete — no issues found");
            Log.ok("All layers clean");
        }
    }

    function finishScan() {
        isScanning = false;
        if (btnScan) btnScan.disabled = false;
        if (btnScanAll) btnScanAll.disabled = false;
    }

    /* ── settings modal ── */
    function openSettings() {
        Log.info("openSettings()");
        if (!settingsModal) {
            Log.error("settingsModal element not found!");
            return;
        }
        try {
            var s = CheckerBridge.getSettings();
            var words = CheckerBridge.getCustomWords();
            Log.info("Settings loaded: ignoreAllCaps=" + s.ignoreAllCaps + ", ignoreShort=" + s.ignoreShortLayers);
            if (chkIgnoreCaps) chkIgnoreCaps.checked = s.ignoreAllCaps;
            if (chkIgnoreShort) chkIgnoreShort.checked = s.ignoreShortLayers;
            if (customDictTextarea) customDictTextarea.value = words.join("\n");
        } catch (e) {
            Log.warn("Failed to load current settings: " + e.message);
        }
        settingsModal.classList.remove("hidden");
        Log.ok("Settings modal shown");
    }

    function closeSettings() {
        if (settingsModal) settingsModal.classList.add("hidden");
        Log.info("Settings modal hidden");
    }

    function saveSettings() {
        try {
            var words = customDictTextarea.value.split("\n")
                .map(function (w) { return w.trim().toLowerCase(); })
                .filter(function (w) { return w.length > 0; });

            CheckerBridge.saveSettings(extensionPath, {
                ignoreAllCaps: chkIgnoreCaps ? chkIgnoreCaps.checked : true,
                ignoreShortLayers: chkIgnoreShort ? chkIgnoreShort.checked : false,
                customWords: words
            });

            closeSettings();
            ResultsRenderer.showToast("Settings saved");
            Log.ok("Settings saved (" + words.length + " custom words)");
        } catch (e) {
            Log.error("saveSettings failed: " + e.message);
        }
    }

    /* ── bootstrap ── */
    try {
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", init);
        } else {
            init();
        }
    } catch (e) {
        // Last-resort fallback — write directly to page
        document.body.innerHTML += '<pre style="color:red;padding:10px;">FATAL: ' + e.message + '\n' + e.stack + '</pre>';
    }

    return {
        scan: function () { scan(false); }
    };
})();
