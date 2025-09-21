#!/bin/bash

# Railway Start Script für RadBefund+ Backend

echo "🚀 Starting RadBefund+ Backend..."

# Installiere Dependencies falls nötig
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Starte den Server
echo "🌟 Starting server..."
node simple-server.js
