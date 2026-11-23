import { describe, expect, test } from "bun:test";
import { openStore } from "../src/db.ts";
import { assessLead, blockedMoves, FACTORS, MOVES } from "../src/orion.ts";
import type { NewLead } from "../src/types.ts";
import { favour, seededScorer } from "./fakes.ts";

const base: NewLead = { url: "https://acme.io/", key: "acme.io", title: "Acme agency", kind: "company", segment: "agencies", snippet: "AI agents on Linux servers", email: "hi@acme.io", platform: "linux", publishedAt: null, query: "q" };

const variants: NewLead[] = [
  base,
  { ...base, email: null },
  { ...base, kind: "thread", url: "https://reddit.com/r/x/comments/1/", key: "reddit.com/r/x/comments/1" },
  { ...base, kind: "thread", email: null, url: "https://news.ycombinator.com/item?id=1", key: "news.ycombinator.com/item" },
  { ...base, platform: "mac" },
  { ...base, platform: "mac", kind: "thread", email: null },
  { ...base, kind: "vendor" },
];

describe("Orion lead verdicts", () => {
  test("weights are a distribution and moves are the four documented ones", () => {
    expect(FACTORS.reduce((s, f) => s + f.weight, 0)).toBeCloseTo(1, 6);
    expect(MOVES.map((m) => m.key)).toEqual(["reach_now", "reply_public", "nurture", "skip"]);
  });

  test("hard rules: no email → no reach_now; not a thread → no reply_public; macOS-only or vendor → neither", () => {
    const b = (l: NewLead) => blockedMoves(l).map((x) => x.move).sort();
    expect(b(base)).toEqual(["reply_public"]);
    expect(b({ ...base, email: null })).toEqual(["reach_now", "reply_public"]);
    expect(b(variants[2]!)).toEqual([]);
    expect(b(variants[3]!)).toEqual(["reach_now"]);
    expect(b({ ...base, platform: "mac" })).toEqual(["reach_now", "reply_public"]);
    expect(b({ ...base, kind: "vendor" })).toEqual(["reach_now", "reply_public"]);
  });

  test("invariant: whatever Jev scores, Orion never picks a blocked move", async () => {
    for (const v of variants) for (let seed = 1; seed <= 25; seed++) {
      const store = openStore(":memory:");
      const { id } = store.upsertLead(v);
      const verdict = await assessLead(store, id, { scorer: seededScorer(seed) });
      const blocked = blockedMoves(v).map((x) => x.move);
      if (verdict.pick) expect(blocked).not.toContain(verdict.pick);
    }
  });

  test("even when Jev strongly favours a blocked move, it is not picked", async () => {
    const store = openStore(":memory:");
    const { id } = store.upsertLead({ ...base, email: null });
    const v = await assessLead(store, id, { scorer: favour("reach_now") });
    expect(v.pick).not.toBe("reach_now");
    expect(v.blocked.map((b) => b.option)).toContain("reach_now");
  });

  test("a clear favourite that is allowed is picked", async () => {
    const store = openStore(":memory:");
    const { id } = store.upsertLead(base);
    const v = await assessLead(store, id, { scorer: favour("reach_now") });
    expect(v.pick).toBe("reach_now");
    expect(v.status).toBe("assessed");
  });

  test("unchanged leads reuse stored scores; a failing scorer never overwrites the last good verdict", async () => {
    const store = openStore(":memory:");
    const { id } = store.upsertLead(base);
    let calls = 0;
    const counting = async (i: Parameters<ReturnType<typeof favour>>[0]) => { calls++; return favour("nurture")(i); };
    await assessLead(store, id, { scorer: counting });
    await assessLead(store, id, { scorer: counting });
    expect(calls).toBe(1);
    const failed = await assessLead(store, id, { force: true, scorer: async () => { throw new Error("Jev down"); } });
    expect(failed.status).toBe("unavailable");
    expect(store.verdict(id)!.pick).toBe("nurture");
  });
});
