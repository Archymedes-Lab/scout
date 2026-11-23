import { describe, expect, test } from "bun:test";
import { placesProblem, runCdm } from "../src/cdm.ts";
import { openStore } from "../src/db.ts";
import { SEED_PLACES } from "../src/places.ts";

const seeded = () => {
  const s = openStore(":memory:");
  for (const p of SEED_PLACES) s.upsertPlace(p);
  return s;
};

describe("cdm problem", () => {
  test("seed places: unique keys, exactly one baseline", () => {
    expect(new Set(SEED_PLACES.map((c) => c.key)).size).toBe(SEED_PLACES.length);
    expect(SEED_PLACES.filter((c) => c.baseline).length).toBe(1);
  });

  test("weights of the value dimensions sum to one; the two documented hard constraints are present", () => {
    const p = placesProblem(seeded());
    expect(p.dimensions.reduce((s, d) => s + d.weight, 0)).toBeCloseTo(1, 6);
    expect(p.constraints.filter((c) => c.hard).map((c) => c.id).sort()).toEqual(["claims", "spam"]);
  });

  test("option ids are unique and within the cap for any cap", () => {
    for (const max of [2, 4, 10, 30]) {
      const p = placesProblem(seeded(), max);
      expect(p.options.length).toBeLessThanOrEqual(max);
      expect(new Set(p.options.map((o) => o.id)).size).toBe(p.options.length);
    }
  });
});

describe("cdm bridge (functional, offline mock judge)", () => {
  test("returns a commit among the options, an innovation that differs from it, and a portfolio summing to one", async () => {
    const p = placesProblem(seeded(), 6);
    const d = await runCdm(p, { mock: true });
    const ids = p.options.map((o) => o.id);
    expect(ids).toContain(d.commit);
    if (d.innovation) { expect(ids).toContain(d.innovation); expect(d.innovation).not.toBe(d.commit); }
    expect(Object.values(d.portfolio).reduce((s, v) => s + v, 0)).toBeCloseTo(1, 3);
    expect(d.stats.length).toBe(p.options.length);
    expect(d.judge).toBe("mock");
  }, 120_000);

  test("a broken bridge surfaces an error instead of a fake decision", async () => {
    await expect(runCdm(placesProblem(seeded(), 4), { mock: true, script: "py/does_not_exist.py" })).rejects.toThrow();
  }, 60_000);
});
