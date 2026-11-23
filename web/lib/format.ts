export type Tone = "neutral" | "signal" | "success" | "warning" | "danger";

export function ago(iso: string | null | undefined): string {
  if (!iso) return "never";
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const d = Math.floor(s / 86400);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export const big = (n: number | null | undefined) =>
  n == null ? "—" : n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(/\.0$/, "")}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n);
export const pct = (n: number) => `${Math.round(n * 100)}%`;
export const firstLine = (s: string, n = 140) => { const t = s.replace(/\s+/g, " ").trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
export const hostOf = (url: string | null) => { try { return url ? new URL(url).hostname.replace(/^www\./, "") : ""; } catch { return ""; } };

/** Move → tone. Places: engage / prepare / later / skip. Users: reach_now / reply_public / nurture / skip. */
export const moveTone = (pick: string | null | undefined): Tone =>
  pick === "engage" || pick === "reach_now" ? "signal"
    : pick === "prepare" || pick === "reply_public" ? "success"
      : pick === "later" || pick === "nurture" ? "warning"
        : pick === "skip" ? "danger" : "neutral";
