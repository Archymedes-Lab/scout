import { createHash } from "node:crypto";
import { systemOne } from "../../orion/server/typesafe.ts";
import { leadSubject, placeSubject, type Store } from "./db.ts";
import type { Lead, Place } from "./types.ts";

/**
 * Free users and paying users. Jev answers one typed choice per lead ("paying", "free" or not a user) and per place
 * (whose audience is mostly paying buyers, free users, both, or unclear). The answer is stored with its probabilities
 * and fed into Orion's context, so a team with a budget and a hobbyist are judged as what they are.
 */
export const LEAD_TIERS = ["paying", "free", "none"] as const;
export const PLACE_TIERS = ["paying", "free", "mixed", "unclear"] as const;
export type Tier = (typeof LEAD_TIERS)[number] | (typeof PLACE_TIERS)[number];

const LEAD_CRITERIA: Record<(typeof LEAD_TIERS)[number], string> = {
  paying: "A team or business with a budget that would pay for Argus seats on several machines: an agency, a company's engineering or platform team, a startup facing a security review, an IT provider",
  free: "An individual developer, student, hobbyist or open-source maintainer who would use Argus on their own machine without paying",
  none: "Not a potential Argus user: a security vendor, a news or marketing page, a page with no person or team behind it, or someone on macOS only",
};
const PLACE_CRITERIA: Record<(typeof PLACE_TIERS)[number], string> = {
  paying: "Mostly people who buy software for a team: founders, CTOs, engineering managers, agency owners, IT providers",
  free: "Mostly individual developers, students and hobbyists",
  mixed: "Both buyers for teams and individual users, in meaningful numbers",
  unclear: "Cannot tell from what is known",
};

export const TIER_LABEL: Record<string, string> = { paying: "Paying prospect", free: "Free user", none: "Not a user", mixed: "Paying and free", unclear: "Unclear" };

export interface TierRecord {
  subject: string;
  tier: Tier;
  probabilities: Record<string, number>;
  model: string | null;
  inputHash: string;
  error: string | null;
  at: string;
}

export type TierJudge = (input: { state: Record<string, unknown>; question: string; options: string[]; criteria: Record<string, string> }) =>
  Promise<{ tier: string; probabilities: Record<string, number>; model?: string }>;

export const jevTierJudge: TierJudge = async ({ state, question, criteria }) => {
  const apiKey = process.env.TYPESAFE_API_KEY?.trim();
  if (!apiKey) throw new Error("TYPESAFE_API_KEY is not set, so Jev cannot judge free or paying.");
  const res = await systemOne(state, { tier: { type: "choice", instructions: question, criteria } }, { apiKey, timeoutMs: 45_000 });
  const a = res.answers.tier;
  if (!a || a.type !== "choice") throw new Error("Jev gave no tier");
  return { tier: a.choice, probabilities: a.probabilities, model: res.model };
};

const hash = (x: unknown) => createHash("sha256").update(JSON.stringify(x)).digest("hex").slice(0, 16);
const r2 = (n: number) => Math.round(n * 100) / 100;

async function classify(store: Store, subject: string, state: Record<string, unknown>, question: string, criteria: Record<string, string>, fallback: Tier, deps: TierDeps): Promise<TierRecord> {
  const options = Object.keys(criteria);
  const inputHash = hash([state, question, criteria]);
  const prev = store.tier(subject);
  if (prev && prev.inputHash === inputHash && !deps.force) return prev;
  const at = new Date().toISOString();
  try {
    const r = await (deps.judge ?? jevTierJudge)({ state, question, options, criteria });
    const probabilities = Object.fromEntries(options.map((o) => [o, r2(r.probabilities[o] ?? 0)]));
    // A judge may only answer with an allowed tier: otherwise take the likeliest allowed one, or the fallback.
    const best = options.reduce((a, b) => ((probabilities[b] ?? 0) > (probabilities[a] ?? 0) ? b : a), fallback as string);
    const tier = (options.includes(r.tier) ? r.tier : (probabilities[best] ?? 0) > 0 ? best : fallback) as Tier;
    const rec: TierRecord = { subject, tier, probabilities, model: r.model ?? null, inputHash, error: null, at };
    store.saveTier(rec);
    return rec;
  } catch (e) {
    // Never overwrite the last good answer with a failure.
    const error = e instanceof Error ? e.message : String(e);
    return { ...(prev ?? { subject, tier: fallback, probabilities: {}, model: null, inputHash, at }), error };
  }
}

export interface TierDeps { judge?: TierJudge; force?: boolean }

export function classifyLead(store: Store, id: number, deps: TierDeps = {}): Promise<TierRecord> {
  const l = store.lead(id);
  if (!l) throw new Error(`No lead ${id}`);
  return classify(store, leadSubject(id), leadState(l), "Is `lead` a paying prospect for Argus (a security guardian for machines that run AI coding agents, $79 per seat per year), a free user, or not a potential user at all? Judge from what the page shows.", LEAD_CRITERIA, "none", deps);
}

export function classifyPlace(store: Store, key: string, deps: TierDeps = {}): Promise<TierRecord> {
  const p = store.place(key);
  if (!p) throw new Error(`No place ${key}`);
  return classify(store, placeSubject(key), placeState(p), "Who mostly gathers in `place`: people who would pay for Argus for a team, individuals who would use it free, both, or is it unclear?", PLACE_CRITERIA, "unclear", deps);
}

const leadState = (l: Lead) => ({ lead: { title: l.title, kind: l.kind, url: l.url, page: l.snippet.slice(0, 700), email_found: !!l.email, platform: l.platform } });
const placeState = (p: Place) => ({ place: { name: p.name, type: p.type, url: p.url, audience_size: p.size, about: p.description.slice(0, 500) } });

async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<unknown>, onProgress?: (d: number, t: number) => void) {
  let i = 0, done = 0;
  await Promise.all(Array.from({ length: Math.max(1, Math.min(n, items.length)) }, async () => {
    while (i < items.length) { await fn(items[i++]!); onProgress?.(++done, items.length); }
  }));
}

export async function classifyAll(store: Store, deps: TierDeps = {}, o: { concurrency?: number; onProgress?: (d: number, t: number) => void; what?: "leads" | "places" | "both" } = {}) {
  const tally: Record<string, number> = {};
  const count = (t: TierRecord) => { tally[t.error ? "failed" : t.tier] = (tally[t.error ? "failed" : t.tier] ?? 0) + 1; };
  const what = o.what ?? "both";
  const jobs: (() => Promise<TierRecord>)[] = [
    ...(what !== "places" ? store.leads().map((l) => () => classifyLead(store, l.id, deps)) : []),
    ...(what !== "leads" ? store.places().filter((p) => p.type !== "own").map((p) => () => classifyPlace(store, p.key, deps)) : []),
  ];
  await pool(jobs, o.concurrency ?? 6, async (j) => count(await j()), o.onProgress);
  return tally;
}
