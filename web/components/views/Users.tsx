"use client";
import { useMemo, useState } from "react";
import { LeadCard, LeadDrawer } from "../Cards";
import { RunButton } from "../Jobs";
import { Page } from "../Shell";
import { ButtonLink, Empty, ErrorNote, Index, Notice, PageHeader, Seg, Working } from "../ui";
import { useApi } from "@/lib/api";
import type { Lead } from "@/lib/types";

const MOVES = [
  { id: "", label: "All" }, { id: "reach_now", label: "Reach now" }, { id: "reply_public", label: "Reply in thread" },
  { id: "nurture", label: "Nurture" }, { id: "skip", label: "Skip" }, { id: "none", label: "Undecided" },
] as const;
type MoveId = (typeof MOVES)[number]["id"];
const TIERS = [{ id: "", label: "Everyone" }, { id: "paying", label: "Paying prospects" }, { id: "free", label: "Free users" }, { id: "none", label: "Not users" }] as const;
type TierId = (typeof TIERS)[number]["id"];

export function UsersView() {
  const [move, setMove] = useState<MoveId>("");
  const [tier, setTier] = useState<TierId>("");
  const [open, setOpen] = useState<Lead | null>(null);
  const all = useApi<Lead[]>("leads");
  const shown = useMemo(() => (all.data ?? []).filter((l) => (!tier || l.tier?.tier === tier) && (!move || (move === "none" ? !l.verdict?.pick : l.verdict?.pick === move))), [all.data, move, tier]);
  const nTier = (t: string) => all.data?.filter((l) => l.tier?.tier === t).length ?? 0;
  const reach = all.data?.filter((l) => l.verdict?.pick === "reach_now" && l.email).length ?? 0;

  return (
    <Page wide>
      <PageHeader land="terraces" seed={9} index="03 Users · People and teams" title={<>The people who <em>need</em> <span className="whitespace-nowrap">Argus-1</span>.</>}
        actions={<><RunButton kind="users" primary /><RunButton kind="prospects" /></>}
        lead="Developers hit by an agent doing something unsafe, teams running agents on Windows and Linux, agencies and fintech teams. Orion picks one move for each: email now, reply in their thread, nurture or skip." />

      <Notice tone="signal" icon="send" className="mb-8">
        <p>Scout never sends. {reach} {reach === 1 ? "person" : "people"} with an email go to archymedes-gtm, which drafts, checks every claim and waits for your approval: <code className="font-mono text-xs">bun src/cli.ts import scout-gtm-import.csv --product jarvis</code></p>
        <div className="mt-3 flex flex-wrap gap-2">
          <ButtonLink href="/api/export/gtm.csv" size="sm" icon="download">gtm import CSV</ButtonLink>
          <ButtonLink href="/api/export/replies.json" size="sm" icon="download">Thread replies</ButtonLink>
          <ButtonLink href="/api/export/report.md" size="sm" icon="download" variant="ghost">Full report</ButtonLink>
        </div>
      </Notice>

      <Index action={<span className="t-num text-xs text-faint">{shown.length} shown</span>}>Orion's move</Index>
      <div className="mb-8 mt-4 flex flex-wrap gap-3">
        <Seg label="Free or paying" value={tier} onChange={setTier} options={TIERS.map((t) => ({ id: t.id, label: t.id && t.id !== "none" ? `${t.label} · ${nTier(t.id)}` : t.label }))} small />
        <Seg label="Orion's move" value={move} onChange={setMove} options={MOVES.map((m) => ({ id: m.id, label: m.label }))} small />
      </div>
      {all.error && <ErrorNote error={all.error} onRetry={all.reload} />}
      {all.loading && <Working label="Loading users" />}
      {all.data?.length === 0 && <Empty icon="people" title="No users found yet." action={<RunButton kind="users" primary />}>Scout searches six kinds of potential users with Exa, then Orion judges each.</Empty>}
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((l, i) => <li key={l.id} className="animate-rise" style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}><LeadCard l={l} onOpen={() => setOpen(l)} /></li>)}
      </ul>
      <LeadDrawer l={open} onClose={() => setOpen(null)} />
    </Page>
  );
}
