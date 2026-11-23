import { describe, expect, test } from "bun:test";
import { CLAIMS } from "../src/gtm/claims-catalog.ts";
import { lint } from "../src/gtm/claims.ts";
import { argusFacts, briefText, SEGMENTS } from "../src/brief.ts";

describe("Argus brief", () => {
  test("every fact is a verified Argus claim from the gtm register, never a founder or proposed one", () => {
    const verified = new Set(CLAIMS.filter((c) => c.product === "jarvis" && c.status === "verified").map((c) => c.text));
    const facts = argusFacts();
    expect(facts.length).toBeGreaterThan(3);
    for (const f of facts) expect(verified.has(f)).toBe(true);
  });

  test("brief text respects its length budget for any budget", () => {
    for (const max of [200, 600, 1200, 4000]) expect(briefText(max).length).toBeLessThanOrEqual(max);
    expect(briefText(4000)).toContain("Argus");
  });

  test("segments have unique ids, a query and a claim-clean angle", () => {
    expect(new Set(SEGMENTS.map((s) => s.id)).size).toBe(SEGMENTS.length);
    for (const s of SEGMENTS) {
      expect(s.query.length).toBeGreaterThan(10);
      expect(lint(s.angle, "jarvis")).toEqual([]);
    }
  });
});
