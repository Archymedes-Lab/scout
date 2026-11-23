import { describe, expect, test } from "bun:test";
import { createApi } from "../src/api.ts";
import { openStore } from "../src/db.ts";
import { buildSnapshot } from "../scripts/snapshot.ts";
import { gate } from "../web/lib/gate.ts";
import { issue, safeNext, valid } from "../web/lib/session.ts";
import { serveSnapshot, type Snapshot } from "../web/lib/snapshot.ts";
import { fakeExa, fakeTier, seededScorer } from "./fakes.ts";

describe("session cookie", () => {
  test("a token is valid only with the same secret, untampered and unexpired", async () => {
    const t = await issue("s3cret", 1_000);
    expect(await valid(t, "s3cret", 2_000)).toBe(true);
    expect(await valid(t, "other", 2_000)).toBe(false);
    expect(await valid(t.replace(/.$/, (c) => (c === "0" ? "1" : "0")), "s3cret", 2_000)).toBe(false);
    expect(await valid(t, "s3cret", 1_000 + 31 * 864e5)).toBe(false);
    for (const bad of [undefined, "", "abc", "123.", ".abc"]) expect(await valid(bad, "s3cret", 2_000)).toBe(false);
  });

  test("redirects after login stay on this site", () => {
    expect(safeNext("/places?focus=1")).toBe("/places?focus=1");
    for (const evil of ["//evil.com", "https://evil.com", "/\\evil.com", "", null, undefined]) expect(safeNext(evil)).toBe("/");
  });
});

describe("gate", () => {
  const env = { password: "pw", secret: "s3cret", deployed: true };
  test("deployed without a password it refuses to serve", async () => {
    expect((await gate("/", undefined, { deployed: true })).kind).toBe("unconfigured");
  });
  test("locally without a password it is open", async () => {
    expect((await gate("/places", undefined, { deployed: false })).kind).toBe("allow");
  });
  test("the login page and its routes are always reachable", async () => {
    for (const p of ["/login", "/api/login", "/api/logout"]) expect((await gate(p, undefined, env)).kind).toBe("allow");
  });
  test("API calls without a session are refused; pages redirect to login with where to return", async () => {
    expect((await gate("/api/places", undefined, env)).kind).toBe("unauthorized");
    const r = await gate("/places", "garbage", env, "?focus=1");
    expect(r).toEqual({ kind: "login", next: "/places?focus=1" });
  });
  test("a valid session gets through", async () => {
    expect((await gate("/api/places", await issue("s3cret"), env)).kind).toBe("allow");
  });
});

async function liveSnapshot() {
  const store = openStore(":memory:");
  const api = createApi({ store, fetcher: fakeExa(), scorer: seededScorer(5), tierJudge: fakeTier, cdmMock: true, smallRun: true });
  const call = (path: string, method = "GET", body?: unknown) =>
    api(new Request(`http://x/api${path}`, { method, body: body ? JSON.stringify(body) : undefined, headers: { "content-type": "application/json" } }), path.split("?")[0]!);
  const job = (await (await call("/jobs", "POST", { kind: "cycle" })).json()) as { id: string };
  for (let i = 0; i < 600; i++) {
    const j = (await (await call(`/jobs/${job.id}`)).json()) as { status: string };
    if (j.status !== "running") break;
    await Bun.sleep(50);
  }
  return { snap: await buildSnapshot((p) => call(p)), call };
}

describe("read-only snapshot", () => {
  test("built from the engine, it answers the views the same way the engine does", async () => {
    const { snap, call } = await liveSnapshot();
    const get = async (p: string) => (await serveSnapshot(snap, "GET", p.split("?")[0]!, p.includes("?") ? `?${p.split("?")[1]}` : "").json()) as any;
    const live = (await (await call("/overview")).json()) as any;
    expect((await get("/overview")).counts).toEqual(live.counts);
    expect((await get("/places")).length).toBe(((await (await call("/places")).json()) as unknown[]).length);
    expect((await get("/places?type=subreddit")).every((p: any) => p.type === "subreddit")).toBe(true);
    expect((await get("/places?focus=1")).every((p: any) => p.focus)).toBe(true);
    const key = (await get("/places"))[0].key;
    expect((await get(`/places/${encodeURIComponent(key)}`)).key).toBe(key);
    expect((await get("/leads?tier=paying")).every((l: any) => l.tier?.tier === "paying")).toBe(true);
    expect((await get("/plan")).decision).not.toBeNull();
    expect((await get("/health")).readOnly).toBe(true);
    expect(await get("/jobs")).toEqual([]);
    const csv = serveSnapshot(snap, "GET", "/export/gtm.csv", "");
    expect(csv.headers.get("content-type")).toContain("text/csv");
    expect((await csv.text()).split("\n")[0]).toBe("email,name,company,role,url,segment,source,note");
  }, 240_000);

  test("anything that would search, spend or change data is refused with a reason", async () => {
    const snap = { places: [], placeDetails: {}, leads: [], searches: [], exports: { csv: "", replies: [], report: "" } } as unknown as Snapshot;
    for (const [m, p] of [["POST", "/jobs"], ["POST", "/search"], ["POST", "/places/x/status"], ["POST", "/places/x/assess"]] as const) {
      const r = serveSnapshot(snap, m, p, "");
      expect(r.status).toBe(403);
      expect(((await r.json()) as { error: string }).error).toContain("read-only");
    }
    expect(serveSnapshot(snap, "GET", "/nope", "").status).toBe(404);
  });
});
