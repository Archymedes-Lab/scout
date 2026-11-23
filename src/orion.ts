import { createHash } from "node:crypto";
import * as orionEngine from "../../orion/src/decision-engine/index.ts";
import { buildOptionsFromScores, hasSignal } from "../../orion/src/ai/model.ts";
import { factorScoreQuestion, scoreToValue, systemOne, type SystemOneQuestion } from "../../orion/server/typesafe.ts";
import { briefText, SEGMENTS } from "./brief.ts";
import { leadSubject, placeSubject, type Store } from "./db.ts";
import { THEMES, typeLabel } from "./places.ts";
import { TIER_LABEL, type TierRecord } from "./tiers.ts";
import type { Band, Move, NewLead, NewPlace, PlaceMove, Verdict } from "./types.ts";

/**
 * Orion decides what to do about each lead and each place; Scout never re-implements its math. Jev scores every move × factor
 * with Orion's own factor question, then Orion's deterministic engine ranks, applies the hard rules below,
 * measures sensitivity and reports uncertainty. The model scores; the math decides.
 */
interface Engine {
  scoreAll: (o: unknown[], f: unknown[]) => unknown[];
  sensitivity: (o: unknown[], f: unknown[]) => { flips: { description: string }[]; dominantFactors: { label: string; impact: number }[]; stable: boolean };
  evaluatePolicy: (i: Record<string, unknown>) => {
    verdict: string;
    recommendation: { optionId: string; confidence: number } | null;
    leader: { gap: number | null; confidence: number } | null;
    ranking: { optionId: string; score: number }[];
    blockedOptions: { optionId: string; reason: string }[];
    reasons: { text: string }[];
    needsReview: boolean;
  };
  uncertaintyBand: (o: unknown, f: unknown[]) => Band;
  buildOptionsFromScores: (o: { id: string; label: string }[], f: unknown[], s: unknown[] | null, extras?: { reversibility?: Record<string, number> }) => unknown[];
  hasSignal: (o: unknown[]) => boolean;
}
const ENGINE = { ...orionEngine, buildOptionsFromScores, hasSignal } as unknown as Engine;

export interface Score { optionId: string; factorId: string; value: number; probabilityConfidence: number }
export type Scorer = (input: { context: string; stakes: string; options: { id: string; label: string }[]; factors: { id: string; label: string }[] }) => Promise<{ scores: Score[]; model?: string }>;

/** Jev scores every move × factor in one batched request, using Orion's factor question and scale. */
export const jevScorer: Scorer = async (input) => {
  const apiKey = process.env.TYPESAFE_API_KEY?.trim();
  if (!apiKey) throw new Error("TYPESAFE_API_KEY is not set, so Jev cannot score.");
  const questions: Record<string, SystemOneQuestion> = {};
  const pairs: { key: string; optionId: string; factorId: string }[] = [];
  input.options.forEach((o, i) => input.factors.forEach((f, j) => {
    const key = `s_${i}_${j}`;
    questions[key] = factorScoreQuestion(o.label, f.label);
    pairs.push({ key, optionId: o.id, factorId: f.id });
  }));
  const res = await systemOne({ decision: input.context, stakes: input.stakes }, questions, { apiKey, timeoutMs: 60_000 });
  const scores = pairs.map(({ key, optionId, factorId }) => {
    const a = res.answers[key];
    if (!a || a.type !== "score") throw new Error("Incomplete Jev scores");
    return { optionId, factorId, value: scoreToValue(a.score), probabilityConfidence: Math.max(0, Math.min(1, a.confidence)) };
  });
  return { scores, model: res.model };
};

/** Weights are our assumptions for a pre-revenue lab selling a $79/yr seat; printed in the report, meant to be argued with. */
export const FACTORS: { id: string; label: string; weight: number }[] = [
  { id: "fit", label: "Fit: runs AI agents on Windows or Linux", weight: 0.2 },
  { id: "pain", label: "Pain shown in their own words", weight: 0.16 },
  { id: "reach", label: "A welcome, sanctioned way to reach them", weight: 0.14 },
  { id: "pay", label: "Ability and will to pay for a seat", weight: 0.12 },
  { id: "seats", label: "Seats or machines they could cover", weight: 0.1 },
  { id: "speed", label: "Speed to a first paid seat", weight: 0.1 },
  { id: "spam", label: "Low risk of looking like spam", weight: 0.1 },
  { id: "time", label: "Low founder time", weight: 0.08 },
];

export const MOVES: { key: Move; label: string; reversibility: number; verb: (n: string) => string }[] = [
  { key: "reach_now", label: "Reach now", reversibility: 0.6, verb: (n) => `Email ${n} now through the approval queue` },
  { key: "reply_public", label: "Reply in thread", reversibility: 0.5, verb: (n) => `Reply helpfully in ${n}'s public thread, disclosing we make Argus` },
  { key: "nurture", label: "Nurture", reversibility: 0.95, verb: (n) => `Nurture ${n}: watch, and reach them with content later` },
  { key: "skip", label: "Skip", reversibility: 0.9, verb: (n) => `Skip ${n}` },
];

export const moveLabel = (k: string | null | undefined) => MOVES.find((m) => m.key === k)?.label ?? "Not assessed";

const clip = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1)}…`);
const r2 = (n: number) => Math.round(n * 100) / 100;

export function moveOptions(l: NewLead) {
  const n = clip(l.title, 40);
  return MOVES.map((m) => ({ id: m.key, label: clip(m.verb(n), 80) }));
}

/** Rules from the data, never from the model. */
export function blockedMoves(l: NewLead): { move: Move; reason: string }[] {
  const out: { move: Move; reason: string }[] = [];
  const add = (move: Move, reason: string) => { if (!out.some((o) => o.move === move)) out.push({ move, reason }); };
  if (l.platform === "mac") { add("reach_now", "Argus has no macOS edition"); add("reply_public", "Argus has no macOS edition"); }
  if (l.kind === "vendor") { add("reach_now", "A security vendor, not a user"); add("reply_public", "A security vendor, not a user"); }
  if (!l.email) add("reach_now", "No email found; gtm sends only to a sourced address");
  if (l.kind !== "thread") add("reply_public", "Not a public thread");
  return out;
}

const tierLine = (t: TierRecord | null | undefined, what: string) =>
  t && !t.error ? `${what}: ${TIER_LABEL[t.tier]?.toUpperCase() ?? t.tier} (Jev, p=${(t.probabilities[t.tier] ?? 0).toFixed(2)}).` : "";

export function leadContext(l: NewLead, tier: TierRecord | null = null): string {
  const seg = SEGMENTS.find((s) => s.id === l.segment);
  const head = `DECISION: What should Archymedes do about this potential Argus user: email them now, reply in their public thread, nurture, or skip? Judge on what the page shows, not on prestige.\n\n`;
  const lead = [
    `LEAD: ${l.title} (${l.kind}). Found as: ${seg?.label ?? l.segment}.`,
    `URL: ${l.url}`,
    `PLATFORM SEEN: ${l.platform}. EMAIL FOUND: ${l.email ? "yes" : "no"}.${l.publishedAt ? ` PUBLISHED: ${l.publishedAt.slice(0, 10)}.` : ""}`,
    tierLine(tier, "BUYER TYPE"),
    `WHAT THE PAGE SAYS: ${clip(l.snippet || "(nothing extracted)", 700)}`,
  ].filter(Boolean).join("\n");
  return `${head}${briefText(Math.max(800, 3800 - head.length - lead.length))}\n\n${lead}`;
}

// ── Places ──────────────────────────────────────────────────────────

/** Weights are our assumptions; printed in the report and the app, meant to be argued with. */
export const PLACE_FACTORS: { id: string; label: string; weight: number }[] = [
  { id: "fit", label: "Audience runs AI agents on Windows or Linux", weight: 0.2 },
  { id: "intent", label: "Audience feels the problem Argus solves", weight: 0.14 },
  { id: "size", label: "Size of the reachable audience", weight: 0.12 },
  { id: "open", label: "Welcomes a maker sharing a useful tool", weight: 0.14 },
  { id: "speed", label: "Speed to first users", weight: 0.12 },
  { id: "cost", label: "Low cost in money and founder time", weight: 0.1 },
  { id: "trust", label: "Credibility with security-minded developers", weight: 0.1 },
  { id: "compound", label: "Keeps paying off after the first month", weight: 0.08 },
];

export const PLACE_MOVES: { key: PlaceMove; label: string; reversibility: number; verb: (n: string) => string }[] = [
  { key: "engage", label: "Engage now", reversibility: 0.6, verb: (n) => `Engage in ${n} this week: post, reply, list or apply` },
  { key: "prepare", label: "Prepare first", reversibility: 0.85, verb: (n) => `Prepare an asset for ${n} first: a talk, guest post, listing or pitch` },
  { key: "later", label: "Later", reversibility: 0.95, verb: (n) => `Come back to ${n} after the first paid seats` },
  { key: "skip", label: "Skip", reversibility: 0.9, verb: (n) => `Skip ${n}` },
];

export const placeMoveLabel = (k: string | null | undefined) => PLACE_MOVES.find((m) => m.key === k)?.label ?? "Not assessed";

export function placeBlocked(p: NewPlace): { move: PlaceMove; reason: string }[] {
  return p.noPromo ? [{ move: "engage", reason: "Its rules forbid self-promotion: contribute first, or prepare something they invite" }] : [];
}

export function placeContext(p: NewPlace & { hits?: number }, tier: TierRecord | null = null): string {
  const head = `DECISION: Should Archymedes promote Argus in this place: engage now (post, reply, list or apply this week), prepare an asset first (a talk, guest post, listing or sponsorship pitch), come back later, or skip? Judge the audience, not the brand.\n\n`;
  const place = [
    `PLACE: ${p.name} (${typeLabel(p.type)}).${p.url ? ` URL: ${p.url}` : ""}`,
    `AUDIENCE SIZE: ${p.size ? p.size.toLocaleString("en-US") : "not stated"}. THEMES: ${p.themes.map((t) => THEMES.find((x) => x.id === t)?.label ?? t).join(", ") || "unknown"}.`,
    tierLine(tier, "AUDIENCE").replace("PAYING PROSPECT", "MOSTLY PAYING BUYERS").replace("FREE USER", "MOSTLY FREE USERS"),
    `RULES: ${p.noPromo ? "the page says no self-promotion" : "no rule against self-promotion seen"}.${p.hits ? ` Surfaced by ${p.hits} searches.` : ""}`,
    `WHAT THE PAGE SAYS: ${clip(p.description || "(nothing extracted)", 700)}`,
  ].filter(Boolean).join("\n");
  return `${head}${briefText(Math.max(800, 3800 - head.length - place.length))}\n\n${place}`;
}

// ── The shared Orion run ───────────────────────────────────────────

export const hashInputs = (parts: unknown) => createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 16);

interface Spec {
  options: { id: string; label: string }[];
  factors: { id: string; label: string; weight: number }[];
  reversibility: Record<string, number>;
  blocked: { move: string; reason: string }[];
  label: (id: string) => string;
}

export function judge(spec: Spec, scores: Score[], engine: Engine = ENGINE) {
  const factors = spec.factors.map((f) => ({ ...f, provenance: "MODEL_ASSUMED" }));
  const built = engine.buildOptionsFromScores(spec.options, factors, scores, { reversibility: spec.reversibility });
  const constraints = spec.blocked.map((b, i) => ({ id: `rule-${i}`, name: b.reason, type: "HARD", optionIds: [b.move] }));
  const scored = engine.scoreAll(built, factors);
  const sens = engine.sensitivity(built, factors);
  const policy = engine.evaluatePolicy({ scored, options: built, factors, constraints, sensitivity: sens, safety: "normal", stakes: "moderate", hasSignal: engine.hasSignal(built) });
  const bands = Object.fromEntries(built.map((b) => {
    const band = engine.uncertaintyBand(b, factors);
    return [(b as { id: string }).id, { jev: r2(band.jev), low: r2(band.low), high: r2(band.high) }];
  })) as Record<string, Band>;
  // Orion's policy enforces HARD constraints itself; the invariant tests hold it to that.
  const pick = policy.verdict === "recommend" ? policy.recommendation?.optionId ?? null : null;
  return {
    verdict: policy.verdict, pick,
    gap: policy.leader?.gap ?? null, confidence: policy.leader?.confidence ?? policy.recommendation?.confidence ?? null,
    stable: sens.stable, needsReview: policy.needsReview, bands,
    ranking: policy.ranking.map((x) => ({ id: x.optionId, label: spec.label(x.optionId), score: r2(x.score) })),
    reasons: policy.reasons.map((x) => x.text).slice(0, 5),
    flips: sens.flips.map((f) => f.description).slice(0, 3),
    drivers: sens.dominantFactors.slice(0, 4).map((d) => ({ label: d.label, impact: r2(d.impact) })),
    blocked: [
      ...policy.blockedOptions.map((b) => ({ option: b.optionId, reason: b.reason })),
      ...spec.blocked.filter((b) => !policy.blockedOptions.some((p) => p.optionId === b.move)).map((b) => ({ option: b.move, reason: b.reason })),
    ],
  };
}

export function verdictLabel(verdict: string, pick: string | null, label: (id: string) => string): string {
  if (pick) return label(pick);
  if (verdict === "tie") return "Too close to call";
  if (verdict === "insufficient-information") return "Not enough signal";
  return "Needs review";
}

export interface AssessDeps { scorer?: Scorer; force?: boolean }

/** Cached by input hash: unchanged subjects cost no Jev calls; a failed call keeps the last good verdict. */
async function assess(store: Store, subject: string, context: string, spec: Spec, deps: AssessDeps): Promise<Verdict> {
  const inputHash = hashInputs([spec.options, spec.factors.map((f) => [f.label, f.weight]), context]);
  const prev = store.judgment(subject);
  const at = new Date().toISOString();
  let scores = prev && prev.inputHash === inputHash && !deps.force ? (store.judgmentScores(subject) as Score[] | null) : null;
  let model = prev?.model ?? null;
  if (!scores) {
    try {
      const r = await (deps.scorer ?? jevScorer)({ context, stakes: "moderate", options: spec.options, factors: spec.factors.map((f) => ({ id: f.id, label: f.label })) });
      if (r.scores.length !== spec.options.length * spec.factors.length) throw new Error("Jev returned an incomplete score set");
      scores = r.scores; model = r.model ?? null;
    } catch (e) {
      return {
        subject, status: "unavailable", verdict: "insufficient-information", pick: null, label: "Not assessed", gap: null, confidence: null,
        stable: null, needsReview: true, bands: {}, ranking: [], reasons: [], flips: [], drivers: [], blocked: [], model: null, inputHash,
        error: e instanceof Error ? e.message : String(e), at,
      };
    }
  }
  const j = judge(spec, scores);
  const v: Verdict = {
    subject, status: j.verdict === "insufficient-information" ? "unavailable" : "assessed", verdict: j.verdict, pick: j.pick as Verdict["pick"],
    label: verdictLabel(j.verdict, j.pick, spec.label), gap: j.gap === null ? null : r2(j.gap), confidence: j.confidence === null ? null : r2(j.confidence),
    stable: j.stable, needsReview: j.needsReview, bands: j.bands, ranking: j.ranking, reasons: j.reasons, flips: j.flips, drivers: j.drivers,
    blocked: j.blocked, model, inputHash, error: j.verdict === "insufficient-information" ? "Orion had no usable estimates." : null, at,
  };
  store.saveJudgment(v, scores);
  return v;
}

export async function assessLead(store: Store, leadId: number, deps: AssessDeps = {}): Promise<Verdict> {
  const lead = store.lead(leadId);
  if (!lead) throw new Error(`No lead ${leadId}`);
  return assess(store, leadSubject(leadId), leadContext(lead, store.tier(leadSubject(leadId))), {
    options: moveOptions(lead), factors: FACTORS, reversibility: Object.fromEntries(MOVES.map((m) => [m.key, m.reversibility])),
    blocked: blockedMoves(lead), label: moveLabel,
  }, deps);
}

export async function assessPlace(store: Store, key: string, deps: AssessDeps = {}): Promise<Verdict> {
  const place = store.place(key);
  if (!place) throw new Error(`No place ${key}`);
  const n = clip(place.name, 40);
  return assess(store, placeSubject(key), placeContext(place, store.tier(placeSubject(key))), {
    options: PLACE_MOVES.map((m) => ({ id: m.key, label: clip(m.verb(n), 80) })), factors: PLACE_FACTORS,
    reversibility: Object.fromEntries(PLACE_MOVES.map((m) => [m.key, m.reversibility])), blocked: placeBlocked(place), label: placeMoveLabel,
  }, deps);
}

export interface RunOpts { concurrency?: number; onProgress?: (done: number, total: number) => void; onItem?: (name: string, v: Verdict) => void }

async function each<T>(items: T[], n: number, fn: (x: T) => Promise<Verdict>, o: RunOpts, name: (x: T) => string) {
  let assessed = 0, failed = 0, done = 0, i = 0;
  await Promise.all(Array.from({ length: Math.max(1, Math.min(n, items.length)) }, async () => {
    while (i < items.length) {
      const x = items[i++]!;
      const v = await fn(x);
      v.status === "assessed" ? assessed++ : failed++;
      o.onItem?.(name(x), v);
      o.onProgress?.(++done, items.length);
    }
  }));
  return { assessed, failed };
}

export function assessAll(store: Store, deps: AssessDeps = {}, o: RunOpts = {}) {
  return each(store.leads(), o.concurrency ?? 4, (l) => assessLead(store, l.id, deps), o, (l) => l.title);
}

export function triagePlaces(store: Store, deps: AssessDeps = {}, o: RunOpts = {}) {
  return each(store.places(), o.concurrency ?? 4, (p) => assessPlace(store, p.key, deps), o, (p) => p.name);
}

/** Orion's best score for a subject's pick, for ordering. */
export const topScore = (v: Verdict | null) => (v?.pick ? v.ranking.find((r) => r.id === v.pick)?.score ?? 0 : -Infinity);
