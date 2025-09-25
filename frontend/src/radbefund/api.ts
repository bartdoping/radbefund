// src/radbefund/api.ts
export const API_BASE = "https://api.mylovelu.de"; // Produktions-Backend

type Mode = "A" | "B" | "C" | "D";
type Style = "knapp" | "neutral" | "ausführlicher";
type Address = "Sie" | "neutral";

export async function optimize(
  text: string,
  mode: Mode,
  options?: { style?: Style; address?: Address }
): Promise<string> {
  const res = await fetch(`${API_BASE}/optimize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, mode, options }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(msg || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.optimized || "";
}