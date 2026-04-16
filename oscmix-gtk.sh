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

# oscmix needs MIDI fds 6/7 set up. On Linux, oscmix can self-open via
# /dev/snd/controlC*. On macOS the CoreMIDI API is only reachable via the
# coremidiio helper, so wrap the backend in that and auto-pick the last
# Fireface port (same "last port" convention as the Linux side).
start_backend_macos() {
	# Emit "<index>\t<name>" for the last Fireface source — "last port" is
	# the convention used by alsarawio (Linux) and the README.  Export
	# MIDIPORT so oscmix can pick the device without -p; coremidiio cannot
	# resolve it itself because touching CoreMIDI before its spawn()/fork
	# causes MIDIClientCreate to fail with OSStatus -304.
	line=$(
		"$SCRIPT_DIR/coremidiio" -l 2>/dev/null \
			| awk -F'\t' '
				/^Sources:/     { section = "src"; next }
				/^Destinations:/ { exit }
				section == "src" && /Fireface/ {
					idx  = $1
					name = $2
				}
				END { if (idx != "") printf "%s\t%s\n", idx, name }
			'
	)
	if [ -z "$line" ]; then
		echo "oscmix-gtk.sh: no Fireface source found in coremidiio -l" >&2
		echo "oscmix-gtk.sh: launching GTK anyway; UI will show scanning" >&2
		return 1
	fi
	port=${line%%	*}
	name=${line#*	}
	MIDIPORT=$name \
		"$SCRIPT_DIR/coremidiio" -f 6,7 -p "$port" "$SCRIPT_DIR/oscmix" &
	OSCMIX_PID=$!
	trap 'kill $OSCMIX_PID 2>/dev/null' EXIT INT TERM
}

start_backend_linux() {
	"$SCRIPT_DIR/oscmix" &
	OSCMIX_PID=$!
	trap 'kill $OSCMIX_PID 2>/dev/null' EXIT INT TERM
}

if ! pgrep -x oscmix > /dev/null 2>&1; then
	case "$(uname -s)" in
		Darwin) start_backend_macos || true ;;
		*)      start_backend_linux ;;
	esac
fi

GSETTINGS_SCHEMA_DIR="$SCRIPT_DIR/gtk" "$SCRIPT_DIR/gtk/oscmix-gtk" "$@"
