#!/bin/sh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Start the backend in the background if it's not already running
if ! pgrep -x oscmix > /dev/null 2>&1; then
	"$SCRIPT_DIR/oscmix" &
	OSCMIX_PID=$!
	trap 'kill $OSCMIX_PID 2>/dev/null' EXIT INT TERM
fi

GSETTINGS_SCHEMA_DIR="$SCRIPT_DIR/gtk" exec "$SCRIPT_DIR/gtk/oscmix-gtk" "$@"
