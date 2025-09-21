# 🚀 RadBefund+ Deployment Guide

## Übersicht
Diese Anleitung führt Sie durch das Deployment der RadBefund+ WebApp auf Vercel (Frontend) und Railway (Backend + Database).

## 🎯 Deployment-Architektur

```
Frontend (Next.js) → Vercel
Backend (Node.js)  → Railway
Database (PostgreSQL) → Railway
```

## 📋 Voraussetzungen

### 1. Accounts erstellen
- [Vercel Account](https://vercel.com) (kostenlos)
- [Railway Account](https://railway.app) (kostenlos)
- [GitHub Account](https://github.com) (bereits vorhanden)

### 2. Domain-Konfiguration
- Ihre Strato-Domain bereit
- DNS-Zugang bei Strato

## 🚀 Schritt-für-Schritt Deployment

### Schritt 1: Frontend auf Vercel

1. **Vercel Account erstellen**
   - Gehen Sie zu [vercel.com](https://vercel.com)
   - Melden Sie sich mit GitHub an

2. **Projekt importieren**
   - Klicken Sie auf "New Project"
   - Wählen Sie Ihr GitHub Repository
   - Wählen Sie den `radbefund-web` Ordner

3. **Environment Variables setzen**
   ```
   NEXTAUTH_SECRET=your_secure_secret_here
   JWT_SECRET=your_jwt_secret_here
   OPENAI_API_KEY=your_openai_api_key_here
   ```

4. **Deploy**
   - Klicken Sie auf "Deploy"
   - Warten Sie auf das Deployment

### Schritt 2: Backend auf Railway

1. **Railway Account erstellen**
   - Gehen Sie zu [railway.app](https://railway.app)
   - Melden Sie sich mit GitHub an

2. **Neues Projekt erstellen**
   - Klicken Sie auf "New Project"
   - Wählen Sie "Deploy from GitHub repo"
   - Wählen Sie Ihr Repository
   - Wählen Sie den `backend` Ordner

3. **PostgreSQL Database hinzufügen**
   - Klicken Sie auf "+ New"
   - Wählen Sie "Database" → "PostgreSQL"
   - Warten Sie auf die Erstellung

4. **Environment Variables setzen**
   ```
   # Server
   PORT=3001
   NODE_ENV=production
   
   # Database (automatisch von Railway)
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   
   # JWT
   JWT_SECRET=your_jwt_secret_here
   JWT_REFRESH_SECRET=your_refresh_secret_here
   
   # OpenAI
   OPENAI_API_KEY=your_openai_api_key_here
   AI_MODEL=gpt-4o
   
   # Email
   EMAIL_USER=ahmadh.mustafaa@gmail.com
   EMAIL_PASSWORD=your_gmail_app_password
   FRONTEND_URL=https://your-vercel-domain.vercel.app
   ```

5. **Deploy**
   - Railway startet automatisch das Deployment
   - Warten Sie auf "Deployed"

### Schritt 3: Database Setup

1. **Database Schema anwenden**
   - Gehen Sie zu Ihrem Railway Dashboard
   - Klicken Sie auf die PostgreSQL Database
   - Gehen Sie zu "Query"
   - Führen Sie das Schema aus `backend/database/schema.sql` aus

### Schritt 4: Domain-Konfiguration

1. **Vercel Domain**
   - Gehen Sie zu Ihrem Vercel Dashboard
   - Klicken Sie auf Ihr Projekt
   - Gehen Sie zu "Settings" → "Domains"
   - Fügen Sie Ihre Domain hinzu

2. **Railway Domain**
   - Gehen Sie zu Ihrem Railway Dashboard
   - Klicken Sie auf Ihr Backend-Projekt
   - Gehen Sie zu "Settings" → "Domains"
   - Fügen Sie eine Subdomain hinzu (z.B. `api.ihredomain.de`)

3. **DNS-Einstellungen bei Strato**
   ```
   A Record: @ → Vercel IP
   CNAME: api → Railway Domain
   ```

## 🔧 Environment Variables

### Frontend (Vercel)
```env
NEXTAUTH_SECRET=your_secure_secret_here
JWT_SECRET=your_jwt_secret_here
OPENAI_API_KEY=your_openai_api_key_here
```

### Backend (Railway)
```env
PORT=3001
NODE_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=your_jwt_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here
OPENAI_API_KEY=your_openai_api_key_here
AI_MODEL=gpt-4o
EMAIL_USER=ahmadh.mustafaa@gmail.com
EMAIL_PASSWORD=your_gmail_app_password
FRONTEND_URL=https://your-domain.com
```

## 🧪 Testing

### 1. Frontend testen
- Besuchen Sie Ihre Vercel-URL
- Testen Sie die Anmeldung/Registrierung

### 2. Backend testen
- Besuchen Sie `https://api.ihredomain.de/health`
- Sollte `{"status":"ok","timestamp":"..."}` zurückgeben

### 3. Vollständiger Test
- Registrieren Sie einen neuen Account
- Testen Sie die AI-Befundgenerierung
- Überprüfen Sie die Email-Funktionalität

## 🔍 Troubleshooting

### Häufige Probleme

1. **CORS-Fehler**
   - Überprüfen Sie die `FRONTEND_URL` in Railway
   - Stellen Sie sicher, dass die Domain korrekt ist

2. **Database-Verbindung**
   - Überprüfen Sie die `DATABASE_URL` in Railway
   - Stellen Sie sicher, dass das Schema angewendet wurde

3. **Email-Funktionalität**
   - Überprüfen Sie die Gmail App-Passwort
   - Testen Sie die Email-Konfiguration

## 📞 Support

Bei Problemen:
1. Überprüfen Sie die Logs in Vercel/Railway
2. Testen Sie die Health-Check-Endpoints
3. Überprüfen Sie die Environment Variables

## 🎉 Nach dem Deployment

Ihre WebApp ist jetzt live unter:
- **Frontend**: `https://ihredomain.de`
- **Backend**: `https://api.ihredomain.de`
- **Health Check**: `https://api.ihredomain.de/health`

Viel Erfolg! 🚀
