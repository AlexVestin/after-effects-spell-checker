/**
 * CSInterface - Adobe Common Extensibility Platform Interface
 * Minimal implementation for CEP 12.0
 * For the full version, replace with Adobe's official CSInterface.js from:
 * https://github.com/Adobe-CEP/CEP-Resources/blob/master/CEP_12.x/CSInterface.js
 */

var CSInterface = function () {};

/**
 * Evaluates an ExtendScript expression and returns the result via callback.
 */
CSInterface.prototype.evalScript = function (script, callback) {
    if (callback === null || callback === undefined) {
        callback = function () {};
    }
    if (window.__adobe_cep__) {
        window.__adobe_cep__.evalScript(script, callback);
    } else {
        // Development fallback - simulate response
        console.warn("[CSInterface] Not running in CEP environment. Script:", script);
        if (callback) callback("EvalScript_Not_Available");
    }
};

/**
 * Returns the host environment information.
 */
CSInterface.prototype.getHostEnvironment = function () {
    if (window.__adobe_cep__) {
        var hostEnv = window.__adobe_cep__.getHostEnvironment();
        return JSON.parse(hostEnv);
    }
    return {
        appName: "AEFT",
        appVersion: "25.0",
        appSkinInfo: {
            panelBackgroundColor: { color: { red: 35, green: 35, blue: 35 } },
            baseFontSize: 12
        }
    };
};

/**
 * Returns the system path for the extension.
 */
CSInterface.prototype.getSystemPath = function (pathType) {
    if (window.__adobe_cep__) {
        return window.__adobe_cep__.getSystemPath(pathType);
    }
    return "";
};

/**
 * Registers an event listener for CEP events.
 */
CSInterface.prototype.addEventListener = function (type, listener) {
    if (window.__adobe_cep__) {
        window.__adobe_cep__.addEventListener(type, listener);
    }
};

/**
 * Dispatches a CEP event.
 */
CSInterface.prototype.dispatchEvent = function (event) {
    if (window.__adobe_cep__) {
        window.__adobe_cep__.dispatchEvent(event);
    }
};

/**
 * Requests to open a URL in the default browser.
 */
CSInterface.prototype.openURLInDefaultBrowser = function (url) {
    if (window.__adobe_cep__) {
        window.__adobe_cep__.openURLInDefaultBrowser(url);
    }
};

/**
 * Path type constants
 */
CSInterface.prototype.EXTENSION_PATH = "extension";

/**
 * Theme change event constant
 */
var CSEvent = function (type, scope, appId, extensionId) {
    this.type = type;
    this.scope = scope;
    this.appId = appId;
    this.extensionId = extensionId;
    this.data = "";
};
