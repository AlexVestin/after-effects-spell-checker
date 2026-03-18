/**
 * Theme Manager - Syncs panel colors with the AE host theme
 */
var ThemeManager = (function () {
    var csInterface = new CSInterface();

    function toHex(colorObj) {
        var r = Math.round(colorObj.red);
        var g = Math.round(colorObj.green);
        var b = Math.round(colorObj.blue);
        return "#" +
            ("0" + r.toString(16)).slice(-2) +
            ("0" + g.toString(16)).slice(-2) +
            ("0" + b.toString(16)).slice(-2);
    }

    function lighten(hex, amount) {
        var r = parseInt(hex.slice(1, 3), 16);
        var g = parseInt(hex.slice(3, 5), 16);
        var b = parseInt(hex.slice(5, 7), 16);
        r = Math.min(255, r + amount);
        g = Math.min(255, g + amount);
        b = Math.min(255, b + amount);
        return "#" +
            ("0" + r.toString(16)).slice(-2) +
            ("0" + g.toString(16)).slice(-2) +
            ("0" + b.toString(16)).slice(-2);
    }

    function applyTheme() {
        try {
            var hostEnv = csInterface.getHostEnvironment();
            var skinInfo = hostEnv.appSkinInfo;
            if (!skinInfo || !skinInfo.panelBackgroundColor) return;

            var bgColor = toHex(skinInfo.panelBackgroundColor.color);
            var root = document.documentElement;

            root.style.setProperty("--bg-primary", bgColor);
            root.style.setProperty("--bg-secondary", lighten(bgColor, 10));
            root.style.setProperty("--bg-tertiary", lighten(bgColor, 22));
            root.style.setProperty("--bg-hover", lighten(bgColor, 34));
            root.style.setProperty("--border-color", lighten(bgColor, 18));

            // Determine if light or dark theme
            var brightness = parseInt(bgColor.slice(1, 3), 16);
            if (brightness > 128) {
                root.style.setProperty("--text-primary", "#1a1a1a");
                root.style.setProperty("--text-secondary", "#555555");
                root.style.setProperty("--text-muted", "#888888");
            }
        } catch (e) {
            console.log("[ThemeManager] Could not apply host theme:", e);
        }
    }

    return {
        init: function () {
            applyTheme();
            csInterface.addEventListener("com.adobe.csxs.events.ThemeColorChanged", applyTheme);
        }
    };
})();
