"use client";
import { Index, Meter, Notice, Tag } from "./ui";
import { moveTone } from "@/lib/format";
import type { ListVerdict, TierInfo, Verdict } from "@/lib/types";

const TIER: Record<string, { label: string; tone: "signal" | "success" | "neutral" | "warning" }> = {
  paying: { label: "Paying", tone: "signal" }, free: { label: "Free", tone: "success" }, mixed: { label: "Paying + free", tone: "warning" },
  none: { label: "Not a user", tone: "neutral" }, unclear: { label: "Unclear", tone: "neutral" },
};

/** Jev's free-or-paying call, with its probability on hover. */
export function TierTag({ t }: { t: TierInfo | null | undefined }) {
  if (!t || t.error) return null;
  const m = TIER[t.tier] ?? { label: t.tier, tone: "neutral" as const };
  return <Tag tone={m.tone} plain title={`Jev: ${m.label.toLowerCase()} (p=${(t.probabilities[t.tier] ?? 0).toFixed(2)})`}>{m.label}</Tag>;
}

export function MoveTag({ v }: { v: Pick<ListVerdict, "pick" | "label" | "confidence"> | null | undefined }) {
  if (!v) return <Tag>Not assessed</Tag>;
  return <Tag tone={moveTone(v.pick)} title={v.confidence != null ? `Orion's confidence ${v.confidence}` : undefined}>{v.label}</Tag>;
}

/** Orion's full reasoning for one subject: the ranking with uncertainty bands, what drives it, what would flip it, what the rules ruled out. */
export function OrionPanel({ v, factors }: { v: Verdict | null | undefined; factors: { label: string; weight: number }[] }) {
  if (!v) return <Notice icon="spark">Orion has not judged this yet. Run a search to include it.</Notice>;
  if (v.status === "unavailable") return <Notice tone="warning" icon="flag">Not assessed: {v.error ?? "no usable estimates"}.</Notice>;
  const scores = v.ranking.map((r) => r.score);
  const lo = Math.min(...scores, 0), hi = Math.max(...scores, 1);
  const norm = (x: number) => (x - lo) / (hi - lo || 1);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <MoveTag v={v} />
        {v.confidence != null && <span className="t-num text-xs text-muted">confidence {v.confidence.toFixed(2)}</span>}
        {v.gap != null && <span className="t-num text-xs text-muted">gap {v.gap.toFixed(2)}</span>}
        <span className="text-xs text-muted">{v.stable ? "Stable under weight changes" : "Would change if weights shift"}</span>
      </div>
      <div className="flex flex-col gap-3">
        <Index>Orion's ranking</Index>
        {v.ranking.map((r, i) => {
          const b = v.bands[r.id];
          return <Meter key={r.id} label={r.label} value={norm(r.score)} display={r.score.toFixed(2)} lead={i === 0 && !!v.pick} band={b ? [norm(b.low), norm(b.high)] : undefined} />;
        })}
      </div>
      {v.blocked.length > 0 && (
        <div className="flex flex-col gap-2">
          <Index>Ruled out by the rules, not the model</Index>
          {v.blocked.map((b) => <p key={b.option} className="text-sm text-text"><span className="font-medium text-ink">{v.ranking.find((r) => r.id === b.option)?.label ?? b.option}</span>: {b.reason}</p>)}
        </div>
      )}
      {v.drivers.length > 0 && (
        <div className="flex flex-col gap-2">
          <Index>What drives it</Index>
          <ul className="rows text-sm">{v.drivers.map((d) => <li key={d.label} className="flex justify-between py-2"><span>{d.label}</span><span className="t-num text-muted">{d.impact.toFixed(2)}</span></li>)}</ul>
        </div>
      )}
      {(v.reasons.length > 0 || v.flips.length > 0) && (
        <div className="flex flex-col gap-2">
          <Index>Why, and what would flip it</Index>
          <ul className="flex list-[square] flex-col gap-1 pl-5 text-sm text-text marker:text-signal">{[...v.reasons, ...v.flips].map((r) => <li key={r}>{r}</li>)}</ul>
        </div>
      )}
      <details className="text-sm text-muted">
        <summary className="cursor-pointer py-1">Factor weights (our assumptions)</summary>
        <ul className="rows mt-2">{factors.map((f) => <li key={f.label} className="flex justify-between py-1.5"><span>{f.label}</span><span className="t-num">{Math.round(f.weight * 100)}%</span></li>)}</ul>
      </details>
      <p className="text-xs text-faint">Jev ({v.model ?? "model"}) scored every move against every factor; Orion's deterministic engine ranked them. {new Date(v.at).toLocaleString()}</p>
    </div>
  );
}
