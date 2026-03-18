/**
 * Main Panel Controller - Text Layer Checker
 * Orchestrates text extraction from AE, grammar checking, and results display.
 */
var App = (function () {
    var csInterface = new CSInterface();
    var extensionPath = "";
    var isScanning = false;

    // DOM elements
    var btnScan, btnScanAll, btnSettings, btnCloseSettings, btnSaveSettings, btnFixAll;
    var statusText, resultsContainer, resultsList, emptyState, summaryBar, summaryText;
    var settingsModal, customDictTextarea, chkIgnoreCaps, chkIgnoreShort;

    function init() {
        // Cache DOM references
        btnScan = document.getElementById("btn-scan");
        btnScanAll = document.getElementById("btn-scan-all");
        btnSettings = document.getElementById("btn-settings");
        btnCloseSettings = document.getElementById("btn-close-settings");
        btnSaveSettings = document.getElementById("btn-save-settings");
        btnFixAll = document.getElementById("btn-fix-all");
        statusText = document.getElementById("status-text");
        resultsContainer = document.getElementById("results-container");
        resultsList = document.getElementById("results-list");
        emptyState = document.getElementById("empty-state");
        summaryBar = document.getElementById("summary-bar");
        summaryText = document.getElementById("summary-text");
        settingsModal = document.getElementById("settings-modal");
        customDictTextarea = document.getElementById("custom-dict");
        chkIgnoreCaps = document.getElementById("chk-ignore-caps");
        chkIgnoreShort = document.getElementById("chk-ignore-short");

        // Get extension path
        extensionPath = csInterface.getSystemPath("extension");
        ResultsRenderer.setExtensionPath(extensionPath);

        // Initialize theme
        ThemeManager.init();

        // Initialize grammar engine
        setStatus("Initializing grammar engine...", true);
        CheckerBridge.init(extensionPath).then(function () {
            setStatus("Ready — open a composition and click Scan");
            btnScan.disabled = false;
            btnScanAll.disabled = false;
        }).catch(function (err) {
            setStatus("Error: Could not initialize grammar engine. " + err.message);
            console.error("[App] Init error:", err);
        });

        // Bind events
        btnScan.addEventListener("click", function () { scan(false); });
        btnScanAll.addEventListener("click", function () { scan(true); });
        btnSettings.addEventListener("click", openSettings);
        btnCloseSettings.addEventListener("click", closeSettings);
        btnSaveSettings.addEventListener("click", saveSettings);

        // Disable buttons until engine is ready
        btnScan.disabled = true;
        btnScanAll.disabled = true;
    }

    /**
     * Scan text layers for issues
     */
    function scan(allComps) {
        if (isScanning) return;
        isScanning = true;
        btnScan.disabled = true;
        btnScanAll.disabled = true;

        setStatus("Extracting text layers...", true);

        var scriptCall = allComps ? "getAllTextLayersFromProject()" : "getAllTextLayers()";

        csInterface.evalScript(scriptCall, function (response) {
            try {
                var data = JSON.parse(response);

                if (data.error) {
                    setStatus(data.error);
                    finishScan();
                    return;
                }

                var layers;
                if (allComps) {
                    // Flatten layers from all compositions
                    layers = [];
                    data.forEach(function (comp) {
                        comp.layers.forEach(function (layer) {
                            layers.push(layer);
                        });
                    });
                } else {
                    layers = data.layers || [];
                }

                if (layers.length === 0) {
                    setStatus("No text layers found.");
                    emptyState.innerHTML = '<p>No text layers found in ' +
                        (allComps ? 'the project' : 'the active composition') + '.</p>' +
                        '<p class="hint">Make sure your composition contains text layers.</p>';
                    emptyState.style.display = "";
                    resultsList.style.display = "none";
                    summaryBar.style.display = "none";
                    finishScan();
                    return;
                }

                setStatus("Checking " + layers.length + " text layer" +
                    (layers.length > 1 ? "s" : "") + "...", true);

                CheckerBridge.checkLayers(layers).then(function (results) {
                    displayResults(results);
                    finishScan();
                }).catch(function (err) {
                    setStatus("Error checking text: " + err.message);
                    finishScan();
                });

            } catch (e) {
                setStatus("Error reading layers: " + e.message);
                console.error("[App] Parse error:", e, "Response:", response);
                finishScan();
            }
        });
    }

    /**
     * Display results in the panel
     */
    function displayResults(results) {
        emptyState.style.display = "none";
        resultsList.style.display = "";
        resultsList.innerHTML = "";

        var stats = ResultsRenderer.render(results, resultsList);

        // Update summary bar
        summaryBar.style.display = "";
        if (stats.totalIssues > 0) {
            summaryText.textContent = stats.totalIssues + " issue" +
                (stats.totalIssues > 1 ? "s" : "") + " in " +
                stats.layersWithIssues + " of " + stats.totalLayers + " layer" +
                (stats.totalLayers > 1 ? "s" : "");
            setStatus("Scan complete — " + stats.totalIssues + " issue" +
                (stats.totalIssues > 1 ? "s" : "") + " found");
        } else {
            summaryText.textContent = "All " + stats.totalLayers + " layer" +
                (stats.totalLayers > 1 ? "s" : "") + " clean!";
            setStatus("Scan complete — no issues found");
        }
    }

    function finishScan() {
        isScanning = false;
        if (CheckerBridge.isReady()) {
            btnScan.disabled = false;
            btnScanAll.disabled = false;
        }
    }

    /**
     * Update the status bar
     */
    function setStatus(message, showSpinner) {
        statusText.innerHTML = (showSpinner ? '<span class="spinner"></span>' : "") + message;
    }

    /**
     * Open settings modal
     */
    function openSettings() {
        var settings = CheckerBridge.getSettings();
        var words = CheckerBridge.getCustomWords();

        chkIgnoreCaps.checked = settings.ignoreAllCaps;
        chkIgnoreShort.checked = settings.ignoreShortLayers;
        customDictTextarea.value = words.join("\n");

        settingsModal.style.display = "";
    }

    /**
     * Close settings modal
     */
    function closeSettings() {
        settingsModal.style.display = "none";
    }

    /**
     * Save settings from the modal
     */
    function saveSettings() {
        var words = customDictTextarea.value.split("\n")
            .map(function (w) { return w.trim().toLowerCase(); })
            .filter(function (w) { return w.length > 0; });

        CheckerBridge.saveSettings(extensionPath, {
            ignoreAllCaps: chkIgnoreCaps.checked,
            ignoreShortLayers: chkIgnoreShort.checked,
            customWords: words
        });

        closeSettings();
        ResultsRenderer.showToast("Settings saved");
    }

    // Initialize when DOM is ready
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

    return {
        scan: function () { scan(false); }
    };
})();
