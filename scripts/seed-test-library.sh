#!/usr/bin/env bash
set -euo pipefail

# Build the fixture library for integration and manual smoke tests.
# Produces fixtures/tiny-library/master.db plus placeholder audio files.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_PATH="${1:-$ROOT_DIR/fixtures/tiny-library/master.db}"

cd "$ROOT_DIR"
cargo run -q -p rekordbox-db --example seed_test_library -- "$OUTPUT_PATH"
