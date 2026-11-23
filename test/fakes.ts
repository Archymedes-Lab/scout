import type { Score, Scorer } from "../src/orion.ts";
import type { TierJudge } from "../src/tiers.ts";

/** Exa stand-in: a few fixed results per query, with one URL shared by every query to exercise dedupe. */
export function fakeExa(): typeof fetch {
  const pages = [
    { url: "https://www.reddit.com/r/ClaudeAI/comments/a1/my_agent_ran_rm_rf/", title: "My agent ran rm -rf on WSL2", highlights: ["Claude Code on Windows WSL2 deleted my files. How do I see what it touched?"] },
    { url: "https://acme-agency.io/", title: "Acme | Software agency in Kraków", highlights: ["We ship with AI coding agents on Linux servers. Contact hello@acme-agency.io"] },
    { url: "https://news.ycombinator.com/item?id=777", title: "Ask HN: Securing dev laptops that run agents?", highlights: ["Our team runs Codex on Windows and Ubuntu servers"] },
    { url: "https://maconly.dev/blog", title: "Agents on my MacBook", highlights: ["macOS only shop, contact me@maconly.dev"] },
  ];
  return (async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as { query?: string; numResults?: number; outputSchema?: unknown };
    const q = body.query ?? "";
    const own = { url: `https://example-${Math.abs(hash(q)) % 1000}.io/team`, title: `Team for ${q.slice(0, 20)}`, highlights: ["engineering team"] };
    const results = [...pages, own].slice(0, body.numResults ?? 5);
    // With an outputSchema, Exa also returns the places the pages name, and every call reports its cost.
    const output = body.outputSchema ? { content: { places: [{ name: "r/MentionedOnly", url: null, kind: "subreddit" }, { name: "No URL Discord", url: null, kind: "discord" }] }, grounding: [] } : undefined;
    return new Response(JSON.stringify({ results, output, costDollars: { total: 0.007 } }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
}

function hash(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return h;
}

/** Jev stand-in: deterministic scores from a seed, so tests can sweep many score sets. */
export function seededScorer(seed = 1): Scorer {
  return async ({ options, factors }) => {
    let s = seed;
    const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const scores: Score[] = [];
    for (const o of options) for (const f of factors) scores.push({ optionId: o.id, factorId: f.id, value: Math.round((rnd() * 20 - 10) * 100) / 100, probabilityConfidence: 0.5 + rnd() / 2 });
    return { scores, model: "fake" };
  };
}

/** Scores that make one move dominate every factor. */
export function favour(move: string): Scorer {
  return async ({ options, factors }) => ({
    scores: options.flatMap((o) => factors.map((f) => ({ optionId: o.id, factorId: f.id, value: o.id === move ? 9 : -6, probabilityConfidence: 0.9 }))),
    model: "fake",
  });
}

/** Free/paying stand-in: agencies, teams and providers pay; everyone else is free. */
export const fakeTier: TierJudge = async ({ state, options }) => {
  const text = JSON.stringify(state).toLowerCase();
  const tier = options.includes("mixed") ? (/agency|team/.test(text) ? "mixed" : "free") : /agency|team|provider/.test(text) ? "paying" : "free";
  return { tier, probabilities: Object.fromEntries(options.map((o) => [o, o === tier ? 0.8 : 0.2 / (options.length - 1)])), model: "fake" };
};
