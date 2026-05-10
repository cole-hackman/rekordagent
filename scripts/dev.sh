#!/usr/bin/env bash
set -euo pipefail

# Bring up the development environment.
# Prerequisites: Rust stable, Node 20+, pnpm 9+

echo "Installing JS dependencies..."
pnpm install

echo "Starting Tauri dev server..."
pnpm --filter desktop tauri dev
