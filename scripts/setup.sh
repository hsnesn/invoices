#!/bin/bash
# Setup script - Node.js must be installed

set -e
cd "$(dirname "$0")/.."

echo "📦 Installing dependencies..."
npm install

echo ""
echo "✅ Setup complete."
echo ""
echo "Next steps:"
echo "1. Edit .env.local and add Supabase, OpenAI, Resend keys"
echo "2. Apply Supabase steps from scripts/setup-supabase.md"
echo "3. Start the app with npm run dev"
echo ""
