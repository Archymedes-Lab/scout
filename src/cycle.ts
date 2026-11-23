import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { placesProblem, runCdm } from "./cdm.ts";
import type { Store } from "./db.ts";
import { gtmRows, replyCandidates, toCsv } from "./handoff.ts";
import { discoverLeads } from "./leads.ts";
import { assessAll, triagePlaces, type Scorer } from "./orion.ts";
import { discoverPlaces, SEED_PLACES } from "./places.ts";
import { report } from "./report.ts";
import { classifyAll, type TierJudge } from "./tiers.ts";

export interface CycleOpts {
  fetcher?: typeof fetch;
  scorer?: Scorer;
  tierJudge?: TierJudge;
  cdmMock?: boolean;
  outDir?: string;
  perQuery?: number;
  maxOptions?: number;
  types?: string[];
  themes?: string[];
  log?: (msg: string) => void;
  onProgress?: (step: string, done: number, total: number) => void;
}

export const seedPlaces = (store: Store) => { for (const p of SEED_PLACES) if (!store.place(p.key)) store.upsertPlace(p); };

/** Plan where to promote: Orion's top places → cdm's commit, innovation bet and time split. */
export async function planPlaces(store: Store, o: Pick<CycleOpts, "cdmMock" | "maxOptions"> = {}) {
  const d = await runCdm(placesProblem(store, o.maxOptions ?? 10), { mock: o.cdmMock });
  store.saveChannelDecision(d);
  return d;
}

/**
 * Places (Exa matrix → Orion triage → cdm plan), then users (Exa → Orion), then the hand-off files and the report.
 * Each step's errors are kept, not hidden; a failed step does not stop the next.
 */
export async function runCycle(store: Store, o: CycleOpts = {}) {
  const log = o.log ?? (() => {});
  const progress = (step: string) => (done: number, total: number) => o.onProgress?.(step, done, total);
  const errors: string[] = [];
  seedPlaces(store);

  log("places: searching every type × theme");
  const places = await discoverPlaces(store, { fetcher: o.fetcher, types: o.types, themes: o.themes, perQuery: o.perQuery, onProgress: progress("Searching places") });
  errors.push(...(places.fatal ? [`places: Exa stopped the run: ${places.fatal}`] : places.errors.map((e) => `places ${e}`)));
  log(`places: ${places.added} new from ${places.searches} searches; Orion triaging`);

  log("users: searching");
  const found = await discoverLeads(store, { fetcher: o.fetcher, perQuery: o.perQuery });
  errors.push(...found.errors.map((e) => `users ${e}`));

  // Free or paying first, so Orion judges each lead and place knowing which it is.
  const tiers = await classifyAll(store, { judge: o.tierJudge }, { onProgress: progress("Jev: free or paying") });
  log(`tiers: ${Object.entries(tiers).map(([k, v]) => `${v} ${k}`).join(", ")}`);
  const triage = await triagePlaces(store, { scorer: o.scorer }, { onProgress: progress("Orion: places") });
  log(`places: ${triage.assessed} judged, ${triage.failed} not assessed; cdm planning`);
  try { await planPlaces(store, o); } catch (e) { errors.push(`cdm: ${e instanceof Error ? e.message : String(e)}`); }

  log(`users: ${found.added} new of ${found.found}; Orion judging`);
  const judged = await assessAll(store, { scorer: o.scorer }, { onProgress: progress("Orion: users") });

  const { files, gtm } = writeOutputs(store, o.outDir);
  return { places: { searches: places.searches, added: places.added, cost: places.cost, ...triage }, leads: { found: found.found, added: found.added, ...judged }, tiers, handoff: { gtm }, files, errors };
}

/** Local calendar date, so a run at 1am in Kigali is stamped with today. */
export const localDate = (d = new Date()) => d.toLocaleDateString("sv-SE");

/** The gtm import CSV, the reply candidates and the report, stamped with today's date. */
export function writeOutputs(store: Store, outDir = new URL("../data/reports", import.meta.url).pathname) {
  mkdirSync(outDir, { recursive: true });
  const stamp = localDate();
  const files = { csv: join(outDir, `gtm-import-${stamp}.csv`), replies: join(outDir, `replies-${stamp}.json`), report: join(outDir, `report-${stamp}.md`) };
  const rows = gtmRows(store);
  writeFileSync(files.csv, toCsv(rows));
  writeFileSync(files.replies, JSON.stringify(replyCandidates(store), null, 1));
  writeFileSync(files.report, report(store));
  return { files, gtm: rows.length };
}
