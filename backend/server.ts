// backend/server.ts
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import * as http from "http";
import * as https from "https";
import * as bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";

// Import new services
import config from "./src/config";
import logger, { requestLogger, auditLogger } from "./src/utils/logger";
import { cacheService } from "./src/services/cache";
import { aiService } from "./src/services/ai";
import { queueService } from "./src/services/queue";
import { rateLimiterService } from "./src/services/rateLimiter";
import { piiRedactorService } from "./src/services/piiRedactor";
import { 
  httpMetricsMiddleware, 
  metricsHandler, 
  healthCheckHandler,
  recordAIMetrics,
  recordCacheMetrics,
  recordError 
} from "./src/middleware/metrics";

dotenv.config();

// Use config instead of direct env access
const PORT = config.server.port;
const PROVIDER = config.ai.provider;
const USE_HTTPS = config.server.useHttps;

// JWT Payload Interface
interface JWTPayload {
  userId: string;
  type: 'access' | 'refresh';
}

const app = express();

// Enhanced middleware stack
app.use(compression()); // Gzip compression
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// Security middleware
if (config.security.helmetEnabled) {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  }));
}

app.use(
  cors({
    origin: config.security.corsOrigin,
    methods: ["POST", "GET", "OPTIONS", "PUT", "DELETE"],
    credentials: true,
  })
);

// Rate limiting
app.use(
  rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    message: "Zu viele Anfragen, bitte versuchen Sie es später erneut",
  })
);

// Logging and metrics middleware
app.use(requestLogger);
app.use(httpMetricsMiddleware);

// Strikteres Rate-Limiting für Auth-Routen
const authRateLimit = rateLimit({
  windowMs: config.rateLimit.authWindowMs,
  max: config.rateLimit.authMaxRequests,
  message: "Zu viele Anmeldeversuche, bitte versuchen Sie es später erneut",
});

// ---------- Provider-Setup ----------
// OpenAI is now handled by the AI service

// ---------- Database Integration ----------
// Import database service
import { databaseService, User, RefreshToken } from './src/services/database';

// ---------- Auth Helper Functions ----------
async function generateTokens(userId: string) {
  const accessPayload: JWTPayload = { userId, type: 'access' };
  const refreshPayload: JWTPayload = { userId, type: 'refresh' };
  
  const accessToken = jwt.sign(accessPayload, config.auth.jwtSecret, { expiresIn: '15m' } as jwt.SignOptions);
  const refreshToken = jwt.sign(refreshPayload, config.auth.jwtSecret, { expiresIn: config.auth.jwtExpiresIn } as jwt.SignOptions);
  
  // Speichere Refresh Token in Database
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 Tage
  
  await databaseService.createRefreshToken({
    token: refreshToken,
    userId,
    expiresAt,
    isRevoked: false
  });
  
  return { accessToken, refreshToken };
}

function verifyToken(token: string, type: 'access' | 'refresh' = 'access') {
  try {
    const decoded = jwt.verify(token, config.auth.jwtSecret) as any;
    if (decoded.type !== type) {
      throw new Error('Invalid token type');
    }
    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

// ---------- Auth Middleware ----------
interface AuthenticatedRequest extends express.Request {
  userId: string;
}

function authenticateToken(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = verifyToken(token, 'access');
    (req as AuthenticatedRequest).userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

// ---------- Schemas ----------
const OptionsSchema = z.object({
  // NEU: Level 1–5 statt A–D
  mode: z.enum(["1", "2", "3", "4", "5"]),
  stil: z.enum(["knapp", "neutral", "ausführlicher"]),
  ansprache: z.enum(["sie", "neutral"]),
  // NEU: Layout-Unterstützung (sowohl vordefinierte als auch benutzerdefinierte Templates)
  layout: z.string().optional(), // Akzeptiert sowohl vordefinierte als auch benutzerdefinierte Layouts
  includeRecommendations: z.boolean().optional().default(false),
});

// Auth-Schemas
const RegisterSchema = z.object({
  email: z.string().email("Ungültige E-Mail-Adresse"),
  password: z.string()
    .min(8, "Passwort muss mindestens 8 Zeichen lang sein")
    .regex(/[A-Z]/, "Passwort muss mindestens einen Großbuchstaben enthalten")
    .regex(/[a-z]/, "Passwort muss mindestens einen Kleinbuchstaben enthalten")
    .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, "Passwort muss mindestens ein Sonderzeichen enthalten"),
  name: z.string().min(2, "Name muss mindestens 2 Zeichen lang sein"),
  organization: z.string().optional(),
});

const LoginSchema = z.object({
  email: z.string().email("Ungültige E-Mail-Adresse"),
  password: z.string().min(1, "Passwort ist erforderlich"),
});

const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh Token ist erforderlich"),
});

const ProcessSchema = z.object({
  text: z.string().min(1),
  options: OptionsSchema,
  allowContentChanges: z.boolean().optional().default(false),
});

const ImpressionSchema = z.object({
  text: z.string().min(1),
});

// NEU: Schema für strukturierte Ausgabe
const StructuredSchema = z.object({
  text: z.string().min(1),
  options: OptionsSchema,
  allowContentChanges: z.boolean().optional().default(false),
});

// ---------- PHI/PII-Redaktion ----------
// Now handled by PIIRedactorService
const redactPII = (input: string) => {
  return piiRedactorService.redactPII(input);
};

const reinsertPlaceholders = (text: string, placeholders: any[]) => {
  return piiRedactorService.reinsertPlaceholders(text, placeholders);
};

// ---------- No-New-Diagnosis Guards ----------
const lateralityWords = ["links", "linke", "linken", "rechter", "rechte", "rechts"];
const numberRegex = /\b\d+(?:[.,]\d+)?\b/g;
const medicalKeywords = [
  "fraktur",
  "tumor",
  "metastase",
  "embol",
  "blutung",
  "infarkt",
  "ruptur",
  "aneurysma",
  "ischäm",
  "abszess",
  "pneumothorax",
  "atelektase",
  "thrombus",
  "ödeme?",
  "entzündung",
];

type GuardReport = {
  addedNumbers: string[];
  removedNumbers: string[];
  lateralityChanged: boolean;
  newMedicalKeywords: string[];
  blocked: boolean;
  reasons: string[];
};

const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const setFromRegex = (s: string, rx: RegExp) => new Set(s.match(rx) ?? []);
const containsAny = (s: string, words: string[]) => words.some((w) => new RegExp(`\\b${w}\\b`, "i").test(s));

const guardDiff = (original: string, improved: string): GuardReport => {
  const reasons: string[] = [];

  // Zahlen
  const origNums = Array.from(setFromRegex(original, numberRegex));
  const newNums = Array.from(setFromRegex(improved, numberRegex));
  const addedNumbers = newNums.filter((n) => !origNums.includes(n));
  const removedNumbers = origNums.filter((n) => !newNums.includes(n));
  if (addedNumbers.length || removedNumbers.length) reasons.push("Zahlen/Messwerte weichen ab.");

  // Lateralisierung
  const origLat = containsAny(original, lateralityWords);
  const newLat = containsAny(improved, lateralityWords);
  const lateralityChanged = origLat !== newLat;
  if (lateralityChanged) reasons.push("Lateralisierung geändert (links/rechts).");

  // Med. Keywords
  const joined = medicalKeywords.join("|");
  const rx = new RegExp(`\\b(${joined})\\b`, "gi");
  const origKeys = new Set((original.match(rx) ?? []).map(normalize));
  const newKeys = new Set((improved.match(rx) ?? []).map(normalize));
  const newMedicalKeywords = Array.from(newKeys).filter((k) => !origKeys.has(k));
  if (newMedicalKeywords.length) reasons.push("Neue medizinische Schlüsselwörter hinzugefügt.");

  const blocked = !!(addedNumbers.length || removedNumbers.length || lateralityChanged || newMedicalKeywords.length);

  return { addedNumbers, removedNumbers, lateralityChanged, newMedicalKeywords, blocked, reasons };
};

// ---------- Prompts ----------
const SYSTEM_PROMPT =
  "Du bist ein Sprach- und Stildienst für radiologische Befunde. Du fügst keine neuen medizinischen Inhalte hinzu. Du änderst keine Zahlen, Einheiten, Messwerte, Seitenangaben oder Serien-/Bildnummern. Du vereinheitlichst Terminologie nach deutscher Fachsprache, schreibst prägnant und vermeidest leere Füllwörter. Antworte ausschließlich mit dem optimierten Text (ohne Kommentare oder Zusatzzeichen). Fehlen Angaben, schreibe wörtlich: [keine Angabe].";

function promptForLevel(level: "1" | "2" | "3" | "4" | "5", stil: string, ansprache: string) {
  switch (level) {
    case "1":
      return `OPTION 1 - SPRACHLICHE & GRAMMATIKALISCHE KORREKTUR (IMMER AKTIV):
Korrigiere ausschließlich Rechtschreibung, Grammatik, Zeichensetzung und offensichtliche Tippfehler. 
- Alle medizinischen Inhalte, Zahlen, Messwerte, Einheiten und Lateralisierung (links/rechts) bleiben exakt unverändert
- Keine Terminologie-Änderungen, keine Strukturänderungen
- Behalte den ursprünglichen Stil und die Ansprache bei
- Korrigiere nur eindeutige Fehler in Rechtschreibung und Grammatik`;

    case "2":
      return `OPTION 2 - TERMINOLOGIE VERBESSERN, STRUKTUR BLEIBT:
Wie Option 1, zusätzlich:
- Vereinheitliche radiologische Fachterminologie nach deutscher Standardsprache (RadLex-orientiert)
- Verwende konsistente Abkürzungen (z.B. i.v., KM, CT, MRT)
- Verbessere medizinische Begriffe, aber behalte die ursprüngliche Struktur bei
- Keine Umordnung von Abschnitten oder Inhalten
- Zahlen, Messwerte und Lateralisierung bleiben exakt unverändert`;

    case "3":
      return `OPTION 3 - TERMINOLOGIE + UMSTRUKTURIERUNG (OBERARZT-NIVEAU) + KURZE BEURTEILUNG:
Wie Option 2, zusätzlich:
- Strukturiere den Befund professionell um (Klinische Fragestellung → Technik → Befund → Beurteilung)
- Verwende präzise, fachsprachlich korrekte Formulierungen auf Oberarzt-Niveau
- Reduziere Passivkonstruktionen, formuliere aktiv und prägnant
- Erstelle eine prägnante, medizinisch fundierte Beurteilung basierend auf den Befunden
- Die Beurteilung soll die klinische Relevanz der Befunde zusammenfassen
- Zahlen, Messwerte und Lateralisierung bleiben exakt unverändert`;

    case "4":
      return `OPTION 4 - KLINISCHE EMPFEHLUNG HINZUFÜGEN (OPTIONAL):
Wie Option 3, zusätzlich:
- Füge klinisch relevante Empfehlungen hinzu, wenn medizinisch sinnvoll
- Empfehlungen sollen evidenzbasiert und praxisrelevant sein
- Berücksichtige die Fragestellung und die erhobenen Befunde
- Formuliere konkrete, umsetzbare Handlungsempfehlungen
- Nur hinzufügen, wenn klinisch indiziert - nicht bei jedem Befund
- Zahlen, Messwerte und Lateralisierung bleiben exakt unverändert`;

    case "5":
      return `OPTION 5 - ZUSATZINFOS/DIFFERENTIALDIAGNOSEN (OPTIONAL):
Wie Option 4, zusätzlich:
- Ergänze relevante Differentialdiagnosen, wenn klinisch sinnvoll
- Füge wichtige Zusatzinformationen zur Befundinterpretation hinzu
- Berücksichtige aktuelle Leitlinien und Evidenz
- Erwähne relevante Verlaufskontrollen oder weitere Diagnostik
- Nur hinzufügen, wenn medizinisch wertvoll - nicht bei jedem Befund
- Zahlen, Messwerte und Lateralisierung bleiben exakt unverändert`;
  }
}

// Hartung-Impressions-Prompt (Kurzbeurteilung für Zuweiser)
const HARTUNG_PROMPT =
  "Erzeuge eine prägnante, knappe Beurteilung (2–5 Sätze) gemäß etablierten Prinzipien guter Radiologieberichte (klare Leading Diagnosis mit stützenden Kernbefunden, verständlich formuliert, unnötigen Jargon meiden, differenzialdiagnostische Alternativen bei Bedarf gewichten). Keine neuen Diagnosen erfinden, keine Zahlen ändern, keine Inhalte hinzufügen/entfernen. Nutze klare, fachlich korrekte, deutschsprachige Formulierungen.";

// NEU: Layout-spezifische Prompts
const LAYOUT_PROMPTS = {
  standard: "Formatiere den Text im klassischen radiologischen Befundformat mit klarer Struktur.",
  strukturiert: "Gliedere den Text nach Organsystemen und verwende klare Abschnitte mit Überschriften.",
  tabellarisch: "Formatiere wichtige Befunde in übersichtlicher Tabellenform oder als strukturierte Aufzählung.",
  konsiliar: "Erstelle eine kompakte, überweisungsgerechte Kurzfassung mit den wichtigsten Befunden."
};

// NEU: Vorbefunde-Vergleich-Prompt
const COMPARISON_PROMPT = 
  "Analysiere den aktuellen Befund im Vergleich zu den Vorbefunden. Hebe wegweisende Änderungen hervor und kennzeichne unveränderte Befunde entsprechend. Formuliere den Befund so, dass relevante Änderungen im Fokus stehen und unveränderte Aspekte klar als solche erkennbar sind.";

// NEU: Strukturierte Ausgabe-Prompt für neue Workflow-Optionen
const STRUCTURED_OUTPUT_PROMPT = 
  "Erstelle eine strukturierte Ausgabe basierend auf den aktivierten Optionen:\n\n" +
  "BEFUND:\n[Der optimierte Befundtext - immer vorhanden]\n\n" +
  "BEURTEILUNG:\n[Prägnante medizinische Beurteilung - nur wenn Option 3, 4 oder 5 aktiv]\n\n" +
  "EMPFEHLUNGEN:\n[Klinisch relevante Empfehlungen - nur wenn Option 4 oder 5 aktiv und medizinisch sinnvoll]\n\n" +
  "ZUSATZINFORMATIONEN:\n[Differentialdiagnosen und Zusatzinfos - nur wenn Option 5 aktiv und medizinisch wertvoll]\n\n" +
  "WICHTIG: Erstelle nur die Abschnitte, die den aktivierten Optionen entsprechen. " +
  "Wenn ein Abschnitt nicht erstellt werden soll, schreibe 'Nicht aktiviert'.";

// NEU: Layout-Template-Prompt
const LAYOUT_TEMPLATE_PROMPT = (template: string) => 
  `WICHTIG: Verwende das folgende Layout-Template exakt für die Formatierung des Befunds:\n\n` +
  `TEMPLATE:\n${template}\n\n` +
  `Ersetze die Platzhalter wie folgt:\n` +
  `- [BEFUND] → Der optimierte Befundtext\n` +
  `- [BEURTEILUNG] → Die medizinische Beurteilung (falls aktiviert)\n` +
  `- [EMPFEHLUNGEN] → Klinische Empfehlungen (falls aktiviert)\n` +
  `- [ZUSATZINFOS] → Zusatzinformationen/Differentialdiagnosen (falls aktiviert)\n\n` +
  `Das Layout-Template darf NICHT verändert werden. Nur die Platzhalter werden durch die entsprechenden Inhalte ersetzt.`;

// ---------- Message Builder ----------
function buildMessagesFromLevel(
  level: "1" | "2" | "3" | "4" | "5", 
  stil: string, 
  ansprache: string, 
  text: string,
  layout?: string,
  includeRecommendations = false
) {
  let instruction = promptForLevel(level, stil, ansprache);
  
  // Layout-spezifische Anweisungen hinzufügen
  if (layout) {
    // Prüfe ob es ein vordefiniertes Layout ist
    if (LAYOUT_PROMPTS[layout as keyof typeof LAYOUT_PROMPTS]) {
      instruction += `\n\nLayout-Anforderung: ${LAYOUT_PROMPTS[layout as keyof typeof LAYOUT_PROMPTS]}`;
    } else {
      // Es ist ein benutzerdefiniertes Layout-Template
      instruction += `\n\n${LAYOUT_TEMPLATE_PROMPT(layout)}`;
    }
  }
  
  // Strukturierte Ausgabe für Empfehlungen
  if (includeRecommendations) {
    instruction += `\n\n${STRUCTURED_OUTPUT_PROMPT}`;
  }
  
  return [
    { role: "system" as const, content: SYSTEM_PROMPT },
    {
      role: "user" as const,
      content:
        `AUFGABE:\n${instruction}\n\nTEXT:\n---\n${text}\n---\n\n` +
        `WICHTIG: Keine neuen Diagnosen/Befunde/Therapieempfehlungen. Keine Zahlenänderungen. Keine Lateralisierungsänderungen.`,
    },
  ];
}

// NEU: Message Builder mit Layout-Template-Unterstützung
function buildMessagesWithLayoutTemplate(
  level: "1" | "2" | "3" | "4" | "5", 
  stil: string, 
  ansprache: string, 
  text: string,
  layoutTemplate?: string,
  includeRecommendations = false
) {
  let instruction = promptForLevel(level, stil, ansprache);
  
  // Layout-Template-Anweisungen hinzufügen
  if (layoutTemplate) {
    instruction += `\n\n${LAYOUT_TEMPLATE_PROMPT(layoutTemplate)}`;
  }
  
  // Strukturierte Ausgabe für Empfehlungen
  if (includeRecommendations) {
    instruction += `\n\n${STRUCTURED_OUTPUT_PROMPT}`;
  }
  
  return [
    { role: "system" as const, content: SYSTEM_PROMPT },
    {
      role: "user" as const,
      content:
        `AUFGABE:\n${instruction}\n\nTEXT:\n---\n${text}\n---\n\n` +
        `WICHTIG: Keine neuen Diagnosen/Befunde/Therapieempfehlungen. Keine Zahlenänderungen. Keine Lateralisierungsänderungen.`,
    },
  ];
}

function buildImpressionMessages(text: string) {
  return [
    { role: "system" as const, content: SYSTEM_PROMPT },
    {
      role: "user" as const,
      content:
        `AUFGABE (Beurteilung nach Hartung):\n${HARTUNG_PROMPT}\n\nBASISTEXT:\n---\n${text}\n---\n\n` +
        `WICHTIG: Keine neuen Diagnosen/Befunde, keine Zahlenänderungen, keine Lateralisierungsänderungen.`,
    },
  ];
}

// NEU: Vorbefunde-Vergleich
function buildComparisonMessages(currentText: string, priorFindings: string[]) {
  const priorSection = priorFindings.length > 0 
    ? `\n\nVORBEFUNDE:\n---\n${priorFindings.join('\n\n')}\n---`
    : '';
    
  return [
    { role: "system" as const, content: SYSTEM_PROMPT },
    {
      role: "user" as const,
      content:
        `AUFGABE (Vorbefunde-Vergleich):\n${COMPARISON_PROMPT}\n\nAKTUELLER BEFUND:\n---\n${currentText}\n---${priorSection}\n\n` +
        `WICHTIG: Keine neuen Diagnosen/Befunde, keine Zahlenänderungen, keine Lateralisierungsänderungen.`,
    },
  ];
}

// ---------- Helpers ----------
// Legacy function - now handled by AI service
async function callOpenAI(messages: Array<{ role: "system" | "user" | "assistant"; content: string }>) {
  // This function is deprecated - use aiService.processText instead
  logger.warn('callOpenAI is deprecated, use aiService.processText instead');
  
  // Fallback ohne Cloud – minimale „Glättung"
  return messages[messages.length - 1].content
    .replace(/[ \t]+/g, " ")
    .replace(/\s+([,.:;!?])/g, "$1")
    .trim();
}

// ---------- Routes ----------
// Health check and metrics endpoints
app.get("/healthz", healthCheckHandler);
app.get("/metrics", metricsHandler);
app.get("/health", (_req: express.Request, res: express.Response) => {
  res.json({ status: "ok", provider: PROVIDER, timestamp: new Date().toISOString() });
});

// ---------- Auth Routes ----------
// Registrierung
app.post("/auth/register", authRateLimit, async (req: express.Request, res: express.Response) => {
  try {
    const { email, password, name, organization } = RegisterSchema.parse(req.body);
    
    // Prüfe ob Benutzer bereits existiert
    const existingUser = await databaseService.getUserByEmail(email.toLowerCase());
    if (existingUser) {
      return res.status(409).json({ error: "Benutzer mit dieser E-Mail existiert bereits" });
    }
    
    // Hash Passwort
    const passwordHash = await bcrypt.hash(password, config.auth.bcryptRounds);
    
    // Erstelle neuen Benutzer in Database
    const user = await databaseService.createUser({
      email: email.toLowerCase(),
      passwordHash,
      name,
      organization,
      isActive: true
    });
    
    // Generiere Tokens
    const { accessToken, refreshToken } = await generateTokens(user.id);
    
    // Log audit event
    await databaseService.logAuditEvent({
      userId: user.id,
      action: 'user_registered',
      resourceType: 'user',
      resourceId: user.id,
      details: { email: user.email, organization: user.organization },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.status(201).json({
      message: "Benutzer erfolgreich registriert",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        organization: user.organization,
        createdAt: user.createdAt
      },
      accessToken,
      refreshToken
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Ungültige Eingabedaten", details: err.issues });
    }
    res.status(500).json({ error: "Interner Serverfehler" });
  }
});

// Anmeldung
app.post("/auth/login", authRateLimit, async (req: express.Request, res: express.Response) => {
  try {
    const { email, password } = LoginSchema.parse(req.body);
    
    // Finde Benutzer in Database
    const user = await databaseService.getUserByEmail(email.toLowerCase());
    if (!user) {
      return res.status(401).json({ error: "Ungültige Anmeldedaten" });
    }
    
    if (!user.isActive) {
      return res.status(401).json({ error: "Benutzerkonto ist deaktiviert" });
    }
    
    // Prüfe Passwort
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Ungültige Anmeldedaten" });
    }
    
    // Aktualisiere letzte Anmeldung
    await databaseService.updateUserLastLogin(user.id);
    
    // Generiere Tokens
    const { accessToken, refreshToken } = await generateTokens(user.id);
    
    // Log audit event
    await databaseService.logAuditEvent({
      userId: user.id,
      action: 'user_login',
      resourceType: 'user',
      resourceId: user.id,
      details: { email: user.email },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
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
  } catch (err: any) {
    console.error('Login error:', err);
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Ungültige Eingabedaten", details: err.issues });
    }
    res.status(500).json({ error: "Interner Serverfehler" });
  }
});

// Token erneuern
app.post("/auth/refresh", async (req: express.Request, res: express.Response) => {
  try {
    const { refreshToken } = RefreshTokenSchema.parse(req.body);
    
    // Prüfe Refresh Token in Database
    const tokenData = await databaseService.getRefreshToken(refreshToken);
    if (!tokenData) {
      return res.status(401).json({ error: "Ungültiger Refresh Token" });
    }
    
    if (tokenData.expiresAt < new Date()) {
      await databaseService.revokeRefreshToken(refreshToken);
      return res.status(401).json({ error: "Refresh Token abgelaufen" });
    }
    
    // Prüfe ob Benutzer noch existiert
    const user = await databaseService.getUserById(tokenData.userId);
    if (!user || !user.isActive) {
      await databaseService.revokeRefreshToken(refreshToken);
      return res.status(401).json({ error: "Benutzer nicht gefunden oder deaktiviert" });
    }
    
    // Generiere neue Tokens
    const { accessToken, refreshToken: newRefreshToken } = await generateTokens(user.id);
    
    // Lösche alten Refresh Token
    await databaseService.revokeRefreshToken(refreshToken);
    
    res.json({
      accessToken,
      refreshToken: newRefreshToken
    });
  } catch (err: any) {
    console.error('Refresh error:', err);
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Ungültige Eingabedaten", details: err.issues });
    }
    res.status(500).json({ error: "Interner Serverfehler" });
  }
});

// Abmelden
app.post("/auth/logout", authenticateToken, async (req: express.Request, res: express.Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    // Lösche alle Refresh Tokens des Benutzers
    await databaseService.revokeAllUserTokens(userId);
    
    res.json({ message: "Erfolgreich abgemeldet" });
  } catch (err: any) {
    console.error('Logout error:', err);
    res.status(500).json({ error: "Interner Serverfehler" });
  }
});

// Benutzerprofil abrufen
app.get("/auth/profile", authenticateToken, async (req: express.Request, res: express.Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const user = await databaseService.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: "Benutzer nicht gefunden" });
    }
    
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        organization: user.organization,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }
    });
  } catch (err: any) {
    console.error('Profile error:', err);
    res.status(500).json({ error: "Interner Serverfehler" });
  }
});

app.post("/process", authenticateToken, async (req: express.Request, res: express.Response) => {
  try {
    const { text, options, allowContentChanges } = ProcessSchema.parse(req.body);
    const { redacted, placeholders } = redactPII(text);

    const messages = buildMessagesFromLevel(
      options.mode, 
      options.stil, 
      options.ansprache, 
      redacted,
      options.layout,
      options.includeRecommendations
    );
    const improved = await callOpenAI(messages);

    const reinserted = reinsertPlaceholders(improved, placeholders);

    const report = guardDiff(text, reinserted);
    if (report.blocked && !allowContentChanges) {
      return res.status(200).json({
        blocked: true,
        reasons: report.reasons,
        diff: {
          addedNumbers: report.addedNumbers,
          removedNumbers: report.removedNumbers,
          lateralityChanged: report.lateralityChanged,
          newMedicalKeywords: report.newMedicalKeywords,
        },
        message:
          "Änderungen betreffen Inhalt; bitte prüfen/erlauben. (Zahlen/Lateralisierung/medizinische Schlüsselwörter)",
        suggestion: reinserted,
      });
    }

    res.json({ blocked: false, answer: reinserted });
  } catch (err: any) {
    console.error(err);
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Bad Request", details: err.issues });
    }
    res.status(500).json({ error: "Interner Fehler", details: err?.message || String(err) });
  }
});

// Beurteilung nach Hartung (Kurzbeurteilung/Impression)
app.post("/impression", authenticateToken, async (req: express.Request, res: express.Response) => {
  try {
    const { text } = ImpressionSchema.parse(req.body);
    const { redacted, placeholders } = redactPII(text);

    const messages = buildImpressionMessages(redacted);
    const impression = await callOpenAI(messages);
    const reinserted = reinsertPlaceholders(impression, placeholders);

    const report = guardDiff(text, reinserted);
    if (report.blocked) {
      // Bei Beurteilung lassen wir standardmäßig durch, aber markieren ggf.
      return res.status(200).json({
        blocked: true,
        reasons: report.reasons,
        message:
          "Inhaltliche Abweichungen erkannt (Zahlen/Lateralisierung/med. Keywords). Bitte prüfen.",
        suggestion: reinserted,
        diff: {
          addedNumbers: report.addedNumbers,
          removedNumbers: report.removedNumbers,
          lateralityChanged: report.lateralityChanged,
          newMedicalKeywords: report.newMedicalKeywords,
        },
      });
    }

    res.json({ blocked: false, answer: reinserted });
  } catch (err: any) {
    console.error(err);
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Bad Request", details: err.issues });
    }
    res.status(500).json({ error: "Interner Fehler", details: err?.message || String(err) });
  }
});

// NEU: Strukturierte Ausgabe (Befund + Beurteilung + Empfehlungen) mit Layout-Template-Unterstützung
app.post("/structured", authenticateToken, async (req: express.Request, res: express.Response) => {
  const startTime = Date.now();
  const userId = (req as AuthenticatedRequest).userId;
  
  try {
    const { text, options, allowContentChanges } = StructuredSchema.parse(req.body);
    
    // PII-Redaktion
    const { redacted, placeholders } = redactPII(text);
    
    // AI-Verarbeitung mit Caching
    const aiResponse = await aiService.processText(redacted, {
      ...options,
      includeRecommendations: true,
    }, userId);
    
    const reinserted = reinsertPlaceholders(aiResponse.content, placeholders);
    
    // Parse strukturierte Antwort
    const sections = parseStructuredOutput(reinserted);
    
    // Guard-Diff-Prüfung
    const report = guardDiff(text, sections.befund);
    if (report.blocked && !allowContentChanges) {
      recordAIMetrics.request(aiResponse.model, 'success');
      recordAIMetrics.processingTime(aiResponse.model, Date.now() - startTime);
      
      return res.status(200).json({
        blocked: true,
        reasons: report.reasons,
        diff: {
          addedNumbers: report.addedNumbers,
          removedNumbers: report.removedNumbers,
          lateralityChanged: report.lateralityChanged,
          newMedicalKeywords: report.newMedicalKeywords,
        },
        message:
          "Änderungen betreffen Inhalt; bitte prüfen/erlauben. (Zahlen/Lateralisierung/medizinische Schlüsselwörter)",
        suggestion: sections,
      });
    }

    // Erfolgreiche Verarbeitung
    recordAIMetrics.request(aiResponse.model, 'success');
    recordAIMetrics.processingTime(aiResponse.model, Date.now() - startTime);
    
    if (aiResponse.usage) {
      recordAIMetrics.tokensUsed(
        aiResponse.model, 
        aiResponse.usage.prompt_tokens, 
        aiResponse.usage.completion_tokens
      );
    }
    
    // Audit-Log
    auditLogger.aiRequest(userId, text.length, options, Date.now() - startTime);
    
    res.json({ blocked: false, answer: sections });
  } catch (err: any) {
    const duration = Date.now() - startTime;
    recordAIMetrics.request('unknown', 'error');
    recordError('ai_processing', 'high');
    
    logger.error('Structured processing error', { 
      userId, 
      error: err.message, 
      duration,
      stack: err.stack 
    });
    
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Bad Request", details: err.issues });
    }
    res.status(500).json({ error: "Interner Fehler", details: err?.message || String(err) });
  }
});

// NEU: Helper für strukturierte Ausgabe-Parsing mit neuen Workflow-Optionen
function parseStructuredOutput(text: string) {
  const sections = {
    befund: "",
    beurteilung: "",
    empfehlungen: "",
    zusatzinformationen: ""
  };

  // Versuche strukturierte Ausgabe zu parsen
  const befundMatch = text.match(/BEFUND:\s*([\s\S]*?)(?=\n\nBEURTEILUNG:|\n\nEMPFEHLUNGEN:|\n\nZUSATZINFORMATIONEN:|$)/i);
  const beurteilungMatch = text.match(/BEURTEILUNG:\s*([\s\S]*?)(?=\n\nEMPFEHLUNGEN:|\n\nZUSATZINFORMATIONEN:|$)/i);
  const empfehlungenMatch = text.match(/EMPFEHLUNGEN:\s*([\s\S]*?)(?=\n\nZUSATZINFORMATIONEN:|$)/i);
  const zusatzMatch = text.match(/ZUSATZINFORMATIONEN:\s*([\s\S]*?)$/i);

  if (befundMatch) sections.befund = befundMatch[1].trim();
  if (beurteilungMatch) sections.beurteilung = beurteilungMatch[1].trim();
  if (empfehlungenMatch) sections.empfehlungen = empfehlungenMatch[1].trim();
  if (zusatzMatch) sections.zusatzinformationen = zusatzMatch[1].trim();

  // Fallback: Wenn keine Struktur erkannt wird, alles als Befund behandeln
  if (!befundMatch && !beurteilungMatch) {
    sections.befund = text.trim();
    sections.beurteilung = "";
    sections.empfehlungen = "";
    sections.zusatzinformationen = "";
  }

  // Entferne "Nicht aktiviert" Texte
  Object.keys(sections).forEach(key => {
    if (sections[key as keyof typeof sections] === "Nicht aktiviert") {
      sections[key as keyof typeof sections] = "";
    }
  });

  return sections;
}

// ---------- Serverstart (HTTPS bevorzugt) ----------
async function startServer() {
  try {
    // Initialize services with fallback
    logger.info('Initializing services...');
    
    try {
      // Initialize database service
      logger.info('Initializing database service...');
      await databaseService.connect();
    } catch (error) {
      logger.warn('Database service not available, using in-memory fallback:', (error as Error).message);
    }
    
    try {
      // Initialize cache service
      logger.info('Initializing cache service...');
      await cacheService.connect();
    } catch (error) {
      logger.warn('Cache service not available, using in-memory fallback:', (error as Error).message);
    }
    
    try {
      // Initialize queue service
      logger.info('Initializing queue service...');
      await queueService.initialize();
    } catch (error) {
      logger.warn('Queue service not available, using direct processing:', (error as Error).message);
    }
    
    // Initialize AI service
    logger.info('Initializing AI service...');
    
    // Start server
    const server = USE_HTTPS ? await startHttpsServer() : await startHttpServer();
    
    // Graceful shutdown
    process.on('SIGTERM', () => gracefulShutdown(server));
    process.on('SIGINT', () => gracefulShutdown(server));
    
    logger.info(`Server started successfully on port ${PORT} with provider ${PROVIDER}`);
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

async function startHttpsServer(): Promise<http.Server | https.Server> {
    try {
      const certDir = path.join(process.env.HOME || "", ".office-addin-dev-certs");
      const key = fs.readFileSync(path.join(certDir, "localhost.key"));
      const cert = fs.readFileSync(path.join(certDir, "localhost.crt"));
    
    const server = https.createServer({ key, cert }, app);
    server.listen(PORT, () => {
      logger.info(`Backend (HTTPS) läuft auf https://localhost:${PORT} mit Provider ${PROVIDER}`);
    });
    return server;
    } catch (e) {
    logger.warn("HTTPS-Zertifikat konnte nicht geladen werden. Fallback auf HTTP.", e);
    return startHttpServer();
  }
}

async function startHttpServer(): Promise<http.Server> {
  const server = http.createServer(app);
  server.listen(PORT, () => {
    logger.info(`Backend (HTTP) läuft auf http://localhost:${PORT} mit Provider ${PROVIDER}`);
  });
  return server;
}

async function gracefulShutdown(server: http.Server | https.Server) {
  logger.info('Received shutdown signal, closing server gracefully...');
  
  server.close(async () => {
    logger.info('HTTP server closed');
    
    try {
      // Shutdown services in order
      await queueService.shutdown();
      logger.info('Queue service shutdown');
      
      await cacheService.disconnect();
      logger.info('Cache service disconnected');
      
      await databaseService.disconnect();
      logger.info('Database service disconnected');
      
    } catch (error) {
      logger.error('Error during service shutdown:', error);
    }
    
    logger.info('Server shutdown complete');
    process.exit(0);
  });
  
  // Force close after 15 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 15000);
}

startServer();