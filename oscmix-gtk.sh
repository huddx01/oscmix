#!/bin/sh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Kill any running oscmix that is using a stale (replaced) binary so the
# freshly-built binary is always used.  Also kill if it was started from a
# different location to avoid version mismatches.
for pid in $(pgrep -x oscmix 2>/dev/null); do
	exe=$(readlink /proc/$pid/exe 2>/dev/null)
	# /proc/<pid>/exe ends with " (deleted)" when the on-disk binary has
	# been replaced since the process started.
	case "$exe" in
		*" (deleted)") kill "$pid" 2>/dev/null ;;
		"$SCRIPT_DIR/oscmix") ;;  # same binary, reuse it
		*) kill "$pid" 2>/dev/null ;;  # different path, replace it
	esac
done

# Start the backend if it is not already running (with our binary).
if ! pgrep -x oscmix > /dev/null 2>&1; then
	"$SCRIPT_DIR/oscmix" &
	OSCMIX_PID=$!
	trap 'kill $OSCMIX_PID 2>/dev/null' EXIT INT TERM
fi

GSETTINGS_SCHEMA_DIR="$SCRIPT_DIR/gtk" "$SCRIPT_DIR/gtk/oscmix-gtk" "$@"
