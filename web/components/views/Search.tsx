"use client";
import { useState } from "react";
import { Icon } from "../brand";
import { LeadCard, LeadDrawer, PlaceCard, PlaceDrawer, useTaxonomy } from "../Cards";
import { Page } from "../Shell";
import { ArrowButton, Empty, ErrorNote, Index, Notice, PageHeader, Select, Working, cx } from "../ui";
import { api, invalidate, useApi } from "@/lib/api";
import { ago } from "@/lib/format";
import type { Lead, Place, SearchLog } from "@/lib/types";

const IDEAS = [
  "Discord servers where people build with Claude Code",
  "newsletters about securing developer laptops",
  "conferences in Central and Eastern Europe for DevOps engineers in 2026",
  "awesome lists of AI agent security tools",
  "forums where sysadmins discuss AI agents on production servers",
];

export function SearchView() {
  const tax = useTaxonomy();
  const [text, setText] = useState("");
  const [type, setType] = useState("forum");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ places: Place[]; leads: Lead[] } | null>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const [lead, setLead] = useState<Lead | null>(null);
  const log = useApi<SearchLog[]>("searches?limit=60");

  const run = async (query = text) => {
    if (!query.trim()) return;
    setText(query); setBusy(true); setError(null);
    try { setResult(await api("search", { body: { query, type } })); invalidate(""); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  return (
    <Page wide>
      <PageHeader land="mist" seed={14} index="04 Search · Exa" title={<>Look <em>anywhere</em>.</>}
        lead="Ask for any kind of place or person in plain words. Every page Exa returns is mapped to the place it lives in and kept, so the next Orion run judges it too." />

      <form onSubmit={(e) => { e.preventDefault(); void run(); }} className="flex flex-col gap-4">
        <div className="decide-bar">
          <Icon name="search" size={20} className="mb-3.5 text-muted" />
          <textarea data-page-search rows={1} value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void run(); } }}
            placeholder="“Slack communities for platform engineers”, “podcasts that interview security founders”…" />
          <ArrowButton label="Search" pending={busy} disabled={busy || !text.trim()} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="t-label text-[10px]">Unknown sites count as</span>
          <Select value={type} onChange={(e) => setType(e.target.value)} className="h-9 min-h-9 w-auto py-1 text-sm" aria-label="Place type for ordinary sites">
            {tax?.types.filter((t) => t.search).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </Select>
        </div>
      </form>

      <div className="mt-12 grid grid-cols-1 gap-10 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="flex flex-col gap-8">
          {busy && <Working label="Searching" steps={["Asking Exa", "Mapping every page to its place", "Keeping what is new"]} />}
          {error && <ErrorNote error={error} />}
          {!busy && !result && !error && (
            <Empty icon="globe" title="Try one of these.">
              <ul className="mt-1 flex flex-col gap-1.5">{IDEAS.map((q) => <li key={q}><button className="text-left text-signal-bright underline-offset-4 hover:underline" onClick={() => void run(q)}>{q}</button></li>)}</ul>
            </Empty>
          )}
          {result && (<>
            <div className="flex flex-col gap-4">
              <Index>Places · {result.places.length}</Index>
              {result.places.length ? <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">{result.places.map((p) => <li key={p.key}><PlaceCard p={p} onOpen={() => setPlace(p)} /></li>)}</ul> : <Notice icon="search">No places in these results.</Notice>}
            </div>
            <div className="flex flex-col gap-4">
              <Index>Pages as potential users · {result.leads.length}</Index>
              <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">{result.leads.map((l) => <li key={l.id}><LeadCard l={l} onOpen={() => setLead(l)} /></li>)}</ul>
            </div>
            <p className="text-sm text-muted">New places and users wait for Orion; run "Search every place" or "Find users" to judge them.</p>
          </>)}
        </section>

        <aside className="flex flex-col gap-3">
          <Index>Search log</Index>
          <ul className="flex flex-col">
            {log.data?.map((s) => (
              <li key={s.id} className="flex flex-col gap-0.5 border-b border-hair py-2.5">
                <span className="flex items-center gap-2 text-xs text-faint"><span className="uppercase tracking-[0.12em]">{s.type ?? "any"}</span>{s.theme && <>·<span>{s.theme}</span></>}·<span>{ago(s.at)}</span></span>
                <span className="line-clamp-2 text-sm text-text">{s.query}</span>
                <span className={cx("text-xs", s.error ? "text-danger" : "text-muted")}>{s.error ? s.error.slice(0, 90) : `${s.results} results`}</span>
              </li>
            ))}
          </ul>
          {log.data?.length === 0 && <p className="text-sm text-faint">None yet.</p>}
        </aside>
      </div>
      <PlaceDrawer p={place} onClose={() => setPlace(null)} />
      <LeadDrawer l={lead} onClose={() => setLead(null)} />
    </Page>
  );
}
