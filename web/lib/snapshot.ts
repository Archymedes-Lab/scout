/**
 * The deployed Scout is a read-only snapshot: Vercel cannot run the engine (Bun, SQLite, Python for cdm, Orion's source),
 * so `bun run snapshot` saves what the engine answers and this serves the same views from it. Anything that would
 * search, spend credit or change data is refused with the reason; live runs stay on the machine with the engine.
 */
export interface Snapshot {
  generatedAt: string;
  taxonomy: unknown;
  overview: Record<string, unknown>;
  plan: unknown;
  places: Record<string, unknown>[];
  placeDetails: Record<string, unknown>;
  leads: Record<string, unknown>[];
  searches: unknown[];
  exports: { csv: string; replies: unknown; report: string };
}

const json = (data: unknown, status = 200) => Response.json(data, { status });
type Row = Record<string, unknown> & { verdict?: { pick?: string | null } | null; tier?: { tier?: string } | null };
const tierIs = (r: Row, want: string | null) => !want || (want === "none" ? !r.tier : r.tier?.tier === want);
const moveIs = (r: Row, want: string | null) => !want || (want === "none" ? !r.verdict?.pick : r.verdict?.pick === want);

export function serveSnapshot(snap: Snapshot, method: string, path: string, search: string): Response {
  if (method !== "GET") return json({ error: "This is a read-only snapshot of Scout: searches and runs work in the local app, where the engine runs." }, 403);
  const q = new URLSearchParams(search);
  const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
  switch (path) {
    case "/health": return json({ exa: false, jev: false, orion: true, cdm: true, readOnly: true, snapshotAt: snap.generatedAt });
    case "/taxonomy": return json(snap.taxonomy);
    case "/overview": return json({ ...snap.overview, jobs: [] });
    case "/plan": return json(snap.plan);
    case "/jobs": return json([]);
    case "/searches": return json(snap.searches.slice(0, Number(q.get("limit") ?? 200)));
    case "/places": {
      const type = q.get("type"), group = q.get("group"), focus = q.get("focus"), text = q.get("q")?.toLowerCase();
      return json((snap.places as Row[]).filter((p) => (!type || p.type === type) && (!group || p.group === group) && (!focus || p.focus)
        && tierIs(p, q.get("tier")) && moveIs(p, q.get("move")) && (!text || `${p.name} ${p.description} ${p.key}`.toLowerCase().includes(text))));
    }
    case "/leads": return json((snap.leads as Row[]).filter((l) => tierIs(l, q.get("tier")) && moveIs(l, q.get("move"))));
    case "/export/gtm.csv": return new Response(snap.exports.csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": "attachment; filename=scout-gtm-import.csv" } });
    case "/export/replies.json": return json(snap.exports.replies);
    case "/export/report.md": return new Response(snap.exports.report, { headers: { "content-type": "text/markdown; charset=utf-8" } });
  }
  if (parts[0] === "places" && parts[1] && parts.length === 2) {
    const d = snap.placeDetails[parts[1]];
    return d ? json(d) : json({ error: "No such place" }, 404);
  }
  return json({ error: "Not found" }, 404);
}
