import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCycle } from "../src/cycle.ts";
import { openStore } from "../src/db.ts";
import { fakeExa, fakeTier, seededScorer } from "./fakes.ts";

test("one cycle: places found and triaged by Orion, cdm plans over them, users found and judged, files and report written", async () => {
  const store = openStore(":memory:");
  const out = mkdtempSync(join(tmpdir(), "scout-"));
  const r = await runCycle(store, { fetcher: fakeExa(), scorer: seededScorer(7), tierJudge: fakeTier, cdmMock: true, outDir: out, perQuery: 4, maxOptions: 6, types: ["subreddit", "newsletter", "event"], themes: ["ai_agents", "selfhosted"] });

  expect(r.places.searches).toBe(6);
  expect(store.places().length).toBeGreaterThan(0);
  expect(store.places().every((p) => store.placeVerdict(p.key))).toBe(true);
  expect(r.leads.found).toBeGreaterThan(0);
  // Every user is a paying prospect, a free user or not a user; places are classified by audience.
  for (const l of store.leads()) expect(["paying", "free", "none"] as (string | undefined)[]).toContain(store.tier(`lead:${l.id}`)?.tier);
  expect(r.tiers.paying).toBeGreaterThan(0);
  expect(r.tiers.free).toBeGreaterThan(0);
  expect(r.places.cost).toBeGreaterThan(0);
  expect(store.latestChannelDecision()).not.toBeNull();
  for (const f of [r.files.csv, r.files.replies, r.files.report]) expect(existsSync(f)).toBe(true);

  const report = readFileSync(r.files.report, "utf8");
  expect(report).toContain("Where to promote Argus");
  expect(report).toContain("Every place found");
  expect(report).toContain("Potential users");
  expect(report).toContain("Paying prospects");
  expect(report).toContain("Free users");
  for (const p of store.places()) if (p.url) expect(report).toContain(p.url);
  for (const l of store.leads()) expect(report).toContain(l.url);
}, 240_000);
