import { SEGMENTS } from "./brief.ts";
import { leadSubject, type Store } from "./db.ts";
import { TIER_LABEL } from "./tiers.ts";
import { FACTORS, MOVES, PLACE_FACTORS, PLACE_MOVES, topScore } from "./orion.ts";
import { FOCUS_GROUPS, FOCUS_PER_GROUP, focusKeys } from "./focus.ts";
import { typeLabel } from "./places.ts";
import type { Lead, Place, Verdict } from "./types.ts";

const pct = (n: number) => `${Math.round(n * 100)}%`;
const f2 = (n: number) => n.toFixed(2);
const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
const big = (n: number | null) => (n == null ? "—" : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n));

/** The read-out: cdm's plan, every place with Orion's move, then every potential user. */
export function report(store: Store, now = new Date()): string {
  const d = store.latestChannelDecision();
  const name = (id: string | null) => (id ? d?.options?.find((o) => o.id === id)?.name ?? store.place(id)?.name ?? id : "—");
  const out: string[] = [`# Scout report: ${now.toLocaleDateString("sv-SE")}`, ""];

  out.push("## Where to promote Argus-1", "");
  if (!d) out.push("No plan yet. Run `scout plan`.", "");
  else {
    out.push(`- **Commit:** ${name(d.commit)}`, `- **Innovation bet:** ${name(d.innovation)}`,
      `- Decided by cdm with judge \`${d.judge}\` on ${d.at.slice(0, 10)}. EVPI ${f2(d.evpi)}${d.escalate.length ? `; worth a closer look: ${d.escalate.map(name).join(", ")}` : ""}.`, "",
      "| Place | Time split | E[U] | CVaR | P(best) | Gate | Checks |", "| --- | --- | --- | --- | --- | --- | --- |");
    for (const s of d.stats) out.push(`| ${esc(name(s.id))} | ${pct(d.portfolio[s.id] ?? 0)} | ${f2(s.mean)} | ${f2(s.cvar)} | ${pct(s.p_best)} | ${s.status} | ${s.checks.join(", ") || "—"} |`);
    out.push("");
  }

  const places = store.places().map((p) => ({ p, v: store.placeVerdict(p.key) }));
  const focus = focusKeys(store).map((k) => store.place(k)!);
  out.push("## Focus: where to work first", "", `Orion said "engage now" for ${places.filter((x) => x.v?.pick === "engage").length} places. Four people cannot work them all, so these are the top ${FOCUS_PER_GROUP} of each kind (forums and communities, events, websites and media, directories, partners) by Orion's score.`, "");
  for (const g of FOCUS_GROUPS) {
    const rows = focus.filter((p) => g.types.includes(p.type));
    if (rows.length) out.push(`### ${g.label}`, "", ...rows.map((p) => `- **${esc(p.name)}** (${typeLabel(p.type)}) ${p.url ?? ""}`), "");
  }
  out.push("");
  out.push("## Every place found", "", `${places.length} places. Orion's move for each; a place whose rules forbid self-promotion can't be "engage now".`, "");
  const pgroups: [string, { p: Place; v: Verdict | null }[]][] = [
    ...PLACE_MOVES.map((m) => [m.label, places.filter((x) => x.v?.pick === m.key)] as [string, typeof places]),
    ["Too close to call or not assessed", places.filter((x) => !x.v?.pick)],
  ];
  for (const [label, rows] of pgroups) {
    if (!rows.length) continue;
    rows.sort((a, b) => topScore(b.v) - topScore(a.v) || b.p.hits - a.p.hits);
    out.push(`### ${label} (${rows.length})`, "", "| Place | Type | Audience | Searches | Rules | Link |", "| --- | --- | --- | --- | --- | --- |");
    for (const { p } of rows) out.push(`| ${esc(p.name)} | ${typeLabel(p.type)} | ${big(p.size)} | ${p.hits} | ${p.noPromo ? "no self-promotion" : "—"} | ${p.url ?? "—"} |`);
    out.push("");
  }

  const leads = store.leads().map((l) => ({ l, v: store.verdict(l.id), t: store.tier(leadSubject(l.id)) }));
  const nTier = (k: string) => leads.filter((x) => x.t?.tier === k).length;
  out.push("## Potential users", "", `${leads.length} leads. Orion's move per lead; hard rules (no email, not a thread, macOS-only, vendor) are applied by Orion, not by the model.`, "",
    `**Paying prospects:** ${nTier("paying")} · **Free users:** ${nTier("free")} · Not users: ${nTier("none")} · Not yet classified: ${leads.filter((x) => !x.t).length} (Jev's judgement from each page).`, "");
  const groups: [string, { l: Lead; v: Verdict | null; t: ReturnType<Store["tier"]> }[]][] = [
    ...MOVES.map((m) => [m.label, leads.filter((x) => x.v?.pick === m.key)] as [string, typeof leads]),
    ["Too close to call or not assessed", leads.filter((x) => !x.v?.pick)],
  ];
  for (const [label, rows] of groups) {
    if (!rows.length) continue;
    rows.sort((a, b) => (a.t?.tier === "paying" ? 0 : a.t?.tier === "free" ? 1 : 2) - (b.t?.tier === "paying" ? 0 : b.t?.tier === "free" ? 1 : 2));
    out.push(`### ${label} (${rows.length})`, "", "| Lead | Buyer | Segment | Platform | Email | Confidence | Source |", "| --- | --- | --- | --- | --- | --- | --- |");
    for (const { l, v, t } of rows) {
      const seg = SEGMENTS.find((s) => s.id === l.segment)?.label ?? l.segment;
      out.push(`| ${esc(l.title)} | ${t ? TIER_LABEL[t.tier] ?? t.tier : "—"} | ${esc(seg)} | ${l.platform} | ${l.email ? "yes" : "—"} | ${v?.confidence != null ? f2(v.confidence) : v?.label ?? "not assessed"} | ${l.url} |`);
    }
    out.push("");
  }

  out.push("## Assumptions", "", "Orion's factor weights are ours, not market data.", "", "Places:", "",
    ...PLACE_FACTORS.map((f) => `- ${f.label}: ${pct(f.weight)}`), "", "Users:", "",
    ...FACTORS.map((f) => `- ${f.label}: ${pct(f.weight)}`), "",
    "Scout sends nothing. Import the CSV with `bun src/cli.ts import <csv> --product jarvis` in ~/archymedes-gtm, review drafts there, and post in places by hand with disclosure.", "");
  return out.join("\n");
}
