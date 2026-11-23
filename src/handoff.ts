import { lint } from "./gtm/claims.ts";
import { SEGMENTS } from "./brief.ts";
import { leadSubject, type Store } from "./db.ts";
import { TIER_LABEL } from "./tiers.ts";
import type { Lead, Verdict } from "./types.ts";

/**
 * Scout never sends. Leads Orion says to reach now go to archymedes-gtm as an import CSV (its columns; `source`
 * is the page the lead came from). Public threads become reply candidates that a founder posts by hand, disclosed.
 */
export interface GtmRow { email: string; name: string; company: string; role: string; url: string; segment: string; source: string; note: string }
export interface ReplyCandidate { url: string; title: string; segment: string; angle: string; snippet: string; claimIssues: string[] }

const COLUMNS: (keyof GtmRow)[] = ["email", "name", "company", "role", "url", "segment", "source", "note"];

function picked(store: Store, move: string): { lead: Lead; verdict: Verdict }[] {
  return store.leads().flatMap((lead) => {
    const verdict = store.verdict(lead.id);
    return verdict?.pick === move ? [{ lead, verdict }] : [];
  });
}

const segLabel = (id: string) => SEGMENTS.find((s) => s.id === id)?.label ?? id;

const TIER_ORDER: Record<string, number> = { paying: 0, free: 1 };

/** Paying prospects first, then free users, then anyone not yet classified. */
export function gtmRows(store: Store): GtmRow[] {
  return picked(store, "reach_now").filter(({ lead }) => lead.email)
    .map((x) => ({ ...x, tier: store.tier(leadSubject(x.lead.id)) }))
    .sort((a, b) => (TIER_ORDER[a.tier?.tier ?? ""] ?? 2) - (TIER_ORDER[b.tier?.tier ?? ""] ?? 2))
    .map(({ lead, verdict, tier }) => ({
      email: lead.email!, name: "", company: lead.title, role: "", url: lead.url, segment: lead.segment, source: lead.url,
      note: `${tier ? `${TIER_LABEL[tier.tier] ?? tier.tier}. ` : ""}Scout: ${segLabel(lead.segment)}. Orion: ${verdict.label}${verdict.confidence != null ? ` (confidence ${verdict.confidence})` : ""}. Page: ${lead.snippet.slice(0, 240)}`,
    }));
}

const cell = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function toCsv(rows: GtmRow[]): string {
  return [COLUMNS.join(","), ...rows.map((r) => COLUMNS.map((c) => cell(r[c])).join(","))].join("\n") + "\n";
}

export function replyCandidates(store: Store): ReplyCandidate[] {
  return picked(store, "reply_public").map(({ lead }) => {
    const angle = SEGMENTS.find((s) => s.id === lead.segment)?.angle ?? "";
    return { url: lead.url, title: lead.title, segment: lead.segment, angle, snippet: lead.snippet,
      claimIssues: lint(angle, "jarvis").map((v) => `${v.rule}: ${v.reason}`) };
  });
}
