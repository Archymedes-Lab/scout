"use client";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "./brand";
import { Button, cx, Drawer, Tag, useToast, Working } from "./ui";
import { MoveTag, OrionPanel, TierTag } from "./Verdict";
import { api, invalidate, useApi } from "@/lib/api";
import { big, firstLine, hostOf } from "@/lib/format";
import type { Lead, Place, PlaceDetail, Taxonomy } from "@/lib/types";

export const TYPE_ICON: Record<string, IconName> = {
  subreddit: "chat", forum: "chat", qa: "bulb", chat: "people", newsletter: "mail", podcast: "phone", video: "external",
  blog: "book", event: "flag", directory: "grid", marketplace: "building", partner: "shield", social: "people", repo: "link", own: "spark",
};

// The taxonomy is static for the engine's lifetime: fetch it once per page load, not once per card.
let taxonomy: Taxonomy | undefined;
let pending: Promise<Taxonomy> | null = null;
export function useTaxonomy() {
  const [t, setT] = useState(taxonomy);
  useEffect(() => {
    if (taxonomy) return;
    (pending ??= api<Taxonomy>("taxonomy")).then((x) => { taxonomy = x; setT(x); }).catch(() => { pending = null; });
  }, []);
  return t;
}

const STATUS_LABEL = { doing: "We're on it", done: "Done", dismissed: "Dismissed" } as const;

export function PlaceCard({ p, onOpen }: { p: Place; onOpen: () => void }) {
  const tax = useTaxonomy();
  const type = tax?.types.find((t) => t.id === p.type)?.label ?? p.type;
  return (
    <article className={cx("card card-hover flex h-full flex-col gap-3 p-5", p.status === "dismissed" && "opacity-45")}>
      <div className="flex items-start gap-3">
        <span className="grid size-8 flex-none place-items-center bg-surface text-muted hairline"><Icon name={TYPE_ICON[p.type] ?? "globe"} size={15} /></span>
        <div className="min-w-0 flex-1">
          <button onClick={onOpen} className="text-left"><h3 className="line-clamp-2 font-medium leading-snug text-ink hover:text-signal-bright">{p.name}</h3></button>
          <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
            <span>{type}</span>
            {p.url && <a href={p.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 hover:text-signal-bright">{hostOf(p.url) || p.key}<Icon name="external" size={11} /></a>}
          </span>
        </div>
        <MoveTag v={p.verdict} />
      </div>
      {p.description && <p className="line-clamp-3 text-sm text-text">{firstLine(p.description, 260)}</p>}
      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-1 text-xs text-muted">
        <span className="t-num" title="Audience size the page states">{big(p.size)} <span className="text-faint">audience</span></span>
        <span className="t-num" title="How many searches surfaced it">{p.hits} <span className="text-faint">searches</span></span>
        {p.focus && <Tag tone="signal">Focus</Tag>}
        <TierTag t={p.tier} />
        {p.noPromo && <Tag tone="warning">No self-promotion</Tag>}
        {p.status && <Tag tone={p.status === "done" ? "success" : p.status === "doing" ? "signal" : "neutral"}>{STATUS_LABEL[p.status]}</Tag>}
        <button onClick={onOpen} className="ml-auto text-signal-bright hover:underline">Why</button>
      </div>
    </article>
  );
}

export function PlaceDrawer({ p, onClose }: { p: Place | null; onClose: () => void }) {
  const tax = useTaxonomy();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  // List rows are lean; Orion's full reasoning is fetched when the drawer opens.
  const detail = useApi<PlaceDetail>(p ? `places/${encodeURIComponent(p.key)}` : null);
  if (!p) return null;
  const setStatus = async (status: Place["status"]) => {
    setBusy(status ?? "clear");
    try { await api(`places/${encodeURIComponent(p.key)}/status`, { body: { status } }); invalidate("places"); invalidate("overview"); onClose(); }
    catch (e) { toast({ text: e instanceof Error ? e.message : String(e), tone: "danger" }); }
    finally { setBusy(null); }
  };
  const rescore = async () => {
    setBusy("assess");
    try { await api(`places/${encodeURIComponent(p.key)}/assess`, { body: {} }); invalidate(""); onClose(); }
    catch (e) { toast({ text: e instanceof Error ? e.message : String(e), tone: "danger" }); }
    finally { setBusy(null); }
  };
  return (
    <Drawer open onClose={onClose} title={p.name} wide>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2 text-sm">
          <span className="text-muted">{tax?.types.find((t) => t.id === p.type)?.label ?? p.type} · audience {big(p.size)} · surfaced by {p.hits} search{p.hits === 1 ? "" : "es"} · found via {p.source}</span>
          {p.url && <a href={p.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-signal-bright hover:underline">{p.url}<Icon name="external" size={12} /></a>}
          {p.themes.length > 0 && <div className="flex flex-wrap gap-1.5">{p.themes.map((t) => <Tag key={t} plain>{tax?.themes.find((x) => x.id === t)?.label ?? t}</Tag>)}</div>}
          {p.description && <p className="text-text">{p.description}</p>}
          {p.noPromo && <p className="text-warning">Its page says no self-promotion, so Orion may not choose "engage now". Contribute first, or prepare something they invite.</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" size="sm" icon="check" pending={busy === "doing"} onClick={() => setStatus("doing")}>We're on it</Button>
          <Button size="sm" pending={busy === "done"} onClick={() => setStatus("done")}>Done</Button>
          <Button size="sm" variant="ghost" pending={busy === "dismissed"} onClick={() => setStatus("dismissed")}>Not for us</Button>
          {p.status && <Button size="sm" variant="quiet" onClick={() => setStatus(null)}>Clear mark</Button>}
          <Button size="sm" variant="quiet" icon="refresh" pending={busy === "assess"} onClick={rescore}>Ask Orion again</Button>
        </div>
        {detail.loading ? <Working label="Loading Orion's reasoning" /> : <OrionPanel v={detail.data?.verdict} factors={tax?.placeFactors ?? []} />}
      </div>
    </Drawer>
  );
}

export function LeadCard({ l, onOpen }: { l: Lead; onOpen: () => void }) {
  return (
    <article className="card card-hover flex h-full flex-col gap-3 p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-8 flex-none place-items-center bg-surface text-muted hairline"><Icon name={l.kind === "thread" ? "chat" : l.kind === "person" ? "person" : "building"} size={15} /></span>
        <div className="min-w-0 flex-1">
          <button onClick={onOpen} className="text-left"><h3 className="line-clamp-2 font-medium leading-snug text-ink hover:text-signal-bright">{l.title}</h3></button>
          <a href={l.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-xs text-muted hover:text-signal-bright">{hostOf(l.url)}<Icon name="external" size={11} /></a>
        </div>
        <MoveTag v={l.verdict} />
      </div>
      {l.snippet && <p className="line-clamp-3 text-sm text-text">{firstLine(l.snippet, 260)}</p>}
      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-1 text-xs text-muted">
        <span>{l.segmentLabel}</span>
        <span>{l.platform === "unknown" ? "Platform unknown" : l.platform}</span>
        <TierTag t={l.tier} />
        {l.email ? <Tag tone="success">Email found</Tag> : <Tag>No email</Tag>}
        <button onClick={onOpen} className="ml-auto text-signal-bright hover:underline">Why</button>
      </div>
    </article>
  );
}

export function LeadDrawer({ l, onClose }: { l: Lead | null; onClose: () => void }) {
  const tax = useTaxonomy();
  if (!l) return null;
  return (
    <Drawer open onClose={onClose} title={l.title} wide>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2 text-sm">
          <span className="text-muted">{l.segmentLabel} · {l.kind} · {l.platform}{l.email ? ` · ${l.email}` : ""}</span>
          {l.tier && !l.tier.error && <span className="flex items-center gap-2"><TierTag t={l.tier} /><span className="text-xs text-faint">{Object.entries(l.tier.probabilities).map(([k, v]) => `${k} ${Math.round(v * 100)}%`).join(" · ")}</span></span>}
          <a href={l.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-signal-bright hover:underline">{l.url}<Icon name="external" size={12} /></a>
          {l.snippet && <p className="text-text">{l.snippet}</p>}
        </div>
        <OrionPanel v={l.verdict} factors={tax?.leadFactors ?? []} />
      </div>
    </Drawer>
  );
}
