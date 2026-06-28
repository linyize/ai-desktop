#!/bin/bash

set -e

echo "=== AI Desktop Build Script ==="

check_command() {
  if ! command -v $1 &> /dev/null; then
    echo "❌ Missing required dependency: $1"
    exit 1
  fi
  echo "✓ $1 found"
}

echo ""
echo "Checking dependencies..."
check_command rustc
check_command cargo
check_command node
check_command npm

if ! command -v tauri &> /dev/null; then
  echo "Installing Tauri CLI..."
  npm install -g @tauri-apps/cli
fi

echo ""
echo "Installing Node.js dependencies..."
cd "$(dirname "$0")"
npm ci || npm install

echo ""
echo "Building release package..."
cd src-tauri
cargo tauri build --release

echo ""
echo "=== Build complete! ==="
echo "Artifacts located in: src-tauri/target/release/bundle/"
