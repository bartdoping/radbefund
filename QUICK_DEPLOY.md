# 🚀 Schnelles Deployment - RadBefund+

## ⚡ In 5 Minuten live!

### 1. Vercel (Frontend) - 2 Minuten

1. **Gehen Sie zu [vercel.com](https://vercel.com)**
2. **Klicken Sie auf "New Project"**
3. **Wählen Sie Ihr GitHub Repository**
4. **Wählen Sie den `radbefund-web` Ordner**
5. **Setzen Sie diese Environment Variables:**
   ```
   NEXTAUTH_SECRET=your_secure_secret_here
   JWT_SECRET=your_jwt_secret_here
   OPENAI_API_KEY=your_openai_api_key_here
   ```
6. **Klicken Sie auf "Deploy"**

### 2. Railway (Backend + Database) - 3 Minuten

1. **Gehen Sie zu [railway.app](https://railway.app)**
2. **Klicken Sie auf "New Project"**
3. **Wählen Sie "Deploy from GitHub repo"**
4. **Wählen Sie Ihr Repository und den `backend` Ordner**
5. **Fügen Sie PostgreSQL Database hinzu:**
   - Klicken Sie auf "+ New" → "Database" → "PostgreSQL"
6. **Setzen Sie diese Environment Variables:**
   ```
   NODE_ENV=production
   JWT_SECRET=your_jwt_secret_here
   JWT_REFRESH_SECRET=your_jwt_secret_here
   OPENAI_API_KEY=your_openai_api_key_here
   AI_MODEL=gpt-4o
   EMAIL_USER=ahmadh.mustafaa@gmail.com
   EMAIL_PASSWORD=your_gmail_app_password
   FRONTEND_URL=https://your-vercel-domain.vercel.app
   ```
7. **Warten Sie auf "Deployed"**

### 3. Database Schema anwenden

1. **Gehen Sie zu Ihrem Railway Dashboard**
2. **Klicken Sie auf die PostgreSQL Database**
3. **Gehen Sie zu "Query"**
4. **Führen Sie das Schema aus `backend/database/schema.sql` aus**

### 4. Domain-Konfiguration (Optional)

1. **Vercel Domain hinzufügen:**
   - Vercel Dashboard → Ihr Projekt → Settings → Domains
   - Fügen Sie Ihre Domain hinzu

2. **Railway Domain hinzufügen:**
   - Railway Dashboard → Ihr Backend-Projekt → Settings → Domains
   - Fügen Sie eine Subdomain hinzu (z.B. `api.ihredomain.de`)

3. **DNS bei Strato konfigurieren:**
   ```
   A Record: @ → Vercel IP
   CNAME: api → Railway Domain
   ```

## 🎉 Fertig!

Ihre WebApp ist jetzt live unter:
- **Frontend**: `https://your-vercel-domain.vercel.app`
- **Backend**: `https://your-railway-domain.railway.app`
- **Health Check**: `https://your-railway-domain.railway.app/health`

## 🧪 Testen

1. **Besuchen Sie Ihre Vercel-URL**
2. **Registrieren Sie einen neuen Account**
3. **Testen Sie die AI-Befundgenerierung**
4. **Überprüfen Sie die Email-Funktionalität**

## 🔧 Troubleshooting

- **CORS-Fehler**: Überprüfen Sie die `FRONTEND_URL` in Railway
- **Database-Fehler**: Stellen Sie sicher, dass das Schema angewendet wurde
- **Email-Fehler**: Überprüfen Sie das Gmail App-Passwort

Viel Erfolg! 🚀
