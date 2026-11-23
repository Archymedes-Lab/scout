import { expect, test } from "bun:test";
import { openStore } from "../src/db.ts";

const lead = { url: "https://acme.io/", key: "acme.io", title: "Acme", kind: "company" as const, segment: "agencies", snippet: "s", email: null, platform: "linux" as const, publishedAt: null, query: "q" };

test("upsertLead creates once, then updates the snippet without changing id or first-found time", () => {
  const s = openStore(":memory:");
  const a = s.upsertLead(lead);
  expect(a.created).toBe(true);
  const firstFound = s.lead(a.id)!.foundAt;
  const b = s.upsertLead({ ...lead, snippet: "newer", email: "hi@acme.io" });
  expect(b).toEqual({ id: a.id, created: false });
  const l = s.lead(a.id)!;
  expect(l.snippet).toBe("newer");
  expect(l.email).toBe("hi@acme.io");
  expect(l.foundAt).toBe(firstFound);
});

test("a later lead without an email never erases a known email", () => {
  const s = openStore(":memory:");
  const { id } = s.upsertLead({ ...lead, email: "hi@acme.io" });
  s.upsertLead({ ...lead, email: null });
  expect(s.lead(id)!.email).toBe("hi@acme.io");
});

test("channel decisions: latest wins", () => {
  const s = openStore(":memory:");
  expect(s.latestChannelDecision()).toBeNull();
  s.saveChannelDecision({ commit: "a", innovation: null, portfolio: { a: 1 }, evpi: 0, escalate: [], stats: [], judge: "mock", at: "2026-10-01T00:00:00Z" });
  s.saveChannelDecision({ commit: "b", innovation: "c", portfolio: { b: 0.7, c: 0.3 }, evpi: 0.1, escalate: [], stats: [], judge: "mock", at: "2026-10-02T00:00:00Z" });
  expect(s.latestChannelDecision()!.commit).toBe("b");
});
