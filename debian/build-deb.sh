#!/bin/sh
# debian/build-deb.sh - builds oscmix_<version>_<arch>.deb
# Run from repo root: ./debian/build-deb.sh [version]
#
# Version convention:
#   Release:  0.0.1
#   Alpha:    0.0.1~alpha1
#   Custom:   0.0.1~custom202603051944 (default if no arg given)
#   Nightly:  0.0.1~nightly20260305

set -e

VERSION=${1:-0.0.1~custom$(date +%Y%m%d%H%M)}
ARCH=$(dpkg --print-architecture)
PKG="oscmix_${VERSION}_${ARCH}"
DOC_DIR="${PKG}/usr/share/doc/oscmix"

# - Color codes
GREEN="\033[0;32m"
CYAN="\033[0;36m"
BOLD="\033[1m"
RESET="\033[0m"

printf "\n${GREEN}${BOLD}Building ${PKG}.deb ...${RESET}\n"

# - Build C backend
make oscmix
make alsarawio
make alsaseqio

# - Build GTK UI (compiles oscmix-gtk + gschemas.compiled)
make -C gtk

# - Stage package tree
rm -rf "${PKG}"
mkdir -p "${PKG}/DEBIAN"
mkdir -p "${PKG}/usr/bin"
mkdir -p "${PKG}/usr/share/oscmix"
mkdir -p "${PKG}/usr/share/applications"
mkdir -p "${PKG}/usr/share/icons/hicolor/512x512/apps"
mkdir -p "${PKG}/usr/share/man/man1"
mkdir -p "${DOC_DIR}"

# - Binaries
cp oscmix alsarawio alsaseqio   "${PKG}/usr/bin/"
cp gtk/oscmix-gtk               "${PKG}/usr/bin/"

# - Launcher (dual-mode AppRun: works in AppImage and as system binary)
cp gtk/AppRun                   "${PKG}/usr/bin/oscmix-launcher"

# - GTK resources
cp gtk/gschemas.compiled        "${PKG}/usr/share/oscmix/"
cp "doc/img/AppIcon/AppIcon-Dark-512x512@1x.png" \
                        "${PKG}/usr/share/icons/hicolor/512x512/apps/oscmix.png"

# - Man pages (gzip as required by Debian policy)
for page in oscmix alsarawio alsaseqio; do
    gzip -9 -c "doc/${page}.1" > "${PKG}/usr/share/man/man1/${page}.1.gz"
done

# - Desktop entry
cat > "${PKG}/usr/share/applications/oscmix-gtk.desktop" <<EOF
[Desktop Entry]
Name=oscmix
Exec=oscmix-launcher
Icon=oscmix
Type=Application
Categories=AudioVideo;Audio;
Comment=OSC Mixer UI for RME Fireface devices in CC-Mode
EOF

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# - Ensure we run from repo root so make finds all sources
cd "${REPO_ROOT}"

# - copyright file (read from debian/copyright, maintained separately)
if [ ! -f "${SCRIPT_DIR}/copyright" ]; then
    printf "Error: debian/copyright not found. Cannot build package.\n" >&2
    exit 1
fi
cp "${SCRIPT_DIR}/copyright" "${DOC_DIR}/copyright"

# - changelog (generated from git log, gzip as required by Debian policy)
# Format: package (version) distro; urgency=low
#   * commit message
#  -- Maintainer <email>  date
generate_changelog() {
    local pkg_version="$1"
    printf "oscmix (%s) unstable; urgency=low\n" "$pkg_version"
    printf "\n"
    # Last 20 commits, one bullet per commit
    git log --no-walk=unsorted --format="  * %s" -20 2>/dev/null \
        || printf "  * Initial release\n"
    printf "\n"
    printf " -- M. Augustyniak <meg33@sndtek.de>  %s\n" \
        "$(date -R)"
}
generate_changelog "$VERSION" | gzip -9 > "${DOC_DIR}/changelog.Debian.gz"

# - Normalize permissions
# (build machine umask may leave group-write bits on compiled outputs)
chmod 755 "${PKG}/usr/bin/oscmix"
chmod 755 "${PKG}/usr/bin/alsarawio"
chmod 755 "${PKG}/usr/bin/alsaseqio"
chmod 755 "${PKG}/usr/bin/oscmix-gtk"
chmod 755 "${PKG}/usr/bin/oscmix-launcher"
chmod 644 "${PKG}/usr/share/oscmix/gschemas.compiled"
chmod 644 "${PKG}/usr/share/icons/hicolor/512x512/apps/oscmix.png"
chmod 644 "${PKG}/usr/share/applications/oscmix-gtk.desktop"
chmod 644 "${PKG}"/usr/share/man/man1/*.gz
chmod 644 "${DOC_DIR}/copyright"
chmod 644 "${DOC_DIR}/changelog.Debian.gz"

# - DEBIAN/control (trailing newline required by Debian policy)
cat > "${PKG}/DEBIAN/control" <<EOF
Package: oscmix
Version: ${VERSION}
Section: sound
Priority: optional
Architecture: ${ARCH}
Depends: libgtk-3-0, libglib2.0-0, libasound2, zenity
Maintainer: M. Augustyniak <meg33@sndtek.de>
Homepage: https://github.com/huddx01/oscmix
Description: OSC Mixer UI for RME Fireface devices in CC-Mode
 GTK frontend for oscmix, currently supported: RME Fireface 802, UCX,
 UCX II, UFX+, UFX II, UFX III.
 .
 oscmix implements an OSC bridge for RME Fireface devices running in
 class-compliant mode on Linux and macOS.
 .
 Screenshot: https://raw.githubusercontent.com/huddx01/oscmix/main/doc/gtk.png

EOF

dpkg-deb --root-owner-group --build "${PKG}"

printf "\n${GREEN}${BOLD}✓ Done: ${PKG}.deb${RESET}\n"
printf "\n${BOLD}Install:${RESET}\n"
printf "  ${CYAN}sudo dpkg -i ${PKG}.deb${RESET}\n"
printf "\n${BOLD}Uninstall:${RESET}\n"
printf "  ${CYAN}sudo dpkg -r oscmix${RESET}\n\n"
