/**
 * Exa search, following Exa's own guidance (the build-with-exa skill): the query, `type: "auto"`, bare
 * `contents.highlights`, and nothing else unless the task needs it. Scout adds `numResults` (a product decision: how
 * deep each search goes) and, for place discovery, `systemPrompt` + `outputSchema` so Exa extracts every place a page
 * names. No categories or date filters: recency lives in the query wording. The fetcher is injectable for tests.
 */
const BASE = process.env.EXA_BASE_URL ?? "https://api.exa.ai";

export interface ExaResult {
  url: string;
  title?: string | null;
  publishedDate?: string | null;
  highlights?: string[];
}

export class ExaError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

export interface SearchOpts {
  query: string;
  numResults?: number;
  systemPrompt?: string;
  outputSchema?: Record<string, unknown>;
}

export interface SearchResponse { results: ExaResult[]; output: { content?: unknown } | null; cost: number }

export async function exaQuery(o: SearchOpts, fetcher: typeof fetch = fetch, key = process.env.EXA_API_KEY?.trim() ?? ""): Promise<SearchResponse> {
  if (!key && fetcher === fetch) throw new ExaError(401, "EXA_API_KEY is not set. Add it to ~/sales/.env.");
  const body: Record<string, unknown> = { query: o.query, type: "auto", contents: { highlights: true } };
  if (o.numResults) body.numResults = Math.min(Math.max(o.numResults, 1), 100);
  if (o.outputSchema) { body.outputSchema = o.outputSchema; if (o.systemPrompt) body.systemPrompt = o.systemPrompt; }
  let res: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await fetcher(`${BASE}/search`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
    if (res.status !== 429 && res.status < 500) break;
    await new Promise((r) => setTimeout(r, 800 * 2 ** attempt));
  }
  if (!res!.ok) throw new ExaError(res!.status, `Exa ${res!.status}: ${(await res!.text()).slice(0, 240)}`);
  const j = (await res!.json()) as { results?: ExaResult[]; output?: { content?: unknown }; costDollars?: { total?: number } };
  return { results: j.results ?? [], output: j.output ?? null, cost: j.costDollars?.total ?? 0 };
}

export async function exaSearch(o: SearchOpts, fetcher?: typeof fetch): Promise<ExaResult[]> {
  return (await exaQuery(o, fetcher)).results;
}

export function snippetOf(r: ExaResult): string {
  return (r.highlights ?? []).join(" … ").replace(/\s+/g, " ").trim().slice(0, 600);
}
