#!/bin/bash
# Invoice system - run
cd "$(dirname "$0")"

# Node kontrol
if ! command -v node &> /dev/null; then
  echo "❌ Node.js not found."
  echo ""
  echo "To install Node.js:"
  echo "  1. Download from https://nodejs.org"
  echo "  2. Or in Terminal: brew install node"
  echo ""
  exit 1
fi

echo "📦 Installing dependencies..."
npm install

echo ""
echo "🚀 Starting application..."
echo "   Open http://localhost:3000 in your browser"
echo ""
npm run dev
