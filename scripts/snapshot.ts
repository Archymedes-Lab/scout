// `bun run snapshot`: saves what the engine answers into web/data/snapshot.json for the read-only deployed Scout.
// The file holds real contact emails: it is gitignored and only ships inside the password-protected deployment.
import { mkdirSync, writeFileSync } from "node:fs";
import type { Snapshot } from "../web/lib/snapshot.ts";

type Get = (path: string) => Promise<Response>;

export async function buildSnapshot(get: Get): Promise<Snapshot> {
  const j = async <T>(p: string) => (await (await get(p)).json()) as T;
  const places = await j<Record<string, unknown>[]>("/places");
  const placeDetails: Record<string, unknown> = {};
  for (const p of places) placeDetails[p.key as string] = await j(`/places/${encodeURIComponent(p.key as string)}`);
  return {
    generatedAt: new Date().toISOString(),
    taxonomy: await j("/taxonomy"),
    overview: await j("/overview"),
    plan: await j("/plan"),
    places,
    placeDetails,
    leads: await j("/leads"),
    searches: await j("/searches?limit=500"),
    exports: { csv: await (await get("/export/gtm.csv")).text(), replies: await j("/export/replies.json"), report: await (await get("/export/report.md")).text() },
  };
}

if (import.meta.main) {
  const { createApi } = await import("../src/api.ts");
  const { openStore } = await import("../src/db.ts");
  const api = createApi({ store: openStore() });
  const snap = await buildSnapshot((p) => api(new Request(`http://snapshot/api${p}`), p.split("?")[0]!));
  const out = new URL("../web/data/snapshot.json", import.meta.url).pathname;
  mkdirSync(new URL("../web/data", import.meta.url).pathname, { recursive: true });
  writeFileSync(out, JSON.stringify(snap));
  console.log(`${out}: ${snap.places.length} places, ${snap.leads.length} users, ${(JSON.stringify(snap).length / 1e6).toFixed(1)} MB`);
}
