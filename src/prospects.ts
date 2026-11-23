import type { Store } from "./db.ts";
import { leadKey, platformOf } from "./leads.ts";

/**
 * Paying prospects through Exa's Agent API (`/agent/runs`): list-building with contact fields is the Agent API's job,
 * not `/search` (build-with-exa skill). Every run sets `effort` explicitly, bounds the list with `maxItems`, caps
 * spend with `budget.maxCostDollars`, excludes leads we already have, and is polled to a terminal status; output is
 * read only from a completed run. A failed or cancelled run is an error, never an empty success.
 */
const BASE = process.env.EXA_BASE_URL ?? "https://api.exa.ai";

export const PROSPECT_QUERY =
  "Find software development agencies and company engineering teams, preferably in the United States and Central or Eastern Europe, " +
  "that build with AI coding agents such as Claude Code, Cursor or Codex on Windows or Linux machines, and that would plausibly pay " +
  "for a local security tool covering those machines. For each, give the company, its website, a public contact email if one is " +
  "published, one sentence on why it fits, and the page that shows it. Never invent an email: use null when none is published.";

export const prospectSchema = (maxItems: number) => ({
  type: "object",
  properties: {
    prospects: {
      type: "array",
      maxItems,
      items: {
        type: "object",
        properties: {
          company: { type: "string" },
          website: { type: "string", format: "uri" },
          email: { type: ["string", "null"], format: "email" },
          why: { type: "string" },
          evidence: { type: "string", format: "uri" },
        },
        required: ["company", "website", "why", "evidence"],
      },
    },
  },
  required: ["prospects"],
});

interface Prospect { company: string; website: string; email?: string | null; why: string; evidence: string }
interface Run { id: string; status: string; stopReason?: string; error?: { message?: string } | string; output?: { structured?: { prospects?: Prospect[] } }; costDollars?: { total?: number } }

export interface ProspectOpts {
  fetcher?: typeof fetch;
  maxItems?: number;
  budgetDollars?: number;
  pollMs?: number;
  timeoutMs?: number;
  onStatus?: (status: string) => void;
}

const TERMINAL = ["completed", "failed", "cancelled"];

export async function findProspects(store: Store, o: ProspectOpts = {}): Promise<{ status: string; runId: string; added: number; found: number; cost: number; stopReason: string | null }> {
  const fetcher = o.fetcher ?? fetch;
  const key = process.env.EXA_API_KEY?.trim() ?? "";
  if (!key && fetcher === fetch) throw new Error("EXA_API_KEY is not set. Add it to ~/sales/.env.");
  const headers = { "content-type": "application/json", "x-api-key": key };
  const maxItems = o.maxItems ?? 20;
  const exclusion = store.leads().map((l) => ({ name: l.title, url: l.url }));

  const created = await fetcher(`${BASE}/agent/runs`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      query: PROSPECT_QUERY,
      effort: "auto",
      budget: { maxCostDollars: o.budgetDollars ?? 3 },
      outputSchema: prospectSchema(maxItems),
      ...(exclusion.length ? { input: { exclusion } } : {}),
    }),
  });
  if (!created.ok) throw new Error(`Exa agent ${created.status}: ${(await created.text()).slice(0, 240)}`);
  let run = (await created.json()) as Run;

  const deadline = Date.now() + (o.timeoutMs ?? 15 * 60_000);
  while (!TERMINAL.includes(run.status)) {
    if (Date.now() > deadline) throw new Error(`Exa agent run ${run.id} is still running after ${Math.round((o.timeoutMs ?? 900_000) / 1000)}s; check it later.`);
    await new Promise((r) => setTimeout(r, o.pollMs ?? 4000));
    const res = await fetcher(`${BASE}/agent/runs/${run.id}`, { headers });
    if (!res.ok) throw new Error(`Exa agent ${res.status}: ${(await res.text()).slice(0, 240)}`);
    run = (await res.json()) as Run;
    o.onStatus?.(run.status);
  }
  if (run.status !== "completed") {
    const why = typeof run.error === "string" ? run.error : run.error?.message ?? run.stopReason ?? "no reason given";
    throw new Error(`Exa agent run ${run.id} ${run.status}: ${why}`);
  }

  let added = 0;
  const prospects = run.output?.structured?.prospects ?? [];
  for (const p of prospects) {
    const k = leadKey(p.website);
    if (!k || !p.company) continue;
    const snippet = `${p.why} Evidence: ${p.evidence}`.slice(0, 600);
    const email = p.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email) ? p.email.toLowerCase() : null;
    if (store.upsertLead({ url: p.website, key: k, title: p.company.slice(0, 160), kind: "company", segment: "prospects", snippet, email, platform: platformOf(p.why), publishedAt: null, query: "Exa agent: paying prospects" }).created) added++;
  }
  return { status: run.status, runId: run.id, added, found: prospects.length, cost: run.costDollars?.total ?? 0, stopReason: run.stopReason ?? null };
}
