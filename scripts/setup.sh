#!/bin/bash
# Kurulum scripti - Node.js kurulu olmalı

set -e
cd "$(dirname "$0")/.."

echo "📦 Bağımlılıklar yükleniyor..."
npm install

echo ""
echo "✅ Kurulum tamamlandı."
echo ""
echo "Sonraki adımlar:"
echo "1. .env.local dosyasını düzenleyip Supabase, OpenAI, Resend anahtarlarını ekle"
echo "2. scripts/setup-supabase.md dosyasındaki Supabase adımlarını uygula"
echo "3. npm run dev ile uygulamayı başlat"
echo ""
