// Simple server without complex services
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const OpenAI = require('openai');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: 'http://localhost:3002',
  credentials: true
}));
app.use(express.json());

// Database connection
const pool = new Pool({
  user: process.env.DB_USER || 'radbefund_user',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'radbefund_db',
  password: process.env.DB_PASSWORD || 'radbefund_password',
  port: process.env.DB_PORT || 5432,
});

// Email configuration
const emailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'ahmadh.mustafaa@gmail.com',
    pass: 'twdv ffya eceu dzcl'
  }
});

// Helper functions
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const generateResetToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

const sendVerificationEmail = async (email, code) => {
  const mailOptions = {
    from: process.env.EMAIL_USER || 'ahmadh.mustafaa@gmail.com',
    to: email,
    subject: 'RadBefund+ - Email-Verifizierung',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">RadBefund+ Email-Verifizierung</h2>
        <p>Hallo,</p>
        <p>vielen Dank für Ihre Registrierung bei RadBefund+!</p>
        <p>Bitte verwenden Sie den folgenden 6-stelligen Code zur Verifizierung Ihrer Email-Adresse:</p>
        <div style="background-color: #f3f4f6; padding: 20px; text-align: center; margin: 20px 0;">
          <h1 style="color: #2563eb; font-size: 32px; margin: 0; letter-spacing: 5px;">${code}</h1>
        </div>
        <p>Dieser Code ist 15 Minuten gültig.</p>
        <p>Falls Sie sich nicht registriert haben, können Sie diese Email ignorieren.</p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 14px;">RadBefund+ - Ihr intelligenter Radiologie-Assistent</p>
      </div>
    `
  };
  
  try {
    await emailTransporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Email sending error:', error);
    return false;
  }
};

const sendPasswordResetEmail = async (email, resetToken) => {
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3002'}/reset-password?token=${resetToken}`;

  const mailOptions = {
    from: 'ahmadh.mustafaa@gmail.com',
    to: email,
    subject: 'RadBefund+ - Passwort zurücksetzen',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">RadBefund+ Passwort zurücksetzen</h2>
        <p>Hallo,</p>
        <p>Sie haben eine Anfrage zum Zurücksetzen Ihres Passworts gestellt.</p>
        <p>Klicken Sie auf den folgenden Link, um Ihr Passwort zurückzusetzen:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Passwort zurücksetzen</a>
        </div>
        <p>Dieser Link ist 1 Stunde gültig.</p>
        <p>Falls Sie diese Anfrage nicht gestellt haben, können Sie diese Email ignorieren.</p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 14px;">RadBefund+ - Ihr intelligenter Radiologie-Assistent</p>
      </div>
    `
  };

  try {
    console.log('Sending password reset email to:', email);
    const result = await emailTransporter.sendMail(mailOptions);
    console.log('Email sent successfully:', result.messageId);
    return true;
  } catch (error) {
    console.error('Email sending error:', error);
    return false;
  }
};

// Test database connection
pool.query('SELECT 1', (err, result) => {
  if (err) {
    console.error('Database connection failed:', err);
  } else {
    console.log('✅ Database connected successfully');
  }
});

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_here';

// OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Auth middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

// Routes
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    provider: 'development',
    timestamp: new Date().toISOString(),
    users: 'Database connected'
  });
});

// Register
app.post('/auth/register', async (req, res) => {
  try {
    const { email, password, name, organization } = req.body;
    
    // Check if user exists
    const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ 
        error: "Diese E-Mail-Adresse ist bereits registriert",
        suggestion: "Möchten Sie sich stattdessen anmelden?",
        canLogin: true
      });
    }
    
    // Generate verification code
    const verificationCode = generateVerificationCode();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15); // 15 minutes
    
    // Store verification code
    await pool.query(
      'INSERT INTO email_verification_codes (email, code, expires_at) VALUES ($1, $2, $3)',
      [email.toLowerCase(), verificationCode, expiresAt]
    );
    
    // Send verification email
    const emailSent = await sendVerificationEmail(email, verificationCode);
    if (!emailSent) {
      return res.status(500).json({ error: "Fehler beim Senden der Verifizierungs-Email" });
    }
    
    res.status(200).json({
      message: "Verifizierungs-Email wurde gesendet",
      email: email.toLowerCase(),
      requiresVerification: true
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: "Interner Serverfehler" });
  }
});

// Verify email and complete registration
app.post('/auth/verify-email', async (req, res) => {
  try {
    const { email, code, password, name, organization } = req.body;
    
    // Check verification code
    const verificationResult = await pool.query(
      'SELECT * FROM email_verification_codes WHERE email = $1 AND code = $2 AND expires_at > NOW() AND is_used = false',
      [email.toLowerCase(), code]
    );
    
    if (verificationResult.rows.length === 0) {
      return res.status(400).json({ error: "Ungültiger oder abgelaufener Verifizierungscode" });
    }
    
    // Mark code as used
    await pool.query(
      'UPDATE email_verification_codes SET is_used = true WHERE email = $1 AND code = $2',
      [email.toLowerCase(), code]
    );
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);
    
    // Create user
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, name, organization, is_active, email_verified) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [email.toLowerCase(), passwordHash, name, organization, true, true]
    );
    
    const user = result.rows[0];
    
    // Generate tokens
    const accessToken = jwt.sign({ userId: user.id, type: 'access' }, JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ userId: user.id, type: 'refresh' }, JWT_SECRET, { expiresIn: '7d' });
    
    // Store refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await pool.query(
      'INSERT INTO refresh_tokens (token, user_id, expires_at, is_revoked) VALUES ($1, $2, $3, $4)',
      [refreshToken, user.id, expiresAt, false]
    );
    
    res.status(201).json({
      message: "Benutzer erfolgreich registriert und verifiziert",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        organization: user.organization,
        isActive: user.is_active,
        emailVerified: user.email_verified
      },
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: "Fehler bei der Email-Verifizierung" });
  }
});

// Request password reset
app.post('/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    // Check if user exists
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "Kein Benutzer mit dieser E-Mail-Adresse gefunden" });
    }
    
    const user = userResult.rows[0];
    
    // Generate reset token
    const resetToken = generateResetToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour
    
    // Store reset token
    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, resetToken, expiresAt]
    );
    
    // Send reset email
    const emailSent = await sendPasswordResetEmail(email, resetToken);
    if (!emailSent) {
      return res.status(500).json({ error: "Fehler beim Senden der Reset-Email" });
    }
    
    res.status(200).json({
      message: "Passwort-Reset-Email wurde gesendet"
    });
  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({ error: "Fehler bei der Passwort-Reset-Anfrage" });
  }
});

// Reset password
app.post('/auth/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    
    // Check reset token
    const tokenResult = await pool.query(
      'SELECT prt.*, u.* FROM password_reset_tokens prt JOIN users u ON prt.user_id = u.id WHERE prt.token = $1 AND prt.expires_at > NOW() AND prt.is_used = false',
      [token]
    );
    
    if (tokenResult.rows.length === 0) {
      return res.status(400).json({ error: "Ungültiger oder abgelaufener Reset-Token" });
    }
    
    const { user_id } = tokenResult.rows[0];
    
    // Mark token as used
    await pool.query(
      'UPDATE password_reset_tokens SET is_used = true WHERE token = $1',
      [token]
    );
    
    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12);
    
    // Update user password
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [passwordHash, user_id]
    );
    
    res.status(200).json({
      message: "Passwort erfolgreich zurückgesetzt"
    });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ error: "Fehler beim Zurücksetzen des Passworts" });
  }
});

// Login
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Ungültige Anmeldedaten" });
    }
    
    const user = result.rows[0];
    
    if (!user.is_active) {
      return res.status(401).json({ error: "Benutzerkonto ist deaktiviert" });
    }
    
    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Ungültige Anmeldedaten" });
    }
    
    // Update last login
    await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
    
    // Generate tokens
    const accessToken = jwt.sign({ userId: user.id, type: 'access' }, JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ userId: user.id, type: 'refresh' }, JWT_SECRET, { expiresIn: '7d' });
    
    // Store refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await pool.query(
      'INSERT INTO refresh_tokens (token, user_id, expires_at, is_revoked) VALUES ($1, $2, $3, $4)',
      [refreshToken, user.id, expiresAt, false]
    );
    
    res.json({
      message: "Erfolgreich angemeldet",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        organization: user.organization,
        lastLogin: new Date()
      },
      accessToken,
      refreshToken
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: "Interner Serverfehler" });
  }
});

// Refresh token
app.post('/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    // Check refresh token
    const result = await pool.query('SELECT * FROM refresh_tokens WHERE token = $1 AND is_revoked = FALSE', [refreshToken]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Ungültiger Refresh Token" });
    }
    
    const tokenData = result.rows[0];
    
    if (tokenData.expires_at < new Date()) {
      await pool.query('UPDATE refresh_tokens SET is_revoked = TRUE WHERE token = $1', [refreshToken]);
      return res.status(401).json({ error: "Refresh Token abgelaufen" });
    }
    
    // Check if user exists
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [tokenData.user_id]);
    if (userResult.rows.length === 0 || !userResult.rows[0].is_active) {
      await pool.query('UPDATE refresh_tokens SET is_revoked = TRUE WHERE token = $1', [refreshToken]);
      return res.status(401).json({ error: "Benutzer nicht gefunden oder deaktiviert" });
    }
    
    // Generate new tokens
    const accessToken = jwt.sign({ userId: tokenData.user_id, type: 'access' }, JWT_SECRET, { expiresIn: '15m' });
    const newRefreshToken = jwt.sign({ userId: tokenData.user_id, type: 'refresh' }, JWT_SECRET, { expiresIn: '7d' });
    
    // Revoke old refresh token
    await pool.query('UPDATE refresh_tokens SET is_revoked = TRUE WHERE token = $1', [refreshToken]);
    
    // Store new refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await pool.query(
      'INSERT INTO refresh_tokens (token, user_id, expires_at, is_revoked) VALUES ($1, $2, $3, $4)',
      [newRefreshToken, tokenData.user_id, expiresAt, false]
    );
    
    res.json({
      accessToken,
      refreshToken: newRefreshToken
    });
  } catch (err) {
    console.error('Refresh error:', err);
    res.status(500).json({ error: "Interner Serverfehler" });
  }
});

// Logout
app.post('/auth/logout', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Revoke all refresh tokens for user
    await pool.query('UPDATE refresh_tokens SET is_revoked = TRUE WHERE user_id = $1', [userId]);
    
    res.json({ message: "Erfolgreich abgemeldet" });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: "Interner Serverfehler" });
  }
});

// Profile
app.get('/auth/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Benutzer nicht gefunden" });
    }
    
    const user = result.rows[0];
    
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        organization: user.organization,
        createdAt: user.created_at,
        lastLogin: user.last_login
      }
    });
  } catch (err) {
    console.error('Profile error:', err);
    res.status(500).json({ error: "Interner Serverfehler" });
  }
});

// Layout endpoints
// Get user layouts
app.get('/layouts', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const result = await pool.query('SELECT * FROM user_layouts WHERE user_id = $1 ORDER BY name', [userId]);
    
    res.json({ layouts: result.rows });
  } catch (err) {
    console.error('Get layouts error:', err);
    res.status(500).json({ error: "Interner Serverfehler" });
  }
});

// Create layout
app.post('/layouts', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, description, template } = req.body;
    
    const result = await pool.query(
      'INSERT INTO user_layouts (user_id, name, description, template) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, name, description, template]
    );
    
    res.status(201).json({ layout: result.rows[0] });
  } catch (err) {
    console.error('Create layout error:', err);
    if (err.code === '23505') { // Unique constraint violation
      res.status(409).json({ error: "Layout mit diesem Namen existiert bereits" });
    } else {
      res.status(500).json({ error: "Interner Serverfehler" });
    }
  }
});

// Update layout
app.put('/layouts/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const layoutId = req.params.id;
    const { name, description, template } = req.body;
    
    const result = await pool.query(
      'UPDATE user_layouts SET name = $1, description = $2, template = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 AND user_id = $5 RETURNING *',
      [name, description, template, layoutId, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Layout nicht gefunden" });
    }
    
    res.json({ layout: result.rows[0] });
  } catch (err) {
    console.error('Update layout error:', err);
    res.status(500).json({ error: "Interner Serverfehler" });
  }
});

// Delete layout
app.delete('/layouts/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const layoutId = req.params.id;
    
    const result = await pool.query(
      'DELETE FROM user_layouts WHERE id = $1 AND user_id = $2 RETURNING *',
      [layoutId, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Layout nicht gefunden" });
    }
    
    res.json({ message: "Layout erfolgreich gelöscht" });
  } catch (err) {
    console.error('Delete layout error:', err);
    res.status(500).json({ error: "Interner Serverfehler" });
  }
});

// Simple AI endpoint (placeholder)
app.post('/structured', authenticateToken, async (req, res) => {
  try {
    console.log('Structured endpoint called', { userId: req.user.userId, textLength: req.body.text?.length });
    
    const { text, options, additionalInfo, modalitaet } = req.body;
    
    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Befundtext ist erforderlich" });
    }
    
    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_openai_api_key_here') {
      console.log('OpenAI API Key not configured');
      return res.status(500).json({ 
        error: "OpenAI API Key nicht konfiguriert. Bitte setzen Sie OPENAI_API_KEY in der .env Datei." 
      });
    }
    
    console.log('OpenAI API Key is configured, proceeding with AI call');
    
    // Determine processing level based on options
    const mode = options?.mode || '1';
    const layout = options?.layout;
    
    // Build the prompt based on mode and layout
    let systemPrompt = `Sie sind ein erfahrener Radiologe und medizinischer Experte mit Spezialisierung auf ${modalitaet || 'CT'}. Ihre Aufgabe ist es, radiologische Befunde zu optimieren und zu verbessern.

MODALITÄTSSPEZIFISCHE EXPERTISE:
- Sie sind ein Experte für ${modalitaet || 'CT'} und haben umfassendes Wissen über diese bildgebende Modalität
- Sie kennen alle relevanten Fachbegriffe, Glossare und Literatur für ${modalitaet || 'CT'}
- Sie verstehen die spezifischen technischen Parameter, Indikationen und Limitationen von ${modalitaet || 'CT'}
- Sie können Befunde in der Fachsprache dieser Modalität präzise und korrekt formulieren
- Sie berücksichtigen modalitätsspezifische Artefakte, Kontraindikationen und Besonderheiten

KRITISCHE ANWEISUNGEN FÜR LAYOUT-TEMPLATES:
- Wenn ein Layout-Template verwendet wird, BEHALTEN Sie die Kompartiment-Struktur EXAKT bei
- ÄNDERN Sie NICHT die Kompartiment-Namen oder -Gruppierungen (z.B. "Leber: [@]", "Herz, Gefäße: [@]")
- ERSETZEN Sie nur die [@] Platzhalter durch den entsprechenden Inhalt aus dem Befund
- Bei unauffälligen Befunden in einem Kompartiment verwenden Sie "Unauffällig."
- BEHALTEN Sie die ursprüngliche Formatierung und Struktur bei

WICHTIGE ANWEISUNGEN FÜR BILD-/SERIENNUMMERN:
- Wenn der Nutzer Bild-/Seriennummern angibt (z.B. "Bild 1/5", "Serie 2", "Slice 15/20"), MÜSSEN diese UNBEDINGT beibehalten werden
- Diese Nummern sind für die Nachverfolgung und Dokumentation essentiell
- Fügen Sie sie an der entsprechenden Stelle im optimierten Befund ein
- Ändern Sie NICHT die Nummerierung oder Reihenfolge

STRUKTURIERUNG DES BEFUNDES:
- Der Befund-Abschnitt soll IMMER mit einer Voruntersuchungen-Sektion beginnen
- Format: Direkt der Satz über Voruntersuchungen ohne "Voruntersuchungen:" Überschrift (z.B. "Keine relevanten Voruntersuchungen vorhanden" oder "Vergleichsaufnahme vom [Datum] zeigt...")
- Direkt danach eine Leerzeile, dann der eigentliche Befund
- Bei strukturierten Befunden (Level 3-5) sollen die Kompartimente durch Leerzeilen getrennt werden
- Kompartiment-Titel können unterstrichen werden für bessere Lesbarkeit`;

    let userPrompt = `Bitte optimieren Sie folgenden ${modalitaet || 'CT'}-Befund als Experte für ${modalitaet || 'CT'}:\n\n${text}\n\n`;

    // Add additional information if provided
    if (additionalInfo && additionalInfo.length > 0) {
      userPrompt += `\nZUSÄTZLICHE RELEVANTE INFORMATIONEN:\n`;
      userPrompt += `Die folgenden Informationen wurden zusätzlich bereitgestellt und sollen bei der Befundoptimierung berücksichtigt werden, sofern sie relevant sind:\n\n`;
      
      additionalInfo.forEach((info, index) => {
        userPrompt += `${index + 1}. ${info.type === 'vorbefund' ? 'VORBEFUND' : 'ZUSATZINFORMATION'}: ${info.title}\n`;
        userPrompt += `${info.content}\n\n`;
      });
      
      userPrompt += `WICHTIG: Nutzen Sie diese zusätzlichen Informationen nur, wenn sie für die Befundoptimierung relevant sind. Verknüpfen Sie relevante Aspekte miteinander, um ein vollständiges Bild zu erhalten. Ignorieren Sie irrelevante Informationen.\n\n`;
    }

    userPrompt += `WICHTIG: Achten Sie besonders auf Bild-/Seriennummern im Befund. Diese MÜSSEN unbedingt beibehalten werden, da sie für die medizinische Dokumentation und Nachverfolgung essentiell sind.

MODALITÄTSSPEZIFISCHE ANWEISUNGEN FÜR ${modalitaet || 'CT'}:
- Verwenden Sie die korrekte Fachterminologie für ${modalitaet || 'CT'}
- Berücksichtigen Sie modalitätsspezifische technische Parameter und Artefakte
- Formulieren Sie den Befund entsprechend den Standards für ${modalitaet || 'CT'}-Befunde
- Beachten Sie die spezifischen Indikationen und Limitationen von ${modalitaet || 'CT'}`;
    
    // Add mode-specific instructions
    switch (mode) {
      case '1':
        systemPrompt += ` Führen Sie eine sprachliche und grammatikalische Korrektur durch.`;
        userPrompt += `Führen Sie eine sprachliche und grammatikalische Korrektur des Befundes durch.`;
        break;
      case '2':
        systemPrompt += ` Verbessern Sie die medizinische Terminologie und Präzision.`;
        userPrompt += `Verbessern Sie die medizinische Terminologie und machen Sie den Befund präziser.`;
        break;
      case '3':
        systemPrompt += ` Strukturieren Sie den Befund um und fügen Sie eine kurze Beurteilung hinzu (Oberarzt-Niveau).`;
        userPrompt += `Strukturieren Sie den Befund um und fügen Sie eine kurze, prägnante Beurteilung hinzu.`;
        break;
      case '4':
        systemPrompt += ` Optimieren Sie den Befund und fügen Sie klinische Empfehlungen hinzu.`;
        userPrompt += `Optimieren Sie den Befund und fügen Sie klinische Empfehlungen für weitere Diagnostik oder Therapie hinzu.`;
        break;
      case '5':
        systemPrompt += ` Optimieren Sie den Befund vollständig und fügen Sie zusätzliche Informationen und Differentialdiagnosen hinzu.`;
        userPrompt += `Optimieren Sie den Befund vollständig und fügen Sie zusätzliche Informationen und relevante Differentialdiagnosen hinzu.`;
        break;
    }
    
    // Apply layout template if provided
    if (layout && layout.trim()) {
      userPrompt += `\n\nWICHTIG: Verwenden Sie folgendes Layout-Template EXAKT als Struktur:\n\n${layout}

KRITISCHE ANWEISUNGEN:
1. BEHALTEN Sie die Kompartiment-Struktur EXAKT bei (z.B. "Leber: [@]", "Herz, Gefäße: [@]")
2. ÄNDERN Sie NICHT die Kompartiment-Namen oder -Gruppierungen
3. ERSETZEN Sie nur die [@] Platzhalter durch den entsprechenden Inhalt aus dem Befund
4. Bei unauffälligen Befunden in einem Kompartiment verwenden Sie "Unauffällig."
5. BEHALTEN Sie die ursprüngliche Formatierung und Struktur bei

BEISPIEL:
Template: "Leber: [@]\nHerz, Gefäße: [@]"
Ergebnis: "Leber: Unauffällig.\nHerz, Gefäße: Normale Herzgröße, keine Gefäßveränderungen."`;
    }
    
    // Build JSON response format based on mode
    let jsonFormat = `\n\nAntworten Sie im folgenden JSON-Format:
{
  "befund": "Der optimierte Befundtext"`;

    if (mode >= '3') {
      jsonFormat += `,
  "beurteilung": "Kurze Beurteilung"`;
    }
    
    if (mode >= '4') {
      jsonFormat += `,
  "empfehlungen": "Klinische Empfehlungen"`;
    }
    
    if (mode >= '5') {
      jsonFormat += `,
  "zusatzinformationen": "Zusätzliche Informationen/DDx"`;
    }
    
    jsonFormat += `
}`;
    
    userPrompt += jsonFormat;
    
    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 2000
    });
    
    const aiResponse = completion.choices[0].message.content;
    console.log('AI Response received:', aiResponse);
    
    // Check if AI response is empty or null
    if (!aiResponse || aiResponse.trim() === '') {
      console.log('AI returned empty response, using fallback');
      const fallbackResponse = {
        befund: `BEFUND:\n\n${text}\n\nHinweis: Die AI-Verarbeitung war nicht verfügbar. Der ursprüngliche Text wurde unverändert übernommen.`
      };
      
      if (mode >= '3') {
        fallbackResponse.beurteilung = "BEURTEILUNG:\n\nEine Beurteilung konnte aufgrund technischer Probleme nicht generiert werden.";
      }
      
      if (mode >= '4') {
        fallbackResponse.empfehlungen = "EMPFEHLUNGEN:\n\nEmpfehlungen konnten aufgrund technischer Probleme nicht generiert werden.";
      }
      
      if (mode >= '5') {
        fallbackResponse.zusatzinformationen = "ZUSATZINFORMATIONEN:\n\nZusatzinformationen konnten aufgrund technischer Probleme nicht generiert werden.";
      }
      
      return res.json({ blocked: false, answer: fallbackResponse });
    }
    
    // Try to parse JSON response
    let response;
    try {
      // First, try to extract JSON from markdown format if present
      let jsonString = aiResponse;
      if (aiResponse.includes('```json')) {
        // Extract JSON from markdown code block
        const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch && jsonMatch[1]) {
          jsonString = jsonMatch[1].trim();
          console.log('Extracted JSON from markdown:', jsonString);
        }
      } else if (aiResponse.includes('```')) {
        // Extract from generic code block
        const codeMatch = aiResponse.match(/```\s*([\s\S]*?)\s*```/);
        if (codeMatch && codeMatch[1]) {
          jsonString = codeMatch[1].trim();
          console.log('Extracted JSON from code block:', jsonString);
        }
      }
      
      response = JSON.parse(jsonString);
      console.log('Successfully parsed JSON response:', response);
      
      // Clean up markdown formatting from the response
      const cleanResponse = {};
      Object.keys(response).forEach(key => {
        if (typeof response[key] === 'string') {
          // Remove markdown underscores from compartment titles
          cleanResponse[key] = response[key]
            .replace(/__([^_]+)__/g, '$1')  // Remove double underscores around text
            .replace(/\*\*([^*]+)\*\*/g, '$1')  // Remove double asterisks around text
            .replace(/\*([^*]+)\*/g, '$1');  // Remove single asterisks around text
        } else {
          cleanResponse[key] = response[key];
        }
      });
      
      // Filter response based on mode - only include fields for active levels
      const filteredResponse = {
        befund: cleanResponse.befund || aiResponse
      };
      
      if (mode >= '3' && cleanResponse.beurteilung) {
        filteredResponse.beurteilung = cleanResponse.beurteilung;
      }
      
      if (mode >= '4' && cleanResponse.empfehlungen) {
        filteredResponse.empfehlungen = cleanResponse.empfehlungen;
      }
      
      if (mode >= '5' && cleanResponse.zusatzinformationen) {
        filteredResponse.zusatzinformationen = cleanResponse.zusatzinformationen;
      }
      
      response = filteredResponse;
    } catch (parseError) {
      console.log('JSON parsing failed:', parseError.message);
      console.log('Raw AI response:', aiResponse);
      
      // If JSON parsing fails, try to extract content from the response
      // Look for common patterns in the AI response
      let befund = aiResponse;
      let beurteilung = null;
      let empfehlungen = null;
      let zusatzinformationen = null;
      
      // Try to split by common section headers
      const sections = aiResponse.split(/\n(?=BEFUND:|BEURTEILUNG:|EMPFEHLUNGEN:|ZUSATZINFORMATIONEN:|DIFFERENTIALDIAGNOSEN:)/i);
      
      sections.forEach(section => {
        const trimmedSection = section.trim();
        if (trimmedSection.toLowerCase().includes('befund:')) {
          befund = trimmedSection.replace(/^.*?befund:\s*/i, '').trim();
        } else if (trimmedSection.toLowerCase().includes('beurteilung:')) {
          beurteilung = trimmedSection.replace(/^.*?beurteilung:\s*/i, '').trim();
        } else if (trimmedSection.toLowerCase().includes('empfehlungen:')) {
          empfehlungen = trimmedSection.replace(/^.*?empfehlungen:\s*/i, '').trim();
        } else if (trimmedSection.toLowerCase().includes('zusatzinformationen:') || trimmedSection.toLowerCase().includes('differentialdiagnosen:')) {
          zusatzinformationen = trimmedSection.replace(/^.*?(zusatzinformationen|differentialdiagnosen):\s*/i, '').trim();
        }
      });
      
      response = {
        befund: befund || aiResponse
      };
      
      if (mode >= '3' && beurteilung) {
        response.beurteilung = beurteilung;
      }
      
      if (mode >= '4' && empfehlungen) {
        response.empfehlungen = empfehlungen;
      }
      
      if (mode >= '5' && zusatzinformationen) {
        response.zusatzinformationen = zusatzinformationen;
      }
    }
    
    res.json({ blocked: false, answer: response });
    
  } catch (err) {
    console.error('AI processing error:', err);
    
    // Handle specific OpenAI errors
    if (err.code === 'insufficient_quota') {
      return res.status(402).json({ error: "OpenAI API Quota überschritten. Bitte überprüfen Sie Ihr Konto." });
    } else if (err.code === 'invalid_api_key') {
      return res.status(401).json({ error: "Ungültiger OpenAI API Key." });
    }
    
    res.status(500).json({ error: "Fehler bei der AI-Verarbeitung: " + err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 RadBefund+ Backend läuft auf http://localhost:${PORT}`);
  console.log(`📊 Health Check: http://localhost:${PORT}/health`);
  console.log(`🔐 Auth Endpoints: /auth/register, /auth/login, /auth/refresh, /auth/logout, /auth/profile`);
  console.log(`🤖 AI Endpoints: /structured`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, closing server gracefully...');
  pool.end(() => {
    console.log('Database pool closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, closing server gracefully...');
  pool.end(() => {
    console.log('Database pool closed');
    process.exit(0);
  });
});