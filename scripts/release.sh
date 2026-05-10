#!/usr/bin/env bash
set -euo pipefail

# Tag and trigger a release build.
# Usage: ./scripts/release.sh 0.1.0

VERSION="${1:?usage: release.sh <version>}"

echo "Tagging v${VERSION}..."
git tag -s "v${VERSION}" -m "Release v${VERSION}"
git push origin "v${VERSION}"
echo "Tag pushed. CI will build notarized macOS dmg, signed Windows msi, and Linux AppImage."
