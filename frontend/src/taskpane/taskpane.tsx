/* global Office, Word */
declare const Office: any;
declare const Word: any;

import * as React from "react";
import { optimize } from "../radbefund/api";
import { diff_match_patch, Diff } from "diff-match-patch";

const dmp = new diff_match_patch();

async function readSelectionOrDoc(): Promise<string> {
  const selected: string = await new Promise((resolve) => {
    Office.context.document.getSelectedDataAsync(
      Office.CoercionType.Text,
      (res: any) => resolve(typeof res?.value === "string" ? res.value : "")
    );
  });
  if (selected?.trim()) return selected;

  return Word.run(async (ctx: any) => {
    const body = ctx.document.body;
    body.load("text");
    await ctx.sync();
    return body.text || "";
  });
}

async function writeBack(text: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    Office.context.document.setSelectedDataAsync(
      text,
      { coercionType: Office.CoercionType.Text },
      (res: any) =>
        res.status === Office.AsyncResultStatus.Succeeded
          ? resolve()
          : reject(new Error("Konnte Text nicht schreiben."))
    );
  });
}

export default function App() {
  const [mode, setMode] = React.useState<"A" | "B" | "C" | "D">("A");
  const [style, setStyle] = React.useState<"knapp" | "neutral" | "ausführlicher">("neutral");
  const [address, setAddress] = React.useState<"Sie" | "neutral">("neutral");
  const [original, setOriginal] = React.useState("");
  const [optimized, setOptimized] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [showDiff, setShowDiff] = React.useState(false);

  async function onImprove() {
    setErr("");
    setOptimized("");
    setBusy(true);
    try {
      const input = await readSelectionOrDoc();
      if (!input.trim()) {
        setErr("Bitte erst einen Befund einfügen.");
        return;
      }
      setOriginal(input);
      const out = await optimize(input, mode, { style, address });
      setOptimized(out);
    } catch (e: any) {
      setErr(e?.message || "Fehler unbekannt");
    } finally {
      setBusy(false);
    }
  }

  async function onApply() {
    if (!optimized) return;
    try {
      await writeBack(optimized);
    } catch (e: any) {
      setErr(e?.message || "Fehler beim Einfügen.");
    }
  }

  function renderDiff(a: string, b: string) {
    const diffs: Diff[] = dmp.diff_main(a, b) as unknown as Diff[];
    dmp.diff_cleanupSemantic(diffs as any);
    return (
      <div style={{ fontFamily: "ui-monospace, Menlo, monospace", whiteSpace: "pre-wrap" }}>
        {(diffs as any[]).map(([op, txt], i) => {
          if (op === 0) return <span key={i}>{txt}</span>;
          if (op === -1) return <span key={i} style={{ background: "#ffe6e6" }}>{txt}</span>;
          return <span key={i} style={{ background: "#e6ffea" }}>{txt}</span>;
        })}
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "system-ui, Segoe UI, Helvetica, Arial", padding: 12, lineHeight: 1.35 }}>
      <h3 style={{ marginTop: 0 }}>Radiologische Befunde – sprachlich sauber, klar strukturiert.</h3>

      <div style={{ display: "grid", gap: 8 }}>
        <label><b>Modi</b></label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => setMode("A")} aria-pressed={mode === "A"}>A – Grammatik & Stil</button>
          <button onClick={() => setMode("B")} aria-pressed={mode === "B"}>B – Terminologie</button>
          <button onClick={() => setMode("C")} aria-pressed={mode === "C"}>C – In Vorlage</button>
          <button onClick={() => setMode("D")} aria-pressed={mode === "D"}>D – Kurzbrief</button>
        </div>

        <label><b>Feineinstellungen</b></label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div>
            <div>Stil</div>
            <select value={style} onChange={(e) => setStyle(e.target.value as any)}>
              <option value="knapp">knapp</option>
              <option value="neutral">neutral</option>
              <option value="ausführlicher">ausführlicher</option>
            </select>
          </div>
          <div>
            <div>Ansprache</div>
            <select value={address} onChange={(e) => setAddress(e.target.value as any)}>
              <option value="Sie">Sie</option>
              <option value="neutral">neutral ohne Anrede</option>
            </select>
          </div>
        </div>

        <button onClick={onImprove} disabled={busy} style={{ marginTop: 8 }}>
          Befund verbessern
        </button>

        {busy && <div>Bitte warten …</div>}
        {err && <div style={{ color: "#c00" }}>{err}</div>}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
          <div>
            <h4>Original</h4>
            <textarea readOnly value={original} style={{ width: "100%", height: 160 }} />
          </div>
          <div>
            <h4>Vorschlag</h4>
            {!showDiff ? (
              <textarea readOnly value={optimized} style={{ width: "100%", height: 160 }} />
            ) : (
              <div style={{ border: "1px solid #ccc", padding: 8, height: 160, overflow: "auto" }}>
                {renderDiff(original, optimized)}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onApply} disabled={!optimized}>Kopieren/Einfügen an Cursor</button>
          <button onClick={() => setOptimized("")}>Zurück zum Original</button>
          <button onClick={() => setShowDiff((s) => !s)} disabled={!optimized}>Änderungen anzeigen</button>
        </div>

        <div style={{ fontSize: 12, color: "#555", marginTop: 8 }}>
          Dieses Werkzeug verbessert Sprache und Struktur. Medizinische Bewertung bleibt bei Ihnen.
        </div>
      </div>
    </div>
  );
}