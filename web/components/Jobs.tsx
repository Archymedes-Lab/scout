"use client";
import { useEffect } from "react";
import { Mark } from "./brand";
import { Button, cx, useToast } from "./ui";
import { api, invalidate, useApi } from "@/lib/api";
import type { Health, Job, JobKind } from "@/lib/types";

export const JOB_LABEL: Record<JobKind, string> = {
  cycle: "Run everything",
  places: "Search every place",
  users: "Find users",
  prospects: "Find paying prospects",
  plan: "Re-plan with cdm",
};

/** All jobs, polled fast while one runs. When a job finishes, every view refetches. */
export function useJobs() {
  const jobs = useApi<Job[]>("jobs", { poll: 1500 });
  const running = jobs.data?.filter((j) => j.status === "running") ?? [];
  const finished = jobs.data?.filter((j) => j.status !== "running").map((j) => j.id).join(",") ?? "";
  useEffect(() => { if (finished) invalidate(""); }, [finished]);
  return { jobs: jobs.data ?? [], running, reload: jobs.reload };
}

export function RunButton({ kind, primary, label }: { kind: JobKind; primary?: boolean; label?: string }) {
  const { running, reload } = useJobs();
  const toast = useToast();
  const readOnly = useApi<Health>("health").data?.readOnly;
  const job = running.find((j) => j.kind === kind);
  if (readOnly) return <Button variant={primary ? "primary" : "secondary"} disabled title="This is a read-only snapshot: run searches in the local app">{label ?? JOB_LABEL[kind]}</Button>;
  const start = async () => {
    try { await api<Job>("jobs", { body: { kind } }); reload(); toast({ text: `${JOB_LABEL[kind]}: started. Progress is in the rail.` }); }
    catch (e) { toast({ text: e instanceof Error ? e.message : String(e), tone: "danger" }); }
  };
  return (
    <Button variant={primary ? "primary" : "secondary"} icon={kind === "plan" ? "target" : kind === "users" ? "people" : kind === "prospects" ? "building" : "search"} pending={!!job} disabled={!!job} onClick={start}>
      {job ? progressText(job) : label ?? JOB_LABEL[kind]}
    </Button>
  );
}

export const progressText = (j: Job) => (j.total ? `${j.step} ${j.done}/${j.total}` : j.step);

/** The rail's live strip: what Scout is doing right now. */
export function JobDock() {
  const { running } = useJobs();
  if (!running.length) return null;
  return (
    <div className="flex flex-col gap-3" aria-live="polite">
      {running.map((j) => (
        <div key={j.id} className="flex flex-col gap-1.5">
          <span className="flex items-center gap-2 text-xs text-ink"><Mark size={11} pulse />{JOB_LABEL[j.kind]}</span>
          <span className="truncate text-[11px] text-muted">{progressText(j)}</span>
          <JobBar job={j} />
        </div>
      ))}
    </div>
  );
}

export function JobBar({ job }: { job: Job }) {
  const pct = job.total ? (job.done / job.total) * 100 : null;
  return pct === null
    ? <div className={cx(job.status === "running" ? "scan-line" : "h-px bg-line")} />
    : <span className="relative block h-1 bg-frost"><span className="absolute inset-y-0 left-0 bg-signal transition-[width] duration-500" style={{ width: `${pct}%` }} /></span>;
}
