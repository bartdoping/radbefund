#!/bin/bash

# 🚀 RadBefund+ Deployment Script
# Dieses Script hilft beim Deployment auf Vercel und Railway

echo "🚀 RadBefund+ Deployment Script"
echo "================================"

# Farben für Output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funktionen
print_step() {
    echo -e "${BLUE}📋 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Prüfe ob Vercel CLI installiert ist
check_vercel_cli() {
    if ! command -v vercel &> /dev/null; then
        print_warning "Vercel CLI nicht gefunden. Installiere..."
        npm install -g vercel
    fi
    print_success "Vercel CLI ist verfügbar"
}

# Prüfe ob Railway CLI installiert ist
check_railway_cli() {
    if ! command -v railway &> /dev/null; then
        print_warning "Railway CLI nicht gefunden. Installiere..."
        npm install -g @railway/cli
    fi
    print_success "Railway CLI ist verfügbar"
}

# Frontend auf Vercel deployen
deploy_frontend() {
    print_step "Deploye Frontend auf Vercel..."
    
    cd radbefund-web
    
    # Vercel Login
    print_step "Vercel Login..."
    vercel login
    
    # Deploy
    print_step "Deploye auf Vercel..."
    vercel --prod
    
    print_success "Frontend erfolgreich auf Vercel deployed!"
    
    cd ..
}

# Backend auf Railway deployen
deploy_backend() {
    print_step "Deploye Backend auf Railway..."
    
    cd backend
    
    # Railway Login
    print_step "Railway Login..."
    railway login
    
    # Neues Projekt erstellen
    print_step "Erstelle Railway Projekt..."
    railway init
    
    # Deploy
    print_step "Deploye auf Railway..."
    railway up
    
    print_success "Backend erfolgreich auf Railway deployed!"
    
    cd ..
}

# Environment Variables setzen
setup_env_vars() {
    print_step "Environment Variables Setup..."
    
    echo "Bitte geben Sie die folgenden Werte ein:"
    
    read -p "NEXTAUTH_SECRET: " nextauth_secret
    read -p "JWT_SECRET: " jwt_secret
    read -p "OPENAI_API_KEY: " openai_key
    read -p "Gmail App Password: " gmail_password
    read -p "Ihre Domain (z.B. ihredomain.de): " domain
    
    # Vercel Environment Variables
    print_step "Setze Vercel Environment Variables..."
    cd radbefund-web
    vercel env add NEXTAUTH_SECRET
    vercel env add JWT_SECRET
    vercel env add OPENAI_API_KEY
    cd ..
    
    # Railway Environment Variables
    print_step "Setze Railway Environment Variables..."
    cd backend
    railway variables set NODE_ENV=production
    railway variables set JWT_SECRET="$jwt_secret"
    railway variables set JWT_REFRESH_SECRET="$jwt_secret"
    railway variables set OPENAI_API_KEY="$openai_key"
    railway variables set AI_MODEL=gpt-4o
    railway variables set EMAIL_USER=ahmadh.mustafaa@gmail.com
    railway variables set EMAIL_PASSWORD="$gmail_password"
    railway variables set FRONTEND_URL="https://$domain"
    cd ..
    
    print_success "Environment Variables gesetzt!"
}

# Database Setup
setup_database() {
    print_step "Database Setup..."
    
    cd backend
    
    # PostgreSQL Database hinzufügen
    print_step "Füge PostgreSQL Database hinzu..."
    railway add postgresql
    
    # Database Schema anwenden
    print_step "Wende Database Schema an..."
    railway run node scripts/setup-database.js
    
    print_success "Database erfolgreich eingerichtet!"
    
    cd ..
}

# Domain-Konfiguration
setup_domain() {
    print_step "Domain-Konfiguration..."
    
    read -p "Ihre Domain (z.B. ihredomain.de): " domain
    
    # Vercel Domain
    print_step "Konfiguriere Vercel Domain..."
    cd radbefund-web
    vercel domains add "$domain"
    cd ..
    
    # Railway Domain
    print_step "Konfiguriere Railway Domain..."
    cd backend
    railway domain
    cd ..
    
    print_success "Domain-Konfiguration abgeschlossen!"
    print_warning "Bitte konfigurieren Sie die DNS-Einstellungen bei Strato:"
    echo "  A Record: @ → Vercel IP"
    echo "  CNAME: api → Railway Domain"
}

# Hauptmenü
main_menu() {
    echo ""
    echo "Was möchten Sie tun?"
    echo "1) Vollständiges Deployment (Frontend + Backend + Database)"
    echo "2) Nur Frontend auf Vercel"
    echo "3) Nur Backend auf Railway"
    echo "4) Environment Variables setzen"
    echo "5) Database Setup"
    echo "6) Domain-Konfiguration"
    echo "7) Beenden"
    echo ""
    read -p "Wählen Sie eine Option (1-7): " choice
    
    case $choice in
        1)
            check_vercel_cli
            check_railway_cli
            setup_env_vars
            deploy_frontend
            deploy_backend
            setup_database
            setup_domain
            print_success "Vollständiges Deployment abgeschlossen! 🎉"
            ;;
        2)
            check_vercel_cli
            deploy_frontend
            ;;
        3)
            check_railway_cli
            deploy_backend
            ;;
        4)
            setup_env_vars
            ;;
        5)
            check_railway_cli
            setup_database
            ;;
        6)
            setup_domain
            ;;
        7)
            print_success "Auf Wiedersehen! 👋"
            exit 0
            ;;
        *)
            print_error "Ungültige Option. Bitte wählen Sie 1-7."
            main_menu
            ;;
    esac
}

# Script starten
echo "Willkommen beim RadBefund+ Deployment Script!"
echo "Dieses Script hilft Ihnen beim Deployment auf Vercel und Railway."
echo ""

# Prüfe ob wir im richtigen Verzeichnis sind
if [ ! -d "radbefund-web" ] || [ ! -d "backend" ]; then
    print_error "Bitte führen Sie dieses Script aus dem Hauptverzeichnis des Projekts aus."
    exit 1
fi

main_menu
