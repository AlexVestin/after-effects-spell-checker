/**
 * Results Renderer - Displays grammar/spelling check results in the panel UI
 */
var ResultsRenderer = (function () {
    var csInterface = new CSInterface();
    var currentResults = [];
    var extensionPath = "";

    function setExtensionPath(path) {
        extensionPath = path;
    }

    /**
     * Render all layer results into the results container
     */
    function render(results, container) {
        currentResults = results;
        container.innerHTML = "";

        var totalIssues = 0;
        var layersWithIssues = 0;

        results.forEach(function (result) {
            var card = createLayerCard(result);
            container.appendChild(card);
            if (result.issues.length > 0) {
                totalIssues += result.issues.length;
                layersWithIssues++;
            }
        });

        return {
            totalLayers: results.length,
            totalIssues: totalIssues,
            layersWithIssues: layersWithIssues
        };
    }

    /**
     * Create a layer card element
     */
    function createLayerCard(result) {
        var card = document.createElement("div");
        card.className = "layer-card" + (result.issues.length > 0 ? " expanded" : "");

        var hasIssues = result.issues.length > 0;

        // Header
        var header = document.createElement("div");
        header.className = "layer-header";
        header.innerHTML =
            '<span class="layer-name">' +
                '<span class="arrow">&#9654;</span>' +
                escapeHtml(result.layer.name) +
            '</span>' +
            '<span class="layer-badge ' + (hasIssues ? "badge-error" : "badge-clean") + '">' +
                (hasIssues ? result.issues.length + " issue" + (result.issues.length > 1 ? "s" : "") : "Clean") +
            '</span>';

        header.addEventListener("click", function () {
            card.classList.toggle("expanded");
        });

        // Body
        var body = document.createElement("div");
        body.className = "layer-body";

        // Annotated text preview
        var preview = document.createElement("div");
        preview.className = "text-preview";
        preview.innerHTML = hasIssues
            ? createAnnotatedText(result.layer.text, result.issues)
            : escapeHtml(result.layer.text);
        body.appendChild(preview);

        // Issue list
        if (hasIssues) {
            var issueList = document.createElement("ul");
            issueList.className = "issue-list";

            result.issues.forEach(function (issue, issueIndex) {
                var item = createIssueItem(issue, result.layer, issueIndex);
                issueList.appendChild(item);
            });

            body.appendChild(issueList);
        }

        card.appendChild(header);
        card.appendChild(body);
        return card;
    }

    /**
     * Create annotated text with highlighted issues
     */
    function createAnnotatedText(text, issues) {
        // Sort issues by offset to build annotated string
        var sorted = issues.slice().sort(function (a, b) {
            return a.offset - b.offset;
        });

        var html = "";
        var lastEnd = 0;

        sorted.forEach(function (issue) {
            // Add text before this issue
            if (issue.offset > lastEnd) {
                html += escapeHtml(text.substring(lastEnd, issue.offset));
            }

            var highlightClass = "error-highlight";
            if (issue.severity === "warning" || issue.type === "grammar") {
                highlightClass = "warning-highlight";
            } else if (issue.severity === "info" || issue.type === "style") {
                highlightClass = "info-highlight";
            }

            var issueText = text.substring(issue.offset, issue.offset + issue.length);
            html += '<span class="' + highlightClass + '" title="' + escapeHtml(issue.message) + '">' +
                    escapeHtml(issueText) + '</span>';

            lastEnd = issue.offset + issue.length;
        });

        // Add remaining text
        if (lastEnd < text.length) {
            html += escapeHtml(text.substring(lastEnd));
        }

        return html;
    }

    /**
     * Create an issue list item with suggestions
     */
    function createIssueItem(issue, layer, issueIndex) {
        var item = document.createElement("li");
        item.className = "issue-item";

        var iconClass = "spelling";
        var iconLabel = "S";
        if (issue.type === "grammar") {
            iconClass = "grammar";
            iconLabel = "G";
        } else if (issue.type === "style") {
            iconClass = "style";
            iconLabel = "T";
        }

        var wrongText = layer.text.substring(issue.offset, issue.offset + issue.length);

        var detailsHtml =
            '<div class="issue-details">' +
                '<div class="issue-message">' + escapeHtml(issue.message) + '</div>' +
                '<div class="issue-context">' +
                    '<span class="wrong">' + escapeHtml(wrongText) + '</span>' +
                '</div>';

        // Suggestions
        if (issue.suggestions && issue.suggestions.length > 0) {
            detailsHtml += '<div class="issue-suggestions">';
            issue.suggestions.slice(0, 5).forEach(function (suggestion) {
                detailsHtml += '<button class="suggestion-btn" data-layer-index="' + layer.index +
                    '" data-offset="' + issue.offset +
                    '" data-length="' + issue.length +
                    '" data-suggestion="' + escapeHtml(suggestion) + '">' +
                    escapeHtml(suggestion) + '</button>';
            });

            // Add "Add to dictionary" button for spelling issues
            if (issue.type === "spelling") {
                detailsHtml += '<button class="suggestion-btn" data-add-word="' +
                    escapeHtml(wrongText) + '" title="Add to custom dictionary">+ Dict</button>';
            }

            detailsHtml += '</div>';
        }

        detailsHtml += '</div>';

        item.innerHTML =
            '<div class="issue-icon ' + iconClass + '">' + iconLabel + '</div>' +
            detailsHtml;

        // Bind suggestion click handlers
        item.querySelectorAll(".suggestion-btn[data-suggestion]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                applySuggestion(
                    parseInt(btn.dataset.layerIndex),
                    parseInt(btn.dataset.offset),
                    parseInt(btn.dataset.length),
                    btn.dataset.suggestion
                );
            });
        });

        // Bind "add to dictionary" handler
        var addWordBtn = item.querySelector(".suggestion-btn[data-add-word]");
        if (addWordBtn) {
            addWordBtn.addEventListener("click", function () {
                CheckerBridge.addToCustomDictionary(addWordBtn.dataset.addWord, extensionPath);
                showToast('Added "' + addWordBtn.dataset.addWord + '" to dictionary');
            });
        }

        return item;
    }

    /**
     * Apply a suggestion by calling ExtendScript to update the layer
     */
    function applySuggestion(layerIndex, offset, length, suggestion) {
        var script = 'replaceTextInLayer(' + layerIndex + ',' + offset + ',' + (offset + length) +
            ',"' + escapeForExtendScript(suggestion) + '")';

        csInterface.evalScript(script, function (response) {
            try {
                var result = JSON.parse(response);
                if (result.success) {
                    showToast("Fix applied");
                    // Trigger a rescan
                    if (typeof App !== "undefined" && App.scan) {
                        App.scan();
                    }
                } else {
                    showToast("Error: " + (result.error || "Unknown error"));
                }
            } catch (e) {
                showToast("Error applying fix");
            }
        });
    }

    /**
     * Show a toast notification
     */
    function showToast(message) {
        var existing = document.querySelector(".toast");
        if (existing) existing.remove();

        var toast = document.createElement("div");
        toast.className = "toast";
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(function () { toast.remove(); }, 2000);
    }

    function escapeHtml(str) {
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function escapeForExtendScript(str) {
        return str
            .replace(/\\/g, "\\\\")
            .replace(/"/g, '\\"')
            .replace(/\n/g, "\\n")
            .replace(/\r/g, "\\r");
    }

    return {
        render: render,
        setExtensionPath: setExtensionPath,
        showToast: showToast
    };
})();
