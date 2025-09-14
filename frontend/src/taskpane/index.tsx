// src/taskpane/index.tsx
import * as React from "react";
import { createRoot } from "react-dom/client";

// --- Typ-Hilfen, damit TS im Browser nicht wegen fehlendem Office meckert ---
declare global {
  interface Window {
    Office?: any;
    Word?: any;
  }
}

// UI-Texte
const CLAIM = "Radiologische Befunde – sprachlich sauber, klar strukturiert.";
const DISCLAIMER =
  "Dieses Werkzeug verbessert Sprache und Struktur. Medizinische Bewertung bleibt bei Ihnen.";

// Backend-URL (lokales Backend)
const BACKEND_URL = "https://localhost:3001/process";

type Mode = "A" | "B" | "C" | "D";
type Stil = "knapp" | "neutral" | "ausführlicher";
type Ansprache = "sie" | "neutral";

type BackendResponse =
  | {
      blocked: true;
      reasons: string[];
      message: string;
      suggestion?: string;
      diff?: {
        addedNumbers: string[];
        removedNumbers: string[];
        lateralityChanged: boolean;
        newMedicalKeywords: string[];
      };
    }
  | {
      blocked: false;
      answer: string;
    };

function App() {
  const [mode, setMode] = React.useState<Mode>("A");
  const [stil, setStil] = React.useState<Stil>("neutral");
  const [ansprache, setAnsprache] = React.useState<Ansprache>("neutral");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [lastOriginal, setLastOriginal] = React.useState<string>("");
  const [lastResult, setLastResult] = React.useState<string>("");

  // Browser-Demo (falls Office nicht vorhanden ist)
  const isOffice = !!(window as any).Office;
  const [browserInput, setBrowserInput] = React.useState<string>("");

  async function callBackend(
    text: string,
    allowContentChanges = false
  ): Promise<BackendResponse> {
    const payload = {
      text,
      options: { mode, stil, ansprache },
      allowContentChanges,
    };

    const res = await fetch(BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Backend-Fehler ${res.status}: ${t || res.statusText}`);
    }

    return (await res.json()) as BackendResponse;
  }

  // Word: markierten Text holen; wenn leer -> gesamtes Dokument
  async function getWordText(context: any): Promise<{ text: string; range: any }> {
    const selection = context.document.getSelection();
    selection.load("text");
    await context.sync();

    let text = (selection.text || "").trim();
    if (text.length > 0) {
      return { text, range: selection };
    }

    // Fallback: gesamtes Dokument
    const bodyRange = context.document.body.getRange();
    bodyRange.load("text");
    await context.sync();

    text = (bodyRange.text || "").trim();
    return { text, range: bodyRange };
  }

  // Ergebnis an gleicher Stelle einfügen (Replace)
  async function replaceInWord(range: any, content: string, context: any) {
    range.insertText(content, "Replace");
    await context.sync();
  }

  function formatGuardDetails(resp: Extract<BackendResponse, { blocked: true }>) {
    const rows: string[] = [];
    if (resp.message) rows.push(resp.message);
    if (resp.diff?.addedNumbers?.length)
      rows.push(`Neue Zahlen: ${resp.diff.addedNumbers.join(", ")}`);
    if (resp.diff?.removedNumbers?.length)
      rows.push(`Entfernte Zahlen: ${resp.diff.removedNumbers.join(", ")}`);
    if (resp.diff?.lateralityChanged) rows.push("Lateralisierung geändert.");
    if (resp.diff?.newMedicalKeywords?.length)
      rows.push(`Neue med. Schlüsselwörter: ${resp.diff.newMedicalKeywords.join(", ")}`);
    return rows.join("\n");
  }

  async function onImproveClick() {
    setError(null);
    setLastOriginal("");
    setLastResult("");

    if (isOffice) {
      setLoading(true);
      try {
        await (window as any).Word.run(async (context: any) => {
          const { text, range } = await getWordText(context);

          if (!text) {
            setError("Bitte erst einen Befund einfügen.");
            return;
          }

          setLastOriginal(text);

          // 1) Erst ohne Inhaltsfreigabe prüfen
          const r1 = await callBackend(text, false);
          if (r1.blocked) {
            const details = formatGuardDetails(r1);
            const ok = confirm(
              "Änderungen betreffen Inhalt; bitte prüfen/erlauben.\n\n" +
                details +
                "\n\nTrotzdem übernehmen?"
            );

            if (!ok) {
              // Vorschlag nur anzeigen (nicht ersetzen)
              if (r1.suggestion) setLastResult(r1.suggestion);
              return;
            }

            // 2) Mit Freigabe neu anfordern/übernehmen
            const r2 = await callBackend(text, true);
            if (r2.blocked) {
              // Sollte nicht passieren, aber sicherheitshalber behandeln
              const s = (r2 as any).suggestion || "";
              if (s) {
                setLastResult(s);
              }
              setError("Inhaltliche Abweichungen bestehen weiterhin. Bitte manuell prüfen.");
              return;
            }
            const finalText = r2.answer || "";
            if (!finalText) {
              setError("Keine Antwort vom Backend erhalten.");
              return;
            }
            await replaceInWord(range, finalText, context);
            setLastResult(finalText);
            return;
          }

          // Kein Block – direkt übernehmen
          const finalText = r1.answer || "";
          if (!finalText) {
            setError("Keine Antwort vom Backend erhalten.");
            return;
          }
          await replaceInWord(range, finalText, context);
          setLastResult(finalText);
        });
      } catch (e: any) {
        console.error(e);
        const msg =
          e?.message?.toString?.() ||
          (typeof e === "string" ? e : "Unbekannter Fehler");
        setError(msg);
      } finally {
        setLoading(false);
      }
    } else {
      // Browser-Demo-Modus
      const text = browserInput.trim();
      if (!text) {
        setError("Bitte Text im Feld unten eingeben (Browser-Demo).");
        return;
      }
      setLoading(true);
      try {
        setLastOriginal(text);
        const r1 = await callBackend(text, false);
        if (r1.blocked) {
          alert(
            "Hinweis: Inhaltliche Abweichungen erkannt – Vorschlag wird nur angezeigt.\n\n" +
              formatGuardDetails(r1)
          );
          if (r1.suggestion) setLastResult(r1.suggestion);
          return;
        }
        setLastResult(r1.answer || "");
      } catch (e: any) {
        console.error(e);
        const msg =
          e?.message?.toString?.() ||
          (typeof e === "string" ? e : "Unbekannter Fehler");
        setError(msg);
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <div style={{ fontFamily: "Segoe UI, Arial, sans-serif", padding: 12 }}>
      <h2 style={{ margin: "0 0 4px 0" }}>RadBefund+</h2>
      <p style={{ color: "#555", marginTop: 0 }}>{CLAIM}</p>

      <h3 style={{ marginTop: 16 }}>Modus</h3>
      <div>
        <label>
          <input
            type="radio"
            value="A"
            checked={mode === "A"}
            onChange={() => setMode("A")}
          />{" "}
          A – Grammatik &amp; Stil
        </label>
        <br />
        <label>
          <input
            type="radio"
            value="B"
            checked={mode === "B"}
            onChange={() => setMode("B")}
          />{" "}
          B – Terminologie vereinheitlichen
        </label>
        <br />
        <label>
          <input
            type="radio"
            value="C"
            checked={mode === "C"}
            onChange={() => setMode("C")}
          />{" "}
          C – In Vorlage umwandeln
        </label>
        <br />
        <label>
          <input
            type="radio"
            value="D"
            checked={mode === "D"}
            onChange={() => setMode("D")}
          />{" "}
          D – Kurzbrief erzeugen
        </label>
      </div>

      <h3 style={{ marginTop: 16 }}>Feineinstellungen</h3>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <label>
          Stil:{" "}
          <select
            value={stil}
            onChange={(e) => setStil(e.target.value as Stil)}
          >
            <option value="knapp">knapp</option>
            <option value="neutral">neutral</option>
            <option value="ausführlicher">ausführlicher</option>
          </select>
        </label>
        <label>
          Ansprache:{" "}
          <select
            value={ansprache}
            onChange={(e) => setAnsprache(e.target.value as Ansprache)}
          >
            <option value="sie">Sie</option>
            <option value="neutral">neutral ohne Anrede</option>
          </select>
        </label>
      </div>

      <button
        onClick={onImproveClick}
        disabled={loading}
        style={{
          marginTop: 16,
          padding: "8px 16px",
          backgroundColor: "#0078d4",
          color: "white",
          border: "none",
          borderRadius: 4,
          cursor: loading ? "default" : "pointer",
        }}
        title="Befund verbessern"
      >
        {loading ? "Verarbeite..." : "Befund verbessern"}
      </button>

      {!isOffice && (
        <div
          style={{
            marginTop: 16,
            background: "#fffef2",
            border: "1px solid #eee0a3",
            padding: 12,
            borderRadius: 4,
          }}
        >
          <strong>Browser-Demo (ohne Office):</strong>
          <p style={{ marginTop: 8 }}>
            Füge hier Testtext ein und klicke „Befund verbessern“. Im Word-Add-in
            wird stattdessen die Markierung bzw. das ganze Dokument verarbeitet.
          </p>
          <textarea
            value={browserInput}
            onChange={(e) => setBrowserInput(e.target.value)}
            rows={6}
            style={{ width: "100%", fontFamily: "inherit" }}
            placeholder="Hier Test-Befundtext einfügen…"
          />
        </div>
      )}

      {error && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            background: "#fff0f0",
            border: "1px solid #ffcccc",
            borderRadius: 4,
            color: "#a80000",
          }}
        >
          <strong>Fehler:</strong> {error}
        </div>
      )}

      {(lastOriginal || lastResult) && (
        <div
          style={{
            marginTop: 20,
            padding: 12,
            border: "1px solid #ccc",
            borderRadius: 4,
            background: "#f9f9f9",
          }}
        >
          <h4 style={{ marginTop: 0 }}>Ergebnis</h4>
          {lastOriginal && (
            <details open>
              <summary>Original</summary>
              <pre style={{ whiteSpace: "pre-wrap" }}>{lastOriginal}</pre>
            </details>
          )}
          {lastResult && (
            <>
              <h5 style={{ marginBottom: 4, marginTop: 12 }}>Vorschlag</h5>
              <pre style={{ whiteSpace: "pre-wrap" }}>{lastResult}</pre>
            </>
          )}
          <p style={{ color: "red", fontSize: 12, marginTop: 12 }}>{DISCLAIMER}</p>
        </div>
      )}
    </div>
  );
}

// Mount
const el = document.getElementById("container");
if (el) {
  const root = createRoot(el);
  root.render(<App />);
} else {
  // Falls HTML aus Versehen keinen Container hat
  const fallback = document.createElement("div");
  fallback.id = "container";
  document.body.appendChild(fallback);
  const root = createRoot(fallback);
  root.render(<App />);
}