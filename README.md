# Text Layer Checker

A CEP panel for Adobe After Effects that scans text layers for typos and grammar issues. Runs entirely offline using [harper.js](https://writewithharper.com/) (WASM-based grammar and spell checker).

**Minimum version:** After Effects 25.0 (2025)

## Features

- Scans all text layers in the active composition or entire project
- Grammar and spelling detection with inline suggestions
- Click a suggestion to apply it directly to the text layer (with full undo support)
- Custom dictionary for motion graphics terminology
- Option to ignore ALL CAPS text and short layers
- Panel theme syncs with After Effects

## Installation

### macOS

```bash
git clone <repo-url>
cd after-effects-plugin-text
./install.sh
```

This will:
1. Install npm dependencies (`harper.js`, `typo-js`)
2. Symlink the extension into `~/Library/Application Support/Adobe/CEP/extensions/`
3. Enable unsigned extensions for CEP 12

### Windows

1. Install dependencies:
   ```
   cd com.textchecker.aepanel
   npm install
   ```
2. Copy or symlink `com.textchecker.aepanel` into:
   ```
   %APPDATA%\Adobe\CEP\extensions\
   ```
3. Enable unsigned extensions by adding a registry key:
   ```
   HKEY_CURRENT_USER\Software\Adobe\CSXS.12
   Name: PlayerDebugMode
   Type: REG_SZ
   Value: 1
   ```

### After installation

1. Restart After Effects
2. Go to **Window → Extensions → Text Layer Checker**

## Usage

1. Open a composition that contains text layers
2. Click **Scan Text Layers** to check the active comp, or **Scan All Comps** to check every composition in the project
3. Issues appear grouped by layer with color-coded highlights:
   - **Red** — spelling errors
   - **Orange** — grammar issues
   - **Blue** — style suggestions (capitalization, repetition)
4. Click a suggestion to apply it to the layer, or click **+ Dict** to add a word to your custom dictionary

## Settings

Click the gear icon to configure:

- **Custom Dictionary** — words that should never be flagged (e.g. `rotoscope`, `keyframe`)
- **Ignore ALL CAPS** — skip layers where all text is uppercase
- **Ignore short layers** — skip layers with fewer than 3 words

A default dictionary of common motion graphics terms is included.

## Project Structure

```
com.textchecker.aepanel/
├── CSXS/manifest.xml            # CEP 12 manifest (AEFT 25+)
├── host/index.jsx               # ExtendScript — reads/writes AE text layers
├── client/
│   ├── index.html               # Panel UI
│   ├── css/panel.css            # Styles (AE dark theme)
│   ├── js/main.js               # Panel controller
│   ├── js/checker-bridge.js     # UI ↔ grammar engine bridge
│   ├── js/results-renderer.js   # Annotated results display
│   ├── js/CSInterface.js        # Adobe CEP interface
│   └── lib/themeManager.js      # Host theme sync
├── node/grammar-engine.js       # Grammar checking (harper.js + typo-js fallback)
├── dictionaries/custom-words.txt
├── package.json
└── .debug                       # Dev debug config (port 8088)
```

## How It Works

1. **ExtendScript** (`host/index.jsx`) iterates over layers in the active composition, filters for `TextLayer` instances, and extracts content via `TextDocument.text`
2. Text is passed to the **Node.js grammar engine** through CEP's built-in `cep_node` runtime
3. **harper.js** (Rust compiled to WASM) performs grammar and spelling analysis offline. If WASM initialization fails, **typo-js** (pure JS Hunspell-compatible spellchecker) is used as a fallback
4. Results are rendered in the panel with highlighted errors and clickable suggestions
5. Applying a fix calls back into ExtendScript to update the layer's `Source Text` property, wrapped in an undo group

## Development

Enable Chrome DevTools debugging on port 8088 (configured in `.debug`):

```
http://localhost:8088
```

To use a production copy instead of a symlink:

```bash
./install.sh --copy
```

## License

MIT
