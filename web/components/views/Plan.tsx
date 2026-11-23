"use client";
import { RunButton } from "../Jobs";
import { Page } from "../Shell";
import { Disclosure, Empty, ErrorNote, Index, Meter, PageHeader, Stat, Tag, Working } from "../ui";
import { useApi } from "@/lib/api";
import { pct } from "@/lib/format";
import type { Decision } from "@/lib/types";

const GATE = { clear: "success", verify: "warning", reject: "danger" } as const;
const CHECK: Record<string, string> = { spam: "May break a community's self-promotion rules", claims: "May need claims Argus-1 can't back", budget: "May need over $500/month" };

export function PlanView() {
  const { data, error, loading, reload } = useApi<{ decision: Decision | null; options: { id: string; name: string; type: string }[] }>("plan");
  const d = data?.decision;
  const name = (id: string | null) => (id ? data?.options.find((o) => o.id === id)?.name ?? id : "—");
  const maxShare = Math.max(0.01, ...Object.values(d?.portfolio ?? {}));

  return (
    <Page>
      <PageHeader land="contour" seed={3} index="05 Plan · cdm" title={<>Where the time <em>goes</em>.</>}
        actions={<RunButton kind="plan" primary />}
        lead="cdm weighs today's plan against the best places Orion found. Jev judges each on reach, conversion, feasibility, compounding and trust; cdm calibrates those beliefs, values each place as an exact lottery and picks one place to commit to, one bounded bet, and a split of the team's time." />

      {error && <ErrorNote error={error} onRetry={reload} />}
      {loading && <Working label="Loading the plan" />}
      {data && !d && <Empty icon="target" title="No plan yet." action={<RunButton kind="plan" primary />}>Search places first so Orion has something to recommend; cdm then plans over the best.</Empty>}
      {d && (
        <div className="flex flex-col gap-14">
          <section className="grid grid-cols-1 gap-x-6 gap-y-8 md:grid-cols-3">
            <Stat value={pct(d.portfolio[d.commit] ?? 0)} label={`Commit: ${name(d.commit)}`} />
            <Stat value={d.innovation ? pct(d.portfolio[d.innovation] ?? 0) : "—"} label={`Innovation bet: ${name(d.innovation)}`} />
            <Stat value={d.evpi.toFixed(2)} label="Value of perfect information: how much better the plan could be if every judgment were known" />
          </section>

          <section className="flex flex-col gap-4">
            <Index n="01">Time split</Index>
            {Object.entries(d.portfolio).sort((a, b) => b[1] - a[1]).map(([id, share]) => (
              <Meter key={id} label={name(id)} value={share / maxShare} display={pct(share)} lead={id === d.commit} />
            ))}
          </section>

          <section className="flex flex-col gap-4">
            <Index n="02">Every option cdm weighed</Index>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead><tr className="border-b border-ink text-left text-xs text-muted">
                  <th className="py-2 pr-3 font-medium">Place</th><th className="py-2 pr-3 font-medium">E[U]</th><th className="py-2 pr-3 font-medium">CVaR 20%</th>
                  <th className="py-2 pr-3 font-medium">P(best)</th><th className="py-2 pr-3 font-medium">Novelty</th><th className="py-2 font-medium">Gate</th>
                </tr></thead>
                <tbody className="rows">
                  {d.stats.map((s) => (
                    <tr key={s.id} className="border-b border-hair align-top">
                      <td className="py-2.5 pr-3 text-ink">{name(s.id)}{s.id === d.commit && <span className="ml-2"><Tag tone="signal">Commit</Tag></span>}{s.id === d.innovation && <span className="ml-2"><Tag tone="success">Bet</Tag></span>}
                        {s.checks.length > 0 && <span className="mt-1 block text-xs text-muted">{s.checks.map((c) => CHECK[c] ?? c).join("; ")}</span>}</td>
                      <td className="t-num py-2.5 pr-3">{s.mean.toFixed(2)}</td><td className="t-num py-2.5 pr-3">{s.cvar.toFixed(2)}</td>
                      <td className="t-num py-2.5 pr-3">{pct(s.p_best)}</td><td className="t-num py-2.5 pr-3">{s.novelty.toFixed(2)}</td>
                      <td className="py-2.5"><Tag tone={GATE[s.status as keyof typeof GATE] ?? "neutral"}>{s.status}</Tag></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-faint">Judge {d.judge} · {new Date(d.at).toLocaleString()}{d.escalate.length > 0 && ` · worth a closer look: ${d.escalate.map(name).join(", ")}`}</p>
          </section>

          <section>
            <Index n="03">How to read it</Index>
            <Disclosure title="Gates: clear, verify, reject">An option is "clear" when Jev sees little chance it breaks a constraint, "verify" when a check is needed first (the reason is listed under its name), and "reject" when the chance is too high. Today's plan is always clear: it is the baseline everything is measured against.</Disclosure>
            <Disclosure title="E[U], CVaR and P(best)">E[U] is the expected value of the place on the five weighted dimensions. CVaR is the average of its worst 20% of outcomes: a place with a good mean but a bad tail is risky. P(best) is the chance it is actually the best option, given the uncertainty.</Disclosure>
            <Disclosure title="Commit and innovation bet">The commit has the highest expected value among reliable options. The innovation bet is the novel option with the most expected improvement over it: a bounded experiment, not a second priority.</Disclosure>
          </section>
        </div>
      )}
    </Page>
  );
}
