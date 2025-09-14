// backend/server.ts
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import { z } from "zod";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import http from "http";
import https from "https";

dotenv.config();

const PORT = Number(process.env.PORT || 3001);
const PROVIDER = (process.env.PROVIDER || "openai").toLowerCase();
const USE_HTTPS = (process.env.USE_HTTPS ?? "true").toLowerCase() === "true";

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(helmet());
app.use(
  cors({
    origin: ["https://localhost:3000", "https://127.0.0.1:3000"],
    methods: ["POST", "GET", "OPTIONS"],
    credentials: false,
  })
);
app.use(
  rateLimit({
    windowMs: 60_000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// ---------- Provider-Setup ----------
const openai =
  PROVIDER === "openai" && process.env.OPENAI_API_KEY
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;

// ---------- Schemas ----------
const OptionsSchema = z.object({
  mode: z.enum(["A", "B", "C", "D"]),
  stil: z.enum(["knapp", "neutral", "ausführlicher"]),
  ansprache: z.enum(["sie", "neutral"]),
});

const ProcessSchema = z.object({
  text: z.string().min(1),
  options: OptionsSchema,
  allowContentChanges: z.boolean().optional().default(false),
});

// ---------- PHI/PII-Redaktion ----------
type Placeholder = { id: string; original: string };

const redactPII = (input: string) => {
  const placeholders: Placeholder[] = [];
  let redacted = input;

  redacted = redacted.replace(
    /\b(\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/g,
    (m) => {
      const id = `[DATUM_${placeholders.length}]`;
      placeholders.push({ id, original: m });
      return id;
    }
  );

  redacted = redacted.replace(/\b\d{6,12}\b/g, (m) => {
    const id = `[ID_${placeholders.length}]`;
    placeholders.push({ id, original: m });
    return id;
  });

  redacted = redacted.replace(
    /\b(?:Name|Patient|Pat\.?|Herr|Frau)\s*[:\-]?\s*([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)?)\b/g,
    (m, g1) => {
      const id = `[NAME_${placeholders.length}]`;
      placeholders.push({ id, original: g1 });
      return m.replace(g1, id);
    }
  );

  return { redacted, placeholders };
};

const reinsertPlaceholders = (text: string, placeholders: Placeholder[]) => {
  let out = text;
  for (const p of placeholders) out = out.replaceAll(p.id, p.original);
  return out;
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

  const origNums = Array.from(setFromRegex(original, numberRegex));
  const newNums = Array.from(setFromRegex(improved, numberRegex));
  const addedNumbers = newNums.filter((n) => !origNums.includes(n));
  const removedNumbers = origNums.filter((n) => !newNums.includes(n));
  if (addedNumbers.length || removedNumbers.length) reasons.push("Zahlen/Messwerte weichen ab.");

  const origLat = containsAny(original, lateralityWords);
  const newLat = containsAny(improved, lateralityWords);
  const lateralityChanged = origLat !== newLat;
  if (lateralityChanged) reasons.push("Lateralisierung geändert (links/rechts).");

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
  "Du bist ein Sprach- und Stildienst für radiologische Befunde. Du fügst keine neuen medizinischen Inhalte hinzu. Du änderst keine Zahlen, Einheiten, Messwerte, Seitenangaben oder Serien-/Bildnummern. Du vereinheitlichst Terminologie nach deutscher Fachsprache, schreibst prägnant und präzise und vermeidest inhaltlich leere Füllwörter. Antworte ausschließlich mit dem optimierten Text (ohne Kommentare oder Zusatzzeichen). Wenn Informationen fehlen, schreibe wörtlich: [keine Angabe].";

const prompts = {
  // A = reine Sprachglättung ohne Inhaltseingriff
  A: (stil: string, ansprache: string) =>
    `Korrigiere Rechtschreibung, Syntax, Grammatik und Zeichensetzung. Inhalt unverändert. Zahlenwerte, Einheiten und Lateralisierung bleiben exakt erhalten. Erlaube nur typografische Einheitennormierung (z. B. geschütztes Leerzeichen), keine Umrechnung/Änderung von Zahlen. Stil: ${stil}. Ansprache: ${ansprache}.`,

  // B = Terminologie-Normierung OHNE Struktur-/Inhaltsänderungen
  B: (_stil?: string, _ansprache?: string) =>
    `Normiere radiologische Terminologie und Abkürzungen nach deutschem Standard (z. B. KM, i.v., nativ, T1/T2). Vereinheitliche Schreibweisen (z. B. rechts/links, Segmentbezeichnungen), entferne redundante Phrasen. Keine neuen Befunde, keine Umdeutung, keine Empfehlungen. Struktur und Reihenfolge des Textes beibehalten. Zahlenwerte, Einheiten und Lateralisierung unverändert; nur typografische Einheitennormierung (Leerzeichen) ist erlaubt.`,

  // C = reine Umstrukturierung in gewünschte Gliederung, ohne neue Inhalte
  C: (stil: string, _ansprache?: string) =>
    `Strukturiere den bestehenden Text ausschließlich um in: Klinische Fragestellung – Technik – Befund – Beurteilung. Inhalte weder hinzufügen noch entfernen. Kürze lange Sätze, beseitige Redundanzen. Zahlenwerte/Einheiten/Lateralisierung unverändert lassen. Stil: ${stil}.`,

  // D = Kurzbrief/Patient:innen- oder Zuweisertext ohne neue Diagnosen
  D: (_stil?: string, _ansprache?: string) =>
    `Erzeuge 3–5 kurze, verständliche Sätze für Zuweiser. Keine neuen Diagnosen, keine Zahlenänderungen, keine Therapieempfehlungen über das bereits Gesagte hinaus. Nutze klare Alltagssprache, erkläre Fachbegriffe knapp in Klammern, wenn nötig.`,
};

const buildMessages = (mode: "A" | "B" | "C" | "D", stil: string, ansprache: string, text: string) => {
  const userInstruction =
    mode === "A" ? prompts.A(stil, ansprache) :
    mode === "B" ? prompts.B() :
    mode === "C" ? prompts.C(stil) :
    prompts.D();

  return [
    { role: "system" as const, content: SYSTEM_PROMPT },
    {
      role: "user" as const,
      content:
        `AUFGABE:\n${userInstruction}\n\nTEXT:\n---\n${text}\n---\n\n` +
        `WICHTIG: Keine neuen Diagnosen/Befunde/Therapieempfehlungen. Keine Zahlenänderungen. Keine Lateralisierungsänderungen.`,
    },
  ];
};

// ---------- Routes ----------
app.get("/healthz", (_req, res) => {
  res.json({ status: "ok", provider: PROVIDER });
});

app.post("/process", async (req, res) => {
  try {
    const { text, options, allowContentChanges } = ProcessSchema.parse(req.body);

    const { redacted, placeholders } = redactPII(text);

    let improved = "";
    if (PROVIDER === "openai" && openai) {
      const messages = buildMessages(options.mode, options.stil, options.ansprache, redacted);
      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages,
        temperature: 0.0,
      });
      improved = completion.choices[0]?.message?.content?.trim() || "";
    } else {
      improved = redacted.replace(/[ \t]+/g, " ").replace(/\s+([,.:;!?])/g, "$1").trim();
    }

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

// ---------- Serverstart (HTTPS bevorzugt) ----------
function startServer() {
  if (USE_HTTPS) {
    try {
      const certDir = path.join(process.env.HOME || "", ".office-addin-dev-certs");
      const key = fs.readFileSync(path.join(certDir, "localhost.key"));
      const cert = fs.readFileSync(path.join(certDir, "localhost.crt"));
      https.createServer({ key, cert }, app).listen(PORT, () => {
        console.log(`Backend (HTTPS) läuft auf https://localhost:${PORT} mit Provider ${PROVIDER}`);
      });
      return;
    } catch (e) {
      console.warn("[WARN] HTTPS-Zertifikat konnte nicht geladen werden. Fallback auf HTTP.", e);
    }
  }
  http.createServer(app).listen(PORT, () => {
    console.log(`Backend (HTTP) läuft auf http://localhost:${PORT} mit Provider ${PROVIDER}`);
  });
}

startServer();