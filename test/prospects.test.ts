import { describe, expect, test } from "bun:test";
import { openStore } from "../src/db.ts";
import { findProspects } from "../src/prospects.ts";

type Call = { method: string; url: string; body: Record<string, unknown> | null };

/** Exa Agent API stand-in: create → running, then the given terminal state after `polls` reads. */
function fakeAgent(final: Record<string, unknown>, polls = 2) {
  const calls: Call[] = [];
  let reads = 0;
  const fetcher = (async (u: string | URL | Request, init?: RequestInit) => {
    const url = String(u);
    calls.push({ method: init?.method ?? "GET", url, body: init?.body ? JSON.parse(String(init.body)) : null });
    if (init?.method === "POST") return Response.json({ id: "agent_run_01", status: "running" });
    reads++;
    return Response.json(reads < polls ? { id: "agent_run_01", status: "running" } : { id: "agent_run_01", ...final });
  }) as typeof fetch;
  return { fetcher, calls };
}

const completed = {
  status: "completed",
  stopReason: "schema_satisfied",
  costDollars: { total: 0.84 },
  output: {
    structured: {
      prospects: [
        { company: "Kraków Devs", website: "https://krakowdevs.pl", email: "hello@krakowdevs.pl", why: "Agency that ships with Claude Code on Linux build servers", evidence: "https://krakowdevs.pl/blog/agents" },
        { company: "No Contact Ltd", website: "https://nocontact.io", email: null, why: "Fintech team rolling out Codex", evidence: "https://nocontact.io/careers" },
      ],
    },
  },
};

describe("paying prospects via Exa's Agent API", () => {
  test("creates a run with explicit effort, a bounded schema and the leads we already have as exclusions", async () => {
    const store = openStore(":memory:");
    store.upsertLead({ url: "https://acme.io/", key: "acme.io", title: "Acme", kind: "company", segment: "agencies", snippet: "", email: null, platform: "linux", publishedAt: null, query: "q" });
    const { fetcher, calls } = fakeAgent(completed);
    await findProspects(store, { fetcher, pollMs: 1, maxItems: 15, budgetDollars: 2 });
    const create = calls.find((c) => c.method === "POST")!;
    expect(create.url).toEndWith("/agent/runs");
    expect(create.body!.effort).toBe("auto");
    expect((create.body!.budget as { maxCostDollars: number }).maxCostDollars).toBe(2);
    const items = ((create.body!.outputSchema as any).properties.prospects);
    expect(items.maxItems).toBe(15);
    expect(items.items.properties.email.format).toBe("email");
    expect((create.body!.input as { exclusion: { url: string }[] }).exclusion.map((e) => e.url)).toContain("https://acme.io/");
  });

  test("polls until the run completes, then stores each prospect with its evidence as the source", async () => {
    const store = openStore(":memory:");
    const { fetcher, calls } = fakeAgent(completed, 3);
    const r = await findProspects(store, { fetcher, pollMs: 1 });
    expect(calls.filter((c) => c.method === "GET").length).toBe(3);
    expect(r.status).toBe("completed");
    expect(r.added).toBe(2);
    expect(r.cost).toBeCloseTo(0.84);
    const k = store.leads().find((l) => l.title === "Kraków Devs")!;
    expect(k.email).toBe("hello@krakowdevs.pl");
    expect(k.url).toBe("https://krakowdevs.pl");
    expect(k.snippet).toContain("https://krakowdevs.pl/blog/agents");
    expect(k.segment).toBe("prospects");
  });

  test("a failed or cancelled run is surfaced as an error and adds nothing, even if it carries output", async () => {
    for (const status of ["failed", "cancelled"]) {
      const store = openStore(":memory:");
      const { fetcher } = fakeAgent({ ...completed, status, stopReason: "error", error: { message: "boom" } });
      await expect(findProspects(store, { fetcher, pollMs: 1 })).rejects.toThrow(status);
      expect(store.leads().length).toBe(0);
    }
  });

  test("gives up after the deadline instead of polling forever", async () => {
    const store = openStore(":memory:");
    const { fetcher } = fakeAgent(completed, 1_000_000);
    await expect(findProspects(store, { fetcher, pollMs: 1, timeoutMs: 50 })).rejects.toThrow(/still running/);
  });
});
