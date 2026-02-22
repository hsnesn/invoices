#!/bin/bash
# Fatura sistemi - çalıştır
cd "$(dirname "$0")"

# Node kontrol
if ! command -v node &> /dev/null; then
  echo "❌ Node.js bulunamadı."
  echo ""
  echo "Node.js kurmak için:"
  echo "  1. https://nodejs.org adresinden indir"
  echo "  2. veya Terminal'de: brew install node"
  echo ""
  exit 1
fi

echo "📦 Bağımlılıklar yükleniyor..."
npm install

echo ""
echo "🚀 Uygulama başlatılıyor..."
echo "   Tarayıcıda http://localhost:3000 adresine git"
echo ""
npm run dev
