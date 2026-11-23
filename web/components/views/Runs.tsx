"use client";
import { JOB_LABEL, JobBar, progressText, RunButton, useJobs } from "../Jobs";
import { Page } from "../Shell";
import { Empty, Index, PageHeader, Tag } from "../ui";
import { ago } from "@/lib/format";

const WHAT = {
  cycle: "Everything below, in order, then the report and hand-off files.",
  places: "126 Exa searches (14 place types × 9 audiences), every page mapped to its place, then Orion judges every place.",
  users: "One Exa search per kind of user, Jev marks each free or paying, then Orion picks a move: email, reply, nurture or skip.",
  prospects: "Exa's Agent API builds a list of up to 20 teams likely to pay, with a public email where one exists and the page that proves the fit. Capped at $3 a run.",
  plan: "cdm weighs today's plan against Orion's best places and splits the team's time.",
} as const;

export function RunsView() {
  const { jobs } = useJobs();
  return (
    <Page>
      <PageHeader land="night" seed={11} index="06 Runs · Jobs" title={<>What Scout is <em>doing</em>.</>}
        lead="Long work runs in the engine in the background, one job of each kind at a time. Results appear on every page as soon as a job finishes." />
      <section className="cells mb-14 grid-cols-1 md:grid-cols-2">
        {(Object.keys(WHAT) as (keyof typeof WHAT)[]).map((k) => (
          <div key={k} className="flex flex-col gap-3 p-6">
            <h3 className="t-heading text-h3">{JOB_LABEL[k]}</h3>
            <p className="text-sm text-muted">{WHAT[k]}</p>
            <div className="mt-auto pt-2"><RunButton kind={k} primary={k === "cycle"} /></div>
          </div>
        ))}
      </section>
      <Index>Recent runs</Index>
      {jobs.length === 0 && <div className="mt-4"><Empty icon="history" title="No runs since the engine started." /></div>}
      <ul className="mt-2 flex flex-col">
        {jobs.map((j) => (
          <li key={j.id} className="flex flex-col gap-2 border-b border-hair py-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-medium text-ink">{JOB_LABEL[j.kind]}</span>
              <Tag tone={j.status === "done" ? "success" : j.status === "failed" ? "danger" : "signal"}>{j.status}</Tag>
              <span className="text-xs text-faint">started {ago(j.startedAt)}{j.finishedAt && `, finished ${ago(j.finishedAt)}`}</span>
            </div>
            {j.status === "running" && <><span className="text-sm text-muted">{progressText(j)}</span><JobBar job={j} /></>}
            {j.error && <p className="text-sm text-danger">{j.error}</p>}
            {j.log.length > 0 && (
              <details className="text-xs text-muted"><summary className="cursor-pointer py-1">Log · {j.log.length} lines</summary>
                <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap bg-frost p-3 font-mono text-[11px] leading-relaxed">{j.log.join("\n")}</pre>
              </details>
            )}
          </li>
        ))}
      </ul>
    </Page>
  );
}
