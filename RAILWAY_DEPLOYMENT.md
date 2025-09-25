# Railway Backend Deployment Guide

## 1. Railway Account Setup

1. Gehen Sie zu [railway.app](https://railway.app)
2. Melden Sie sich mit GitHub an
3. Erstellen Sie ein neues Projekt

## 2. Backend Deployment

### Schritt 1: Repository verbinden
1. Klicken Sie auf "New Project"
2. Wählen Sie "Deploy from GitHub repo"
3. Wählen Sie Ihr Repository: `radbefund-plus-word-addin`
4. Wählen Sie den Branch: `main`
5. Wählen Sie den Root Directory: `backend`

### Schritt 2: Environment Variables setzen
Fügen Sie folgende Umgebungsvariablen in Railway hinzu:

```
NODE_ENV=production
PORT=3001
JWT_SECRET=your-super-secret-jwt-key-for-production
OPENAI_API_KEY=your-openai-api-key-here
EMAIL_USER=ahmadh.mustafaa@gmail.com
EMAIL_PASS=twdv ffya eceu dzcl
FRONTEND_URL=https://www.mylovelu.de
```

### Schritt 3: PostgreSQL Database hinzufügen
1. Klicken Sie auf "New" → "Database" → "PostgreSQL"
2. Railway erstellt automatisch eine PostgreSQL-Datenbank
3. Die Verbindungsdaten werden automatisch als Umgebungsvariablen gesetzt:
   - `DATABASE_URL`
   - `PGHOST`
   - `PGPORT`
   - `PGDATABASE`
   - `PGUSER`
   - `PGPASSWORD`

### Schritt 4: Domain konfigurieren
1. Gehen Sie zu "Settings" → "Domains"
2. Fügen Sie eine Custom Domain hinzu: `api.mylovelu.de`
3. Railway generiert automatisch ein SSL-Zertifikat

## 3. DNS Konfiguration

### In Strato DNS-Einstellungen:
Fügen Sie einen CNAME-Record hinzu:
```
Typ: CNAME
Name: api
Wert: [Railway-generated-domain].up.railway.app
TTL: 3600
```

## 4. Deployment Status prüfen

Nach dem Deployment sollten folgende Endpoints verfügbar sein:
- `https://api.mylovelu.de/health` - Health Check
- `https://api.mylovelu.de/auth/login` - Login Endpoint
- `https://api.mylovelu.de/structured` - AI Processing Endpoint

## 5. Troubleshooting

### Logs prüfen:
1. Gehen Sie zu Railway Dashboard
2. Klicken Sie auf Ihr Backend-Service
3. Gehen Sie zu "Deployments" → "View Logs"

### Häufige Probleme:
- **Database Connection Error**: Prüfen Sie die DATABASE_URL Umgebungsvariable
- **CORS Error**: Stellen Sie sicher, dass FRONTEND_URL korrekt gesetzt ist
- **OpenAI API Error**: Prüfen Sie den OPENAI_API_KEY

## 6. Automatische Deployments

Railway deployt automatisch bei jedem Git Push zum main Branch.
