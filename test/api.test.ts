import { expect, test } from "bun:test";
import { createApi } from "../src/api.ts";
import { openStore } from "../src/db.ts";
import { FOCUS_GROUPS, FOCUS_PER_GROUP } from "../src/focus.ts";
import { fakeExa, fakeTier, seededScorer } from "./fakes.ts";

function setup() {
  const store = openStore(":memory:");
  const api = createApi({ store, fetcher: fakeExa(), scorer: seededScorer(3), tierJudge: fakeTier, cdmMock: true, smallRun: true });
  const call = async (path: string, init?: { method?: string; body?: unknown }) => {
    const res = await api(new Request(`http://x/api${path}`, { method: init?.method ?? (init?.body ? "POST" : "GET"), body: init?.body ? JSON.stringify(init.body) : undefined, headers: { "content-type": "application/json" } }), path.split("?")[0]!);
    return { status: res.status, type: res.headers.get("content-type") ?? "", body: res.headers.get("content-type")?.includes("json") ? await res.json() : await res.text() };
  };
  return { store, call };
}

async function waitFor(call: ReturnType<typeof setup>["call"], id: string) {
  for (let i = 0; i < 600; i++) {
    const j = (await call(`/jobs/${id}`)).body as { status: string };
    if (j.status !== "running") return j;
    await Bun.sleep(50);
  }
  throw new Error("job did not finish");
}

test("a cycle job finds places and users, judges them, plans with cdm, and every view reflects it", async () => {
  const { call } = setup();
  const started = await call("/jobs", { body: { kind: "cycle" } });
  expect(started.status).toBe(202);
  const job = (await waitFor(call, (started.body as { id: string }).id)) as { status: string; log: string[]; error: string | null };
  expect(job.error).toBeNull();
  expect(job.status).toBe("done");

  const places = (await call("/places")).body as { key: string; verdict: unknown }[];
  expect(places.length).toBeGreaterThan(0);
  expect(places.every((p) => p.verdict)).toBe(true);
  const subs = (await call("/places?type=subreddit")).body as { type: string }[];
  expect(subs.length).toBeGreaterThan(0);
  expect(subs.every((p) => p.type === "subreddit")).toBe(true);

  const plan = (await call("/plan")).body as { decision: { commit: string } | null; options: { id: string; name: string }[] };
  expect(plan.decision).not.toBeNull();
  expect(plan.options.some((o) => o.id === plan.decision!.commit)).toBe(true);

  const overview = (await call("/overview")).body as { counts: { places: number; leads: number; paying: number; free: number }; spend: number };
  expect(overview.counts.places).toBe(places.length);
  expect(overview.counts.leads).toBeGreaterThan(0);
  expect(overview.counts.paying + overview.counts.free).toBeGreaterThan(0);
  expect(overview.spend).toBeGreaterThan(0);

  const paying = (await call("/leads?tier=paying")).body as { tier: { tier: string } | null }[];
  expect(paying.length).toBe(overview.counts.paying);
  expect(paying.every((l) => l.tier?.tier === "paying")).toBe(true);
  const focused = (await call("/places?focus=1")).body as { focus: boolean; verdict: { pick: string } | null }[];
  expect(focused.length).toBeLessThanOrEqual(FOCUS_PER_GROUP * FOCUS_GROUPS.length);
  expect(focused.every((p) => p.focus && p.verdict?.pick === "engage")).toBe(true);
  expect((overview as unknown as { counts: { focus: number } }).counts.focus).toBe(focused.length);
  const freePlaces = (await call("/places?tier=free")).body as { tier: { tier: string } | null }[];
  expect(freePlaces.every((p) => p.tier?.tier === "free")).toBe(true);

  const csv = await call("/export/gtm.csv");
  expect(csv.type).toContain("text/csv");
  expect(String(csv.body).split("\n")[0]).toBe("email,name,company,role,url,segment,source,note");
}, 240_000);

test("jobs are single-flight per kind; unknown kinds are rejected", async () => {
  const { call } = setup();
  const a = (await call("/jobs", { body: { kind: "places" } })).body as { id: string };
  const b = (await call("/jobs", { body: { kind: "places" } })).body as { id: string };
  expect(b.id).toBe(a.id);
  expect((await call("/jobs", { body: { kind: "rm -rf" } })).status).toBe(400);
  await waitFor(call, a.id);
  expect(((await call("/jobs")).body as unknown[]).length).toBe(1);
});

test("a place can be marked as being worked on, and the mark survives a re-discovery", async () => {
  const { call, store } = setup();
  store.upsertPlace({ key: "reddit.com/r/claudeai", name: "r/ClaudeAI", type: "subreddit", url: "https://reddit.com/r/ClaudeAI", description: "", size: null, noPromo: false, themes: [], source: "exa" });
  const r = await call(`/places/${encodeURIComponent("reddit.com/r/claudeai")}/status`, { body: { status: "doing" } });
  expect(r.status).toBe(200);
  store.upsertPlace({ key: "reddit.com/r/claudeai", name: "r/ClaudeAI", type: "subreddit", url: "https://reddit.com/r/ClaudeAI", description: "newer", size: 300000, noPromo: false, themes: ["ai_agents"], source: "exa" });
  expect(store.place("reddit.com/r/claudeai")!.status).toBe("doing");
  expect((await call(`/places/${encodeURIComponent("reddit.com/r/claudeai")}/status`, { body: { status: "bogus" } })).status).toBe(400);
});

test("ad-hoc search returns the places and users it found", async () => {
  const { call } = setup();
  const r = (await call("/search", { body: { query: "where do WSL developers talk about agent security" } })).body as { places: unknown[]; leads: unknown[] };
  expect(r.places.length).toBeGreaterThan(0);
  expect(r.leads.length).toBeGreaterThan(0);
  expect((await call("/search", { body: { query: "" } })).status).toBe(400);
});

test("health and taxonomy; unknown paths are 404", async () => {
  const { call } = setup();
  const h = (await call("/health")).body as Record<string, boolean>;
  expect(Object.keys(h).sort()).toEqual(["cdm", "exa", "jev", "orion"]);
  const t = (await call("/taxonomy")).body as { types: unknown[]; themes: unknown[] };
  expect(t.types.length).toBeGreaterThanOrEqual(14);
  expect((await call("/nope")).status).toBe(404);
});

test("at real scale: lists stay lean and the overview stays fast", async () => {
  const { call, store } = setup();
  const judge = { status: "assessed", verdict: "recommend", pick: "engage", label: "Engage now", gap: 1, confidence: 0.7, stable: true, needsReview: false,
    bands: { engage: { jev: 1, low: 0, high: 2 } }, ranking: [{ id: "engage", label: "Engage now", score: 3 }], reasons: ["r"], flips: ["f"],
    drivers: [{ label: "d", impact: 1 }], blocked: [], model: "m", inputHash: "h", error: null, at: new Date().toISOString() };
  for (let i = 0; i < 1200; i++) {
    store.upsertPlace({ key: `p${i}.io`, name: `P${i}`, type: i % 2 ? "forum" : "platform", url: null, description: "x".repeat(300), size: null, noPromo: false, themes: [], source: "exa" });
    store.saveJudgment({ ...judge, subject: `place:p${i}.io`, ranking: [{ id: "engage", label: "Engage now", score: i / 100 }] } as never, []);
  }
  const t0 = performance.now();
  const o = (await call("/overview")).body as { topPlaces: unknown[] };
  expect(performance.now() - t0).toBeLessThan(1500);
  expect(o.topPlaces.length).toBeGreaterThan(0);

  const rows = (await call("/places")).body as { verdict: Record<string, unknown> | null }[];
  const v = rows.find((r) => r.verdict)!.verdict!;
  expect(v.pick).toBe("engage");
  expect(v.label).toBe("Engage now");
  for (const heavy of ["bands", "reasons", "flips", "drivers", "ranking"]) expect(v[heavy]).toBeUndefined();
  const detail = (await call(`/places/${encodeURIComponent("p5.io")}`)).body as { verdict: Record<string, unknown> };
  expect(detail.verdict.bands).toBeDefined();
  expect(detail.verdict.reasons).toEqual(["r"]);
}, 60_000);
