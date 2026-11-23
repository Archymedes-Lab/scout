#!/usr/bin/env bun
// scout places [--types a,b] [--themes x,y] [--per 10]   search every place type × theme with Exa, then Orion triages
// scout plan [--mock] [--max 10]                          cdm splits time across Orion's top places
// scout users [--per 10]                                  find potential Argus users with Exa, then Orion judges each
// scout report                                            write the markdown report and hand-off files
// scout cycle [--mock] [--per 10]                         all of the above
// scout engine                                            the JSON API on 127.0.0.1:7440 (the web app talks to it)
import { parseArgs } from "node:util";
import { createApi } from "./api.ts";
import { planPlaces, runCycle, seedPlaces, writeOutputs } from "./cycle.ts";
import { openStore } from "./db.ts";
import { discoverLeads } from "./leads.ts";
import { assessAll, triagePlaces } from "./orion.ts";
import { discoverPlaces } from "./places.ts";
import { createServer } from "./server.ts";

const { positionals, values: flags } = parseArgs({
  args: Bun.argv.slice(2), allowPositionals: true,
  options: { mock: { type: "boolean" }, max: { type: "string" }, per: { type: "string" }, types: { type: "string" }, themes: { type: "string" } },
});

const list = (s?: string) => s?.split(",").map((x) => x.trim()).filter(Boolean);
const bar = (step: string) => (done: number, total: number) => process.stdout.write(`\r${step}: ${done}/${total}   `);

async function main(): Promise<number> {
  const store = openStore();
  seedPlaces(store);
  const per = flags.per ? Number(flags.per) : undefined;
  const maxOptions = flags.max ? Number(flags.max) : undefined;
  switch (positionals[0]) {
    case "places": {
      const r = await discoverPlaces(store, { types: list(flags.types), themes: list(flags.themes), perQuery: per, onProgress: bar("Searching") });
      console.log(`\n${r.added} new places from ${r.searches} searches`);
      r.errors.forEach((e) => console.error(`! ${e}`));
      const t = await triagePlaces(store, {}, { onProgress: bar("Orion") });
      console.log(`\n${t.assessed} judged, ${t.failed} not assessed`);
      return 0;
    }
    case "plan": {
      const d = await planPlaces(store, { cdmMock: flags.mock, maxOptions });
      const name = (id: string | null) => d.options?.find((o) => o.id === id)?.name ?? id ?? "none";
      console.log(`commit: ${name(d.commit)}\ninnovation: ${name(d.innovation)}`);
      for (const s of d.stats) console.log(`  ${name(s.id).slice(0, 48).padEnd(50)} split ${((d.portfolio[s.id] ?? 0) * 100).toFixed(0).padStart(3)}%  E[U] ${s.mean.toFixed(2)}  ${s.status}`);
      return 0;
    }
    case "users": {
      const r = await discoverLeads(store, { perQuery: per });
      r.errors.forEach((e) => console.error(`! ${e}`));
      console.log(`${r.added} new users (${r.found} results)`);
      const a = await assessAll(store, {}, { onProgress: bar("Orion") });
      console.log(`\n${a.assessed} judged, ${a.failed} not assessed`);
      return 0;
    }
    case "report": {
      const { files, gtm } = writeOutputs(store);
      console.log(`${files.report}\n${files.csv} (${gtm} contacts for gtm)\n${files.replies}`);
      return 0;
    }
    case "cycle": {
      const r = await runCycle(store, { cdmMock: flags.mock, perQuery: per, maxOptions, types: list(flags.types), themes: list(flags.themes), log: console.log });
      r.errors.forEach((e) => console.error(`! ${e}`));
      console.log(JSON.stringify({ places: r.places, leads: r.leads, handoff: r.handoff, files: r.files }, null, 1));
      return 0;
    }
    case "engine": {
      const s = createServer(createApi({ store }));
      console.log(`Scout engine on http://127.0.0.1:${s.port}/api`);
      return await new Promise<number>(() => {});
    }
    default:
      console.error("usage: scout places|plan|users|report|cycle|engine [--mock] [--max n] [--per n] [--types a,b] [--themes x,y]");
      return 1;
  }
}

process.exit(await main());
