import { describe, expect, test } from "bun:test";
import { SEGMENTS } from "../src/brief.ts";
import { openStore } from "../src/db.ts";
import { gtmRows } from "../src/handoff.ts";
import { assessLead, leadContext } from "../src/orion.ts";
import { classifyLead, classifyPlace, LEAD_TIERS, PLACE_TIERS, type TierJudge } from "../src/tiers.ts";
import type { NewLead } from "../src/types.ts";
import { favour } from "./fakes.ts";

const lead = (over: Partial<NewLead> = {}): NewLead => ({ url: "https://acme.io/", key: "acme.io", title: "Acme agency, 40 engineers", kind: "company", segment: "agencies", snippet: "We build with Claude Code", email: "hi@acme.io", platform: "linux", publishedAt: null, query: "q", ...over });
const always = (tier: string): TierJudge => async ({ options }) => ({ tier: options.includes(tier) ? tier : options[0]!, probabilities: Object.fromEntries(options.map((o) => [o, o === tier ? 0.9 : 0.1 / (options.length - 1)])), model: "fake" });

describe("free and paying users", () => {
  test("segments cover both paying buyers and free users", () => {
    expect(SEGMENTS.some((s) => s.audience === "paying")).toBe(true);
    expect(SEGMENTS.some((s) => s.audience === "free")).toBe(true);
    for (const s of SEGMENTS) expect(["paying", "free", "both"]).toContain(s.audience);
  });

  test("a lead is classified paying, free or not a user; a place paying, free, mixed or unclear", async () => {
    expect(LEAD_TIERS).toEqual(["paying", "free", "none"]);
    expect(PLACE_TIERS).toEqual(["paying", "free", "mixed", "unclear"]);
    const s = openStore(":memory:");
    const { id } = s.upsertLead(lead());
    expect((await classifyLead(s, id, { judge: always("paying") })).tier).toBe("paying");
    expect(s.tier(`lead:${id}`)?.tier).toBe("paying");
    s.upsertPlace({ key: "reddit.com/r/homelab", name: "r/homelab", type: "subreddit", url: null, description: "", size: null, noPromo: false, themes: [], source: "exa" });
    expect((await classifyPlace(s, "reddit.com/r/homelab", { judge: always("free") })).tier).toBe("free");
  });

  test("whatever the judge answers, the stored tier is one of the allowed tiers", async () => {
    const s = openStore(":memory:");
    const { id } = s.upsertLead(lead());
    const rogue: TierJudge = async () => ({ tier: "enterprise-ish", probabilities: {}, model: "fake" });
    const t = await classifyLead(s, id, { judge: rogue });
    expect(LEAD_TIERS as readonly string[]).toContain(t.tier);
  });

  test("unchanged leads are not re-asked; a failing judge keeps the last good tier", async () => {
    const s = openStore(":memory:");
    const { id } = s.upsertLead(lead());
    let calls = 0;
    const counting: TierJudge = async (i) => { calls++; return always("free")(i); };
    await classifyLead(s, id, { judge: counting });
    await classifyLead(s, id, { judge: counting });
    expect(calls).toBe(1);
    const failed = await classifyLead(s, id, { judge: async () => { throw new Error("Jev down"); }, force: true });
    expect(failed.error).toContain("Jev down");
    expect(s.tier(`lead:${id}`)?.tier).toBe("free");
  });

  test("Orion sees the tier: it is part of the lead's context", async () => {
    const s = openStore(":memory:");
    const { id } = s.upsertLead(lead());
    const before = leadContext(s.lead(id)!, null);
    await classifyLead(s, id, { judge: always("paying") });
    expect(leadContext(s.lead(id)!, s.tier(`lead:${id}`))).toContain("PAYING");
    expect(before).not.toContain("PAYING");
  });

  test("the gtm hand-off says whether each contact is a paying or free prospect, paying first", async () => {
    const s = openStore(":memory:");
    const a = s.upsertLead(lead({ key: "a.io", url: "https://a.io/", email: "a@a.io" })).id;
    const b = s.upsertLead(lead({ key: "b.io", url: "https://b.io/", email: "b@b.io" })).id;
    await classifyLead(s, a, { judge: always("free") });
    await classifyLead(s, b, { judge: always("paying") });
    await assessLead(s, a, { scorer: favour("reach_now") });
    await assessLead(s, b, { scorer: favour("reach_now") });
    const rows = gtmRows(s);
    expect(rows.map((r) => r.email)).toEqual(["b@b.io", "a@a.io"]);
    expect(rows[0]!.note).toContain("Paying prospect");
    expect(rows[1]!.note).toContain("Free user");
  });
});
