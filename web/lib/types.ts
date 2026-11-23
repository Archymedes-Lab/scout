// Mirrors ~/sales/src/types.ts and the shapes src/api.ts returns. The engine is the source of truth.
export interface Band { jev: number; low: number; high: number }

export interface Verdict {
  subject: string;
  status: "assessed" | "unavailable";
  verdict: string;
  pick: string | null;
  label: string;
  gap: number | null;
  confidence: number | null;
  stable: boolean | null;
  needsReview: boolean;
  bands: Record<string, Band>;
  ranking: { id: string; label: string; score: number }[];
  reasons: string[];
  flips: string[];
  drivers: { label: string; impact: number }[];
  blocked: { option: string; reason: string }[];
  model: string | null;
  error: string | null;
  at: string;
}

/** What a list row carries; the full Verdict comes from /places/:key. */
export type ListVerdict = Pick<Verdict, "status" | "verdict" | "pick" | "label" | "confidence" | "gap" | "stable"> & { score: number };

export interface TierInfo { tier: string; probabilities: Record<string, number>; error: string | null }

export interface Place {
  key: string; name: string; type: string; url: string | null; description: string; size: number | null; noPromo: boolean;
  themes: string[]; source: "seed" | "exa" | "lead"; baseline: boolean; hits: number; status: "doing" | "done" | "dismissed" | null;
  foundAt: string; seenAt: string; verdict: ListVerdict | null; tier: TierInfo | null; focus: boolean; group: string;
}

export type PlaceDetail = Omit<Place, "verdict"> & { verdict: Verdict | null };

export interface Lead {
  id: number; url: string; key: string; title: string; kind: string; segment: string; segmentLabel: string; snippet: string;
  email: string | null; platform: string; publishedAt: string | null; foundAt: string; verdict: Verdict | null; tier: TierInfo | null;
}

export interface ChannelStat { id: string; mean: number; std: number; cvar: number; novelty: number; p_best: number; ei: number; reliable: boolean; status: string; niche: string; checks: string[] }
export interface Decision {
  commit: string; innovation: string | null; portfolio: Record<string, number>; evpi: number; escalate: string[];
  stats: ChannelStat[]; judge: string; at: string; options?: { id: string; key: string; name: string; type: string }[];
}

export type JobKind = "places" | "plan" | "users" | "prospects" | "cycle";
export interface Job {
  id: string; kind: JobKind; status: "running" | "done" | "failed"; startedAt: string; finishedAt: string | null;
  step: string; done: number; total: number; log: string[]; error: string | null;
}

export interface Taxonomy {
  types: { id: string; label: string; plural: string; search: boolean }[];
  themes: { id: string; label: string; audience: string }[];
  placeMoves: { key: string; label: string }[];
  placeFactors: { id: string; label: string; weight: number }[];
  leadMoves: { key: string; label: string }[];
  leadFactors: { id: string; label: string; weight: number }[];
}

export interface Overview {
  counts: { places: number; engage: number; prepare: number; leads: number; reachNow: number; replyPublic: number; searches: number; paying: number; free: number; focus: number };
  spend: number;
  byType: Record<string, number>;
  decision: Decision | null;
  topPlaces: Place[];
  focusGroups: { id: string; label: string }[];
  topLeads: Lead[];
  jobs: Job[];
}

export interface Health { exa: boolean; jev: boolean; orion: boolean; cdm: boolean; readOnly?: boolean; snapshotAt?: string }
export interface SearchLog { id: number; query: string; type: string | null; theme: string | null; results: number; error: string | null; at: string }
