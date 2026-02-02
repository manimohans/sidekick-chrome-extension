#!/bin/bash

# Bundle Sidekick extension for Chrome Web Store submission

OUTPUT_NAME="sidekick-extension.zip"
OUTPUT_PATH=~/Downloads/$OUTPUT_NAME

# Remove old bundle if exists
rm -f "$OUTPUT_PATH"

# Create zip with only required files
zip -r "$OUTPUT_PATH" \
    manifest.json \
    background.js \
    sidepanel.html \
    sidepanel.js \
    options.html \
    options.js \
    styles.css \
    cors_rules.json \
    marked.min.js \
    icons/ \
    assets/ \
    -x "*.DS_Store" -x "*/.DS_Store"

echo "Created: $OUTPUT_PATH"
echo "Size: $(du -h "$OUTPUT_PATH" | cut -f1)"
