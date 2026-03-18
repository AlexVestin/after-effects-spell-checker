#!/bin/bash
#
# Text Layer Checker - Installation Script for macOS
# Installs the CEP panel for After Effects 25+
#

EXTENSION_ID="com.textchecker.aepanel"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SOURCE_DIR="$SCRIPT_DIR/$EXTENSION_ID"
CEP_DIR="$HOME/Library/Application Support/Adobe/CEP/extensions"
TARGET_DIR="$CEP_DIR/$EXTENSION_ID"

echo "=== Text Layer Checker Installer ==="
echo ""

# Check source exists
if [ ! -d "$SOURCE_DIR" ]; then
    echo "Error: Extension source not found at $SOURCE_DIR"
    exit 1
fi

# Install npm dependencies if needed
if [ ! -d "$SOURCE_DIR/node_modules" ]; then
    echo "Installing npm dependencies..."
    cd "$SOURCE_DIR" && npm install
    if [ $? -ne 0 ]; then
        echo "Error: npm install failed"
        exit 1
    fi
fi

# Create CEP extensions directory
mkdir -p "$CEP_DIR"

# Remove old installation if present
if [ -d "$TARGET_DIR" ] || [ -L "$TARGET_DIR" ]; then
    echo "Removing previous installation..."
    rm -rf "$TARGET_DIR"
fi

# Create symlink (for development) or copy (for production)
if [ "$1" = "--copy" ]; then
    echo "Copying extension to $TARGET_DIR..."
    cp -R "$SOURCE_DIR" "$TARGET_DIR"
else
    echo "Creating symlink to $TARGET_DIR..."
    ln -s "$SOURCE_DIR" "$TARGET_DIR"
fi

# Enable unsigned extensions for CEP 12 (required for development)
echo "Enabling unsigned extensions for CEP 12..."
defaults write com.adobe.CSXS.12 PlayerDebugMode 1

echo ""
echo "Installation complete!"
echo ""
echo "Next steps:"
echo "  1. Restart After Effects if it's running"
echo "  2. Go to Window > Extensions > Text Layer Checker"
echo "  3. Open a composition with text layers and click 'Scan Text Layers'"
echo ""
echo "To uninstall, run: rm -rf \"$TARGET_DIR\""
