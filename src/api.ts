import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { SEGMENTS } from "./brief.ts";
import { planPlaces, runCycle, seedPlaces, writeOutputs } from "./cycle.ts";
import { exaQuery, snippetOf } from "./exa.ts";
import { gtmRows, replyCandidates, toCsv } from "./handoff.ts";
import { discoverLeads, toLead } from "./leads.ts";
import { assessAll, assessPlace, FACTORS, MOVES, PLACE_FACTORS, PLACE_MOVES, topScore, triagePlaces, type Scorer } from "./orion.ts";
import { discoverPlaces, noPromo, PLACE_TYPES, placeFromUrl, retypePlatforms, sizeOf, THEMES } from "./places.ts";
import { FOCUS_GROUPS, focusGroupOf, focusKeys } from "./focus.ts";
import { findProspects } from "./prospects.ts";
import { report } from "./report.ts";
import { classifyAll, TIER_LABEL, type TierJudge } from "./tiers.ts";
import { leadSubject, placeSubject, type Store } from "./db.ts";
import type { PlaceStatus, PlaceType, Verdict } from "./types.ts";

/**
 * Scout's JSON API, served on loopback by src/server.ts and proxied by the web app. Long work (searching every place,
 * Orion over hundreds of subjects, cdm) runs as background jobs the web polls; one job per kind at a time.
 */
export interface ApiDeps { store: Store; fetcher?: typeof fetch; scorer?: Scorer; tierJudge?: TierJudge; cdmMock?: boolean; smallRun?: boolean }

export type JobKind = "places" | "plan" | "users" | "prospects" | "cycle";
const KINDS: JobKind[] = ["places", "plan", "users", "prospects", "cycle"];
export interface Job {
  id: string; kind: JobKind; status: "running" | "done" | "failed"; startedAt: string; finishedAt: string | null;
  step: string; done: number; total: number; log: string[]; error: string | null; result: unknown;
}

const json = (data: unknown, status = 200) => Response.json(data, { status });
const bad = (error: string, status = 400) => json({ error }, status);
const STATUSES: (PlaceStatus | null)[] = ["doing", "done", "dismissed", null];
const MOVE_ORDER = ["engage", "prepare", "later", "skip"];

export function createApi(deps: ApiDeps) {
  const { store } = deps;
  seedPlaces(store);
  retypePlatforms(store);
  const jobs = new Map<string, Job>();
  const scope = deps.smallRun ? { types: ["subreddit", "newsletter", "event"], themes: ["ai_agents", "selfhosted"], perQuery: 4 } : {};
  const assessDeps = { scorer: deps.scorer };

  function start(kind: JobKind, types?: string[]): Job {
    const running = [...jobs.values()].find((j) => j.kind === kind && j.status === "running");
    if (running) return running;
    const job: Job = { id: crypto.randomUUID().slice(0, 8), kind, status: "running", startedAt: new Date().toISOString(), finishedAt: null, step: "Starting", done: 0, total: 0, log: [], error: null, result: null };
    jobs.set(job.id, job);
    const log = (m: string) => { job.log.push(`${new Date().toISOString().slice(11, 19)} ${m}`); if (job.log.length > 400) job.log.shift(); };
    const progress = (step: string) => (done: number, total: number) => { job.step = step; job.done = done; job.total = total; };
    const work = async (): Promise<unknown> => {
      switch (kind) {
        case "places": {
          const found = await discoverPlaces(store, { fetcher: deps.fetcher, ...scope, ...(types?.length ? { types } : {}), onProgress: progress("Searching places") });
          found.errors.forEach((e) => log(`! ${e}`));
          if (found.fatal) throw new Error(`Exa stopped the search: ${found.fatal}`);
          log(`${found.added} new places from ${found.searches} searches ($${found.cost.toFixed(3)})`);
          await classifyAll(store, { judge: deps.tierJudge }, { what: "places", onProgress: progress("Jev: who gathers there") });
          const t = await triagePlaces(store, assessDeps, { onProgress: progress("Orion: places") });
          log(`Orion judged ${t.assessed} places (${t.failed} not assessed)`);
          return { ...found, ...t };
        }
        case "plan": {
          job.step = "cdm weighing the top places";
          const d = await planPlaces(store, { cdmMock: deps.cdmMock });
          log(`commit ${d.commit}, innovation ${d.innovation ?? "none"}`);
          return d;
        }
        case "users": {
          job.step = "Searching for users";
          const found = await discoverLeads(store, { fetcher: deps.fetcher, perQuery: scope.perQuery });
          found.errors.forEach((e) => log(`! ${e}`));
          log(`${found.added} new users of ${found.found} results`);
          await classifyAll(store, { judge: deps.tierJudge }, { what: "leads", onProgress: progress("Jev: free or paying") });
          const a = await assessAll(store, assessDeps, { onProgress: progress("Orion: users") });
          writeOutputs(store);
          return { ...found, ...a };
        }
        case "prospects": {
          job.step = "Exa agent: building a list of paying prospects";
          const r = await findProspects(store, { fetcher: deps.fetcher, ...(deps.smallRun ? { pollMs: 1 } : {}), onStatus: (st) => { job.step = `Exa agent: ${st}`; } });
          log(`Exa agent run ${r.runId}: ${r.found} prospects, ${r.added} new ($${r.cost.toFixed(2)}, ${r.stopReason ?? "done"})`);
          await classifyAll(store, { judge: deps.tierJudge }, { what: "leads", onProgress: progress("Jev: free or paying") });
          const a = await assessAll(store, assessDeps, { onProgress: progress("Orion: users") });
          writeOutputs(store);
          return { ...r, ...a };
        }
        case "cycle": {
          const r = await runCycle(store, { fetcher: deps.fetcher, scorer: deps.scorer, tierJudge: deps.tierJudge, cdmMock: deps.cdmMock, ...scope, log, onProgress: (s, d, t) => progress(s)(d, t) });
          r.errors.forEach((e) => log(`! ${e}`));
          return r;
        }
      }
    };
    work().then((result) => { job.result = result; job.status = "done"; job.step = "Done"; })
      .catch((e) => { job.error = e instanceof Error ? e.message : String(e); job.status = "failed"; log(`! ${job.error}`); })
      .finally(() => { job.finishedAt = new Date().toISOString(); });
    return job;
  }

  // Lists carry what a card shows; the full reasoning (bands, reasons, drivers…) comes from /places/:key.
  const lean = (v: Verdict | null | undefined) => (v ? { status: v.status, verdict: v.verdict, pick: v.pick, label: v.label, confidence: v.confidence, gap: v.gap, stable: v.stable, score: topScore(v) } : null);
  const placeRows = () => {
    const verdicts = store.allJudgments("place:"), tiers = store.allTiers("place:");
    const focus = new Set(focusKeys(store, undefined, verdicts));
    return store.places().map((p) => ({ ...p, full: verdicts.get(placeSubject(p.key)) ?? null, tier: tiers.get(placeSubject(p.key)) ?? null, focus: focus.has(p.key), group: focusGroupOf(p.type) }))
    .sort((a, b) => {
      const ma = a.full?.pick ? MOVE_ORDER.indexOf(a.full.pick) : 9, mb = b.full?.pick ? MOVE_ORDER.indexOf(b.full.pick) : 9;
      return Number(b.focus) - Number(a.focus) || ma - mb || topScore(b.full) - topScore(a.full) || b.hits - a.hits;
    }).map(({ full, ...p }) => ({ ...p, verdict: lean(full) }));
  };
  const leadRows = () => { const verdicts = store.allJudgments("lead:"), tiers = store.allTiers("lead:"); return store.leads().map((l) => ({ ...l, verdict: verdicts.get(leadSubject(l.id)) ?? null, tier: tiers.get(leadSubject(l.id)) ?? null, segmentLabel: SEGMENTS.find((s) => s.id === l.segment)?.label ?? (l.segment === "prospects" ? "Paying prospects (Exa agent)" : l.segment === "search" ? "Your search" : l.segment) })); };
  const tierIs = (t: { tier: string } | null, want: string | null) => !want || (want === "none" ? !t : t?.tier === want);

  async function route(req: Request, path: string): Promise<Response> {
    const url = new URL(req.url);
    const q = url.searchParams;
    const method = req.method;
    const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
    const body = async () => (await req.json().catch(() => ({}))) as Record<string, unknown>;

    if (method === "GET" && path === "/health") {
      return json({
        exa: !!deps.fetcher || !!process.env.EXA_API_KEY?.trim(), jev: !!deps.scorer || !!process.env.TYPESAFE_API_KEY?.trim(),
        orion: true, cdm: !!deps.cdmMock || existsSync(process.env.CDM_PROJECT ?? join(homedir(), "creative-decision")),
      });
    }
    if (method === "GET" && path === "/taxonomy") {
      return json({
        types: PLACE_TYPES.map(({ id, label, plural, search }) => ({ id, label, plural, search })), themes: THEMES,
        placeMoves: PLACE_MOVES.map(({ key, label }) => ({ key, label })), placeFactors: PLACE_FACTORS,
        leadMoves: MOVES.map(({ key, label }) => ({ key, label })), leadFactors: FACTORS, segments: SEGMENTS,
      });
    }
    if (method === "GET" && path === "/overview") {
      const places = placeRows(), leads = leadRows();
      const count = (xs: { verdict: { pick: string | null } | null }[], k: string) => xs.filter((x) => x.verdict?.pick === k).length;
      const byType = Object.fromEntries(PLACE_TYPES.map((t) => [t.id, places.filter((p) => p.type === t.id).length]));
      return json({
        counts: { places: places.length, engage: count(places, "engage"), prepare: count(places, "prepare"), leads: leads.length,
          reachNow: count(leads, "reach_now"), replyPublic: count(leads, "reply_public"), searches: store.searches(100000).length,
          focus: places.filter((p) => p.focus).length, paying: leads.filter((l) => l.tier?.tier === "paying").length, free: leads.filter((l) => l.tier?.tier === "free").length },
        spend: Math.round(store.spend() * 1000) / 1000, tierLabels: TIER_LABEL,
        byType, decision: store.latestChannelDecision(),
        topPlaces: places.filter((p) => p.focus), focusGroups: FOCUS_GROUPS.map(({ id, label }) => ({ id, label })),
        topLeads: leads.filter((l) => l.verdict?.pick === "reach_now" || l.verdict?.pick === "reply_public").sort((a, b) => topScore(b.verdict) - topScore(a.verdict)).slice(0, 8),
        jobs: [...jobs.values()].reverse().slice(0, 5),
      });
    }
    if (method === "GET" && path === "/places") {
      const type = q.get("type"), move = q.get("move"), text = q.get("q")?.toLowerCase(), status = q.get("status"), tier = q.get("tier"), focus = q.get("focus"), group = q.get("group");
      return json(placeRows().filter((p) => (!type || p.type === type) && (!group || p.group === group) && tierIs(p.tier, tier) && (!focus || p.focus)
        && (!move || (move === "none" ? !p.verdict?.pick : p.verdict?.pick === move))
        && (!status || (status === "none" ? !p.status : p.status === status))
        && (!text || `${p.name} ${p.description} ${p.key}`.toLowerCase().includes(text))));
    }
    if (parts[0] === "places" && parts[1]) {
      const key = parts[1];
      const place = store.place(key);
      if (!place) return bad("No such place", 404);
      if (method === "GET" && parts.length === 2) return json({ ...place, verdict: store.placeVerdict(key), tier: store.tier(placeSubject(key)), focus: focusKeys(store).includes(key), group: focusGroupOf(place.type) });
      if (method === "POST" && parts[2] === "status") {
        const s = (await body()).status ?? null;
        if (!STATUSES.includes(s as PlaceStatus | null)) return bad("status must be doing, done, dismissed or null");
        store.setPlaceStatus(key, s as PlaceStatus | null);
        return json({ ...store.place(key), verdict: store.placeVerdict(key) });
      }
      if (method === "POST" && parts[2] === "assess") return json(await assessPlace(store, key, { ...assessDeps, force: true }));
    }
    if (method === "GET" && path === "/leads") {
      const move = q.get("move"), tier = q.get("tier");
      return json(leadRows().filter((l) => tierIs(l.tier, tier) && (!move || (move === "none" ? !l.verdict?.pick : l.verdict?.pick === move))));
    }
    if (method === "GET" && path === "/plan") {
      const d = store.latestChannelDecision();
      return json({ decision: d, options: d?.options ?? [] });
    }
    if (method === "GET" && path === "/searches") return json(store.searches(Number(q.get("limit") ?? 200)));
    if (method === "POST" && path === "/search") {
      const b = await body();
      const query = String(b.query ?? "").trim();
      if (!query) return bad("Say what to look for.");
      const type = (PLACE_TYPES.some((t) => t.id === b.type) ? b.type : "forum") as PlaceType;
      const { results, cost } = await exaQuery({ query, numResults: 15 }, deps.fetcher);
      const seg = { id: "search", label: "Your search", query, angle: "", audience: "both" as const };
      const placeKeys = new Set<string>(), leadIds = new Set<number>();
      for (const r of results) {
        const p = placeFromUrl(r.url, r.title, type);
        const text = `${r.title ?? ""} ${snippetOf(r)}`;
        if (p) { store.upsertPlace({ ...p, url: p.key.includes("/") ? `https://${p.key}` : r.url, description: snippetOf(r), size: sizeOf(text), noPromo: noPromo(text), themes: [], source: "exa" }); placeKeys.add(p.key); }
        const l = toLead(r, seg);
        if (l) leadIds.add(store.upsertLead(l).id);
      }
      store.logSearch({ query, type, theme: null, results: results.length, error: null, at: new Date().toISOString(), cost });
      return json({ places: placeRows().filter((p) => placeKeys.has(p.key)), leads: leadRows().filter((l) => leadIds.has(l.id)) });
    }
    if (path === "/jobs") {
      if (method === "GET") return json([...jobs.values()].reverse().slice(0, 20));
      if (method === "POST") {
        const b = await body();
        const kind = b.kind as JobKind;
        if (!KINDS.includes(kind)) return bad(`kind must be one of ${KINDS.join(", ")}`);
        const types = Array.isArray(b.types) ? (b.types as unknown[]).filter((t): t is string => PLACE_TYPES.some((x) => x.id === t)) : undefined;
        return json(start(kind, types), 202);
      }
    }
    if (method === "GET" && parts[0] === "jobs" && parts[1]) return jobs.has(parts[1]) ? json(jobs.get(parts[1])) : bad("No such job", 404);
    if (method === "GET" && path === "/export/gtm.csv") return new Response(toCsv(gtmRows(store)), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": "attachment; filename=scout-gtm-import.csv" } });
    if (method === "GET" && path === "/export/replies.json") return json(replyCandidates(store));
    if (method === "GET" && path === "/export/report.md") return new Response(report(store), { headers: { "content-type": "text/markdown; charset=utf-8" } });
    return bad("Not found", 404);
  }

  return async (req: Request, path: string): Promise<Response> => {
    try { return await route(req, path); } catch (e) { return bad(e instanceof Error ? e.message : String(e), 500); }
  };
}

export type Api = ReturnType<typeof createApi>;
