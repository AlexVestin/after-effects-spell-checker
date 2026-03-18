/*
 * ExtendScript for After Effects - Text Layer Content Extraction
 * Requires After Effects 25.0+
 */

// JSON polyfill for ExtendScript (in case not natively available)
if (typeof JSON === "undefined") {
    JSON = {};
    JSON.stringify = function (obj) {
        if (obj === null) return "null";
        if (obj === undefined) return undefined;
        if (typeof obj === "string") {
            return '"' + obj.replace(/\\/g, "\\\\")
                            .replace(/"/g, '\\"')
                            .replace(/\n/g, "\\n")
                            .replace(/\r/g, "\\r")
                            .replace(/\t/g, "\\t") + '"';
        }
        if (typeof obj === "number" || typeof obj === "boolean") return String(obj);
        if (obj instanceof Array) {
            var items = [];
            for (var i = 0; i < obj.length; i++) {
                items.push(JSON.stringify(obj[i]));
            }
            return "[" + items.join(",") + "]";
        }
        if (typeof obj === "object") {
            var pairs = [];
            for (var key in obj) {
                if (obj.hasOwnProperty(key)) {
                    pairs.push('"' + key + '":' + JSON.stringify(obj[key]));
                }
            }
            return "{" + pairs.join(",") + "}";
        }
        return String(obj);
    };
}

/**
 * Get all text layers from the active composition.
 * Returns a JSON string with an array of text layer objects.
 */
function getAllTextLayers() {
    var comp = app.project.activeItem;
    if (!comp || !(comp instanceof CompItem)) {
        return JSON.stringify({ error: "No active composition. Please open a composition first." });
    }

    var textLayers = [];

    for (var i = 1; i <= comp.numLayers; i++) {
        var layer = comp.layer(i);
        if (layer instanceof TextLayer) {
            var textProp = layer.property("Source Text");
            var textDocument = textProp.value;
            var textContent = textDocument.text;

            textLayers.push({
                index: i,
                name: layer.name,
                text: textContent,
                compName: comp.name
            });
        }
    }

    return JSON.stringify({
        compName: comp.name,
        layers: textLayers,
        count: textLayers.length
    });
}

/**
 * Get text layers from all compositions in the project.
 * Returns a JSON string with text layers grouped by composition.
 */
function getAllTextLayersFromProject() {
    var result = [];

    for (var i = 1; i <= app.project.numItems; i++) {
        var item = app.project.item(i);
        if (item instanceof CompItem) {
            var compLayers = [];
            for (var j = 1; j <= item.numLayers; j++) {
                var layer = item.layer(j);
                if (layer instanceof TextLayer) {
                    var textProp = layer.property("Source Text");
                    var textDocument = textProp.value;
                    compLayers.push({
                        index: j,
                        name: layer.name,
                        text: textDocument.text,
                        compName: item.name
                    });
                }
            }
            if (compLayers.length > 0) {
                result.push({
                    compName: item.name,
                    compId: item.id,
                    layers: compLayers,
                    count: compLayers.length
                });
            }
        }
    }

    return JSON.stringify(result);
}

/**
 * Update the text content of a specific text layer.
 * @param {number} layerIndex - The 1-based layer index in the active comp
 * @param {string} newText - The new text content to set
 */
function setTextLayerContent(layerIndex, newText) {
    var comp = app.project.activeItem;
    if (!comp || !(comp instanceof CompItem)) {
        return JSON.stringify({ error: "No active composition." });
    }

    var layer = comp.layer(layerIndex);
    if (!layer || !(layer instanceof TextLayer)) {
        return JSON.stringify({ error: "Layer " + layerIndex + " is not a text layer." });
    }

    app.beginUndoGroup("Text Layer Checker - Apply Fix");
    try {
        var textProp = layer.property("Source Text");
        var textDocument = textProp.value;
        textDocument.text = newText;
        textProp.setValue(textDocument);
        app.endUndoGroup();
        return JSON.stringify({ success: true, layerIndex: layerIndex, newText: newText });
    } catch (e) {
        app.endUndoGroup();
        return JSON.stringify({ error: "Failed to update layer: " + e.toString() });
    }
}

/**
 * Replace a specific portion of text in a layer.
 * @param {number} layerIndex - The 1-based layer index
 * @param {number} start - Start character offset
 * @param {number} end - End character offset
 * @param {string} replacement - Replacement text
 */
function replaceTextInLayer(layerIndex, start, end, replacement) {
    var comp = app.project.activeItem;
    if (!comp || !(comp instanceof CompItem)) {
        return JSON.stringify({ error: "No active composition." });
    }

    var layer = comp.layer(layerIndex);
    if (!layer || !(layer instanceof TextLayer)) {
        return JSON.stringify({ error: "Layer " + layerIndex + " is not a text layer." });
    }

    app.beginUndoGroup("Text Layer Checker - Apply Suggestion");
    try {
        var textProp = layer.property("Source Text");
        var textDocument = textProp.value;
        var currentText = textDocument.text;
        var newText = currentText.substring(0, start) + replacement + currentText.substring(end);
        textDocument.text = newText;
        textProp.setValue(textDocument);
        app.endUndoGroup();
        return JSON.stringify({ success: true, layerIndex: layerIndex, newText: newText });
    } catch (e) {
        app.endUndoGroup();
        return JSON.stringify({ error: "Failed to update layer: " + e.toString() });
    }
}
