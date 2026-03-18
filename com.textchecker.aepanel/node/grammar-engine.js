/**
 * Grammar Engine - Node.js module for grammar and spell checking.
 * Primary: harper.js (WASM-based, offline grammar + spelling)
 * Fallback: typo-js (pure JS, spelling only)
 *
 * harper.js is an ESM module, so we use dynamic import().
 */

var path = require("path");
var linterInstance = null;
var typoInstance = null;
var usingFallback = false;

/**
 * Initialize harper.js as the primary grammar engine.
 * Uses dynamic import() since harper.js is ESM-only.
 */
async function init(extensionPath) {
    try {
        var harper = await import("harper.js");
        linterInstance = new harper.LocalLinter();
        await linterInstance.setup();
        usingFallback = false;
    } catch (e) {
        throw new Error("harper.js init failed: " + e.message);
    }
}

/**
 * Initialize typo-js as the fallback spell checker
 */
async function initFallback(extensionPath) {
    try {
        var Typo = require("typo-js");
        typoInstance = new Typo("en_US");
        usingFallback = true;
    } catch (e) {
        throw new Error("typo-js not found. Run 'npm install' in the extension directory. " + e.message);
    }
}

/**
 * Check text for grammar and spelling issues
 * @param {string} text - The text to check
 * @param {string[]} customWords - Words to ignore
 * @returns {Promise<Array<Issue>>} Array of issues found
 */
async function check(text, customWords) {
    if (usingFallback) {
        return checkWithTypo(text, customWords);
    }
    return checkWithHarper(text, customWords);
}

/**
 * Check with harper.js (grammar + spelling)
 */
async function checkWithHarper(text, customWords) {
    var customSet = new Set((customWords || []).map(function (w) { return w.toLowerCase(); }));
    var issues = [];

    try {
        var lints = await linterInstance.lint(text, { language: "plaintext" });

        for (var i = 0; i < lints.length; i++) {
            var lint = lints[i];
            var span = lint.span();
            var problemText = text.substring(span.start, span.end);

            // Skip custom dictionary words
            if (customSet.has(problemText.toLowerCase())) continue;

            var lintKind = lint.lint_kind();
            var issueType = "grammar";
            if (lintKind === "Spelling" || lintKind === "spelling") {
                issueType = "spelling";
            } else if (lintKind === "Capitalization" || lintKind === "Repetition") {
                issueType = "style";
            }

            var suggestions = [];
            if (lint.suggestion_count() > 0) {
                var sugs = lint.suggestions();
                for (var j = 0; j < sugs.length; j++) {
                    var sug = sugs[j];
                    // kind: 0 = Replace, 1 = Remove, 2 = InsertAfter
                    var kind = sug.kind();
                    if (kind === 1) {
                        suggestions.push("(remove)");
                    } else {
                        suggestions.push(sug.get_replacement_text());
                    }
                }
            }

            issues.push({
                offset: span.start,
                length: span.end - span.start,
                message: lint.message(),
                type: issueType,
                severity: issueType === "spelling" ? "error" : "warning",
                suggestions: suggestions
            });
        }
    } catch (e) {
        console.error("[GrammarEngine] Harper check failed:", e);
    }

    return issues;
}

/**
 * Check with typo-js (spelling only fallback)
 */
function checkWithTypo(text, customWords) {
    var customSet = new Set((customWords || []).map(function (w) { return w.toLowerCase(); }));
    var issues = [];

    // Tokenize the text into words with their positions
    var wordRegex = /[a-zA-Z'\u2019]+/g;
    var match;

    while ((match = wordRegex.exec(text)) !== null) {
        var word = match[0];
        var offset = match.index;

        // Skip single characters
        if (word.length <= 1) continue;

        // Skip if in custom dictionary
        if (customSet.has(word.toLowerCase())) continue;

        // Check spelling
        if (!typoInstance.check(word)) {
            var suggestions = typoInstance.suggest(word, 5);
            issues.push({
                offset: offset,
                length: word.length,
                message: '"' + word + '" may be misspelled',
                type: "spelling",
                severity: "error",
                suggestions: suggestions
            });
        }
    }

    return Promise.resolve(issues);
}

module.exports = {
    init: init,
    initFallback: initFallback,
    check: check
};
