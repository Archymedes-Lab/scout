"use client";
import Link from "next/link";
import { useState } from "react";
import { LeadCard, LeadDrawer, PlaceCard, PlaceDrawer, useTaxonomy } from "../Cards";
import { RunButton } from "../Jobs";
import { Reveal } from "../Reveal";
import { Page } from "../Shell";
import { Empty, ErrorNote, Index, Meter, PageHeader, Stat, Working } from "../ui";
import { useApi } from "@/lib/api";
import { pct } from "@/lib/format";
import type { Lead, Overview, Place } from "@/lib/types";

export function OverviewView() {
  const { data, error, loading, reload } = useApi<Overview>("overview");
  const tax = useTaxonomy();
  const [place, setPlace] = useState<Place | null>(null);
  const [lead, setLead] = useState<Lead | null>(null);
  const d = data?.decision;
  const name = (id: string | null) => (id ? d?.options?.find((o) => o.id === id)?.name ?? id : "—");
  const typeMax = Math.max(1, ...Object.values(data?.byType ?? {}));

  return (
    <Page wide>
      <PageHeader land="horizon" seed={21} index="01 Overview · Argus-1" title={<>Where <span className="whitespace-nowrap">Argus-1</span> finds its <em>users</em>.</>}
        actions={<RunButton kind="cycle" primary />}
        lead="Scout searches every kind of place on the internet where people who run AI agents gather. Orion judges each place and each potential user, and cdm decides where the team's time goes. Nothing is posted or sent from here." />

      {error && <ErrorNote error={error} onRetry={reload} />}
      {loading && <Working label="Loading" />}
      {data && (
        <div className="flex flex-col gap-16">
          <section className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-3 xl:grid-cols-6">
            <Stat value={data.counts.places} label="places found" />
            <Stat value={data.counts.engage} label="to engage now" />
            <Stat value={data.counts.prepare} label="worth preparing for" />
            <Stat value={data.counts.paying} label="paying prospects" />
            <Stat value={data.counts.free} label="free users" />
            <Stat value={`$${data.spend.toFixed(2)}`} label={`Exa spend over ${data.counts.searches} searches`} />
          </section>

          <Reveal as="section" className="grid grid-cols-12 gap-x-6 gap-y-6">
            <div className="col-span-12"><Index n="01" action={<Link href="/plan" className="text-sm text-signal-bright hover:underline">The full plan</Link>}>Where the time goes · cdm</Index></div>
            {d ? (<>
              <div className="col-span-12 flex flex-col gap-2 lg:col-span-6">
                <span className="t-label">Commit</span>
                <p className="t-heading text-h1">{name(d.commit)}</p>
                <span className="t-num text-sm text-muted">{pct(d.portfolio[d.commit] ?? 0)} of the time</span>
              </div>
              <div className="col-span-12 flex flex-col gap-2 lg:col-span-6">
                <span className="t-label">Innovation bet</span>
                <p className="t-heading text-h1">{name(d.innovation)}</p>
                {d.innovation && <span className="t-num text-sm text-muted">{pct(d.portfolio[d.innovation] ?? 0)} of the time</span>}
              </div>
            </>) : (
              <div className="col-span-12"><Empty icon="target" title="No plan yet." action={<RunButton kind="cycle" primary />}>Run everything once: Scout searches every place, Orion judges them, then cdm splits the team's time across the best.</Empty></div>
            )}
          </Reveal>

          <Reveal as="section" className="flex flex-col gap-5">
            <Index n="02" action={<Link href="/places?focus=1" className="text-sm text-signal-bright hover:underline">All {data.counts.focus} in Focus</Link>}>Where to work first · Focus</Index>
            <p className="measure text-sm text-muted">Orion said "engage now" for {data.counts.engage} places. Four people can't work them all, so Focus is the top few of each kind by Orion's score.</p>
            {data.topPlaces.length === 0 && <p className="text-sm text-muted">No place is marked "engage now" yet.</p>}
            {data.focusGroups.map((g) => {
              const rows = data.topPlaces.filter((p) => p.group === g.id);
              return rows.length ? (
                <div key={g.id} className="flex flex-col gap-3">
                  <h3 className="t-heading text-h3">{g.label}</h3>
                  <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">{rows.map((p) => <li key={p.key}><PlaceCard p={p} onOpen={() => setPlace(p)} /></li>)}</ul>
                </div>
              ) : null;
            })}
          </Reveal>

          <Reveal as="section" className="flex flex-col gap-5">
            <Index n="03" action={<Link href="/users" className="text-sm text-signal-bright hover:underline">All users</Link>}>People to reach · Orion</Index>
            {data.topLeads.length
              ? <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">{data.topLeads.map((l) => <li key={l.id}><LeadCard l={l} onOpen={() => setLead(l)} /></li>)}</ul>
              : <p className="text-sm text-muted">Nobody to reach yet.</p>}
          </Reveal>

          <Reveal as="section" className="flex flex-col gap-5">
            <Index n="04">Places by type</Index>
            <div className="grid grid-cols-1 gap-x-10 gap-y-4 md:grid-cols-2 xl:grid-cols-3">
              {tax?.types.map((t) => (
                <Link key={t.id} href={`/places?type=${t.id}`} className="block hover:opacity-80">
                  <Meter label={t.plural} value={(data.byType[t.id] ?? 0) / typeMax} display={String(data.byType[t.id] ?? 0)} />
                </Link>
              ))}
            </div>
          </Reveal>
        </div>
      )}
      <PlaceDrawer p={place} onClose={() => setPlace(null)} />
      <LeadDrawer l={lead} onClose={() => setLead(null)} />
    </Page>
  );
}
