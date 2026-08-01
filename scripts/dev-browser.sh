#!/bin/bash
# Opens a Chromium-based browser with web security disabled for dev.
# This allows direct API calls to Splice without CORS restrictions.

DEV_URL="http://localhost:1337"
PROFILE_DIR="/tmp/splice-tab-dev-profile"

echo "🚀 Launching dev browser (CORS disabled)..."
echo "   URL: $DEV_URL"
echo "   Profile: $PROFILE_DIR"

# Try Arc first (most common on macOS), then Chrome, then Chromium
if [ -d "/Applications/Arc.app" ]; then
    open -na "Arc" --args \
        --disable-web-security \
        --user-data-dir="$PROFILE_DIR" \
        --no-first-run \
        "$DEV_URL"
elif [ -d "/Applications/Google Chrome.app" ]; then
    open -na "Google Chrome" --args \
        --disable-web-security \
        --user-data-dir="$PROFILE_DIR" \
        --no-first-run \
        "$DEV_URL"
elif [ -d "/Applications/Chromium.app" ]; then
    open -na "Chromium" --args \
        --disable-web-security \
        --user-data-dir="$PROFILE_DIR" \
        --no-first-run \
        "$DEV_URL"
else
    echo "❌ No supported browser found (Arc, Chrome, Chromium)."
    echo "   Please manually open: $DEV_URL"
    exit 1
fi

echo "✅ Browser launched. (Note: CORS is disabled — only use for development!)"
