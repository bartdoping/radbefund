# Email-Konfiguration für RadBefund+

## Gmail App Password Setup

Um die Email-Funktionalität zu aktivieren, müssen Sie ein Gmail App Password erstellen:

### 1. Gmail App Password erstellen

1. Gehen Sie zu Ihrem Google Account: https://myaccount.google.com/
2. Navigieren Sie zu "Sicherheit" → "2-Schritt-Verifizierung"
3. Scrollen Sie nach unten zu "App-Passwörter"
4. Wählen Sie "App" → "Mail" und "Gerät" → "Mac" (oder Ihr Gerät)
5. Kopieren Sie das generierte 16-stellige Passwort

### 2. Backend .env Datei konfigurieren

Erstellen Sie eine `.env` Datei im `backend/` Verzeichnis mit folgendem Inhalt:

```env
# Email Configuration
EMAIL_USER=ahmadh.mustafaa@gmail.com
EMAIL_PASSWORD=twdv ffya eceu dzcl
EMAIL_APP_PASSWORD=twdv ffya eceu dzcl
FRONTEND_URL=http://localhost:3002
```

### 3. Features

Nach der Konfiguration sind folgende Features verfügbar:

#### ✅ Email-Eindeutigkeit
- Eine Email kann nur einmal registriert werden
- Bei bereits existierender Email wird ein Hinweis angezeigt
- Möglichkeit zur direkten Anmeldung wird angeboten

#### ✅ Email-Verifizierung
- 6-stelliger Verifizierungscode wird per Email gesendet
- Code ist 15 Minuten gültig
- Registrierung wird erst nach Verifizierung abgeschlossen

#### ✅ Passwort-Reset
- "Passwort vergessen" Link in der Anmeldung
- **Schritt 1**: Email-Adresse eingeben und bestätigen
- **Schritt 2**: Reset-Link wird per Email gesendet
- **Schritt 3**: Token aus Email eingeben und neues Passwort setzen
- Link ist 1 Stunde gültig
- Sichere Passwort-Änderung mit Validierung

### 4. Testen

1. Starten Sie Backend und Frontend
2. Versuchen Sie eine Registrierung
3. Überprüfen Sie Ihr Email-Postfach
4. Testen Sie die Verifizierung
5. Testen Sie den Passwort-Reset:
   - Klicken Sie auf "Passwort vergessen"
   - Geben Sie Ihre Email-Adresse ein
   - Überprüfen Sie Ihr Email-Postfach
   - Klicken Sie auf "Ich habe den Reset-Link erhalten"
   - Geben Sie den Token ein und setzen Sie ein neues Passwort

### 5. Sicherheitshinweise

- Verwenden Sie niemals Ihr normales Gmail-Passwort
- Verwenden Sie nur App-Passwörter für Anwendungen
- Bewahren Sie die .env Datei sicher auf
- Fügen Sie .env zur .gitignore hinzu (bereits konfiguriert)

## Fehlerbehebung

### "Invalid login" Fehler
- Überprüfen Sie das App-Password
- Stellen Sie sicher, dass 2-Faktor-Authentifizierung aktiviert ist

### Emails werden nicht gesendet
- Überprüfen Sie die Internetverbindung
- Überprüfen Sie die Email-Konfiguration in der .env Datei
- Überprüfen Sie die Gmail-App-Password-Berechtigungen

### Verifizierungscode funktioniert nicht
- Überprüfen Sie den Spam-Ordner
- Stellen Sie sicher, dass der Code innerhalb von 15 Minuten verwendet wird
- Überprüfen Sie, dass der Code korrekt eingegeben wurde
