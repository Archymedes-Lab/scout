import { describe, expect, test } from "bun:test";
import { placesProblem } from "../src/cdm.ts";
import { openStore } from "../src/db.ts";
import { assessPlace, PLACE_FACTORS, PLACE_MOVES, placeBlocked, triagePlaces } from "../src/orion.ts";
import { SEED_PLACES } from "../src/places.ts";
import type { NewPlace } from "../src/types.ts";
import { favour, seededScorer } from "./fakes.ts";

const mk = (key: string, over: Partial<NewPlace> = {}): NewPlace => ({ key, name: key, type: "subreddit", url: `https://${key}`, description: "a community", size: 1000, noPromo: false, themes: ["ai_agents"], source: "exa", ...over });

describe("place verdicts", () => {
  test("weights sum to one; four documented moves", () => {
    expect(PLACE_FACTORS.reduce((s, f) => s + f.weight, 0)).toBeCloseTo(1, 6);
    expect(PLACE_MOVES.map((m) => m.key)).toEqual(["engage", "prepare", "later", "skip"]);
  });

  test("a place that forbids self-promotion can't be 'engage now', whatever Jev says", async () => {
    expect(placeBlocked(mk("a", { noPromo: true })).map((b) => b.move)).toEqual(["engage"]);
    expect(placeBlocked(mk("a"))).toEqual([]);
    const s = openStore(":memory:");
    s.upsertPlace(mk("reddit.com/r/strict", { noPromo: true }));
    const v = await assessPlace(s, "reddit.com/r/strict", { scorer: favour("engage") });
    expect(v.pick).not.toBe("engage");
    for (let seed = 1; seed <= 20; seed++) {
      const w = await assessPlace(s, "reddit.com/r/strict", { scorer: seededScorer(seed), force: true });
      if (w.pick) expect(w.pick).not.toBe("engage");
    }
  });

  test("triage judges every place, in parallel, reporting progress", async () => {
    const s = openStore(":memory:");
    for (let i = 0; i < 9; i++) s.upsertPlace(mk(`p${i}.io`));
    const seen: number[] = [];
    const r = await triagePlaces(s, { scorer: favour("prepare") }, { concurrency: 3, onProgress: (done) => seen.push(done) });
    expect(r.assessed).toBe(9);
    expect(seen.at(-1)).toBe(9);
    for (const p of s.places()) expect(s.placeVerdict(p.key)?.pick).toBe("prepare");
  });
});

describe("cdm over places", () => {
  test("baseline + only places Orion says to engage or prepare, best first, capped", async () => {
    const s = openStore(":memory:");
    for (const p of SEED_PLACES) s.upsertPlace(p);
    for (let i = 0; i < 12; i++) s.upsertPlace(mk(`e${i}.io`));
    for (let i = 0; i < 3; i++) s.upsertPlace(mk(`s${i}.io`));
    for (let i = 0; i < 12; i++) await assessPlace(s, `e${i}.io`, { scorer: favour("engage") });
    for (let i = 0; i < 3; i++) await assessPlace(s, `s${i}.io`, { scorer: favour("skip") });
    const p = placesProblem(s, 8);
    expect(p.options.length).toBe(8);
    expect(p.options.filter((o) => o.baseline).length).toBe(1);
    expect(p.options.some((o) => o.id.startsWith("s"))).toBe(false);
  });

  test("with no verdicts yet, the problem still has the baseline and the seed places", () => {
    const s = openStore(":memory:");
    for (const p of SEED_PLACES) s.upsertPlace(p);
    const p = placesProblem(s, 10);
    expect(p.options.filter((o) => o.baseline).length).toBe(1);
    expect(p.options.length).toBeGreaterThan(2);
  });
});
