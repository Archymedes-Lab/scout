"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { PlaceCard, PlaceDrawer, useTaxonomy } from "../Cards";
import { RunButton } from "../Jobs";
import { Page } from "../Shell";
import { Chip, Empty, ErrorNote, Input, PageHeader, Seg, Working } from "../ui";
import { useApi } from "@/lib/api";
import type { Place } from "@/lib/types";

const MOVES = [
  { id: "", label: "All" }, { id: "engage", label: "Engage now" }, { id: "prepare", label: "Prepare first" },
  { id: "later", label: "Later" }, { id: "skip", label: "Skip" }, { id: "none", label: "Undecided" },
] as const;
type MoveId = (typeof MOVES)[number]["id"];
const TIERS = [{ id: "", label: "Any audience" }, { id: "paying", label: "Paying buyers" }, { id: "free", label: "Free users" }, { id: "mixed", label: "Both" }] as const;
type TierId = (typeof TIERS)[number]["id"];
const GROUPS = [
  { id: "platforms", label: "Platforms" }, { id: "websites", label: "Websites and media" }, { id: "communities", label: "Forums and communities" },
  { id: "events", label: "Events" }, { id: "projects", label: "Open-source projects" }, { id: "partners", label: "Partners" },
];

export function PlacesView() {
  const sp = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const tax = useTaxonomy();
  const type = sp.get("type") ?? "";
  const move = (sp.get("move") ?? "") as MoveId;
  const tier = (sp.get("tier") ?? "") as TierId;
  const focusOnly = sp.get("focus") === "1";
  const group = sp.get("group") ?? "";
  const [text, setText] = useState("");
  const [open, setOpen] = useState<Place | null>(null);
  const all = useApi<Place[]>("places");
  const set = (k: string, v: string) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); router.replace(`${path}?${n}`, { scroll: false }); };

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of all.data ?? []) c[p.type] = (c[p.type] ?? 0) + 1;
    return c;
  }, [all.data]);
  const shown = useMemo(() => (all.data ?? []).filter((p) => (!type || p.type === type) && (!group || p.group === group) && (!focusOnly || p.focus) && (!tier || p.tier?.tier === tier)
    && (!move || (move === "none" ? !p.verdict?.pick : p.verdict?.pick === move))
    && (!text || `${p.name} ${p.description} ${p.key}`.toLowerCase().includes(text.toLowerCase()))), [all.data, type, move, tier, text, group, focusOnly]);

  return (
    <Page wide>
      <PageHeader land="village" seed={5} index="02 Places · Every corner of the internet" title={<>Every place they <em>gather</em>.</>}
        actions={<RunButton kind="places" primary />}
        lead="Platforms where makers launch and list tools, websites and publications, forums and communities first; then events, open-source projects and partners. Searched across nine audiences, each judged by Orion." />

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Chip quiet pressed={focusOnly} onClick={() => set("focus", focusOnly ? "" : "1")}>Focus · {all.data?.filter((p) => p.focus).length ?? 0}</Chip>
          {GROUPS.map((g) => <Chip key={g.id} quiet pressed={group === g.id} onClick={() => set("group", group === g.id ? "" : g.id)}>{g.label} · {all.data?.filter((p) => p.group === g.id).length ?? 0}</Chip>)}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip quiet pressed={!type} onClick={() => set("type", "")}>All types · {all.data?.length ?? 0}</Chip>
          {tax?.types.filter((t) => counts[t.id]).map((t) => (
            <Chip key={t.id} quiet pressed={type === t.id} onClick={() => set("type", type === t.id ? "" : t.id)}>{t.plural} · {counts[t.id]}</Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Seg label="Who gathers there" value={tier} onChange={(v) => set("tier", v)} options={TIERS.map((t) => ({ id: t.id, label: t.label }))} small />
          <Seg label="Orion's move" value={move} onChange={(v) => set("move", v)} options={MOVES.map((m) => ({ id: m.id, label: m.label }))} small />
          <Input data-page-search value={text} onChange={(e) => setText(e.target.value)} placeholder="Filter by name or topic" className="h-9 min-h-9 w-64 py-1 text-sm" aria-label="Filter places" />
          <span className="t-num text-xs text-faint">{shown.length} shown</span>
        </div>
      </div>

      <div className="mt-10">
        {all.error && <ErrorNote error={all.error} onRetry={all.reload} />}
        {all.loading && <Working label="Loading places" />}
        {all.data && shown.length === 0 && (
          all.data.length <= 6
            ? <Empty icon="globe" title="Only the starting places so far." action={<RunButton kind="places" primary />}>Search every place type across every audience. It runs 126 Exa searches, then Orion judges every place it finds.</Empty>
            : <Empty icon="filter" title="Nothing matches these filters." />
        )}
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((p, i) => <li key={p.key} className="animate-rise" style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}><PlaceCard p={p} onOpen={() => setOpen(p)} /></li>)}
        </ul>
      </div>
      <PlaceDrawer p={open} onClose={() => setOpen(null)} />
    </Page>
  );
}
