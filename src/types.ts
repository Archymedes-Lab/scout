export type LeadKind = "thread" | "company" | "person" | "vendor";
export type Platform = "windows" | "linux" | "mixed" | "mac" | "unknown";
export type Move = "reach_now" | "reply_public" | "nurture" | "skip";

export interface Segment {
  id: string;
  label: string;
  /** Exa query: written as the page we hope to find, not as a question. */
  query: string;
  /** One line that opens a conversation with this segment. Linted against gtm's claim register in tests. */
  angle: string;
  /** Who this search mostly finds: buyers with budget, free individual users, or both. A prior, not a verdict. */
  audience: "paying" | "free" | "both";
}

export interface NewLead {
  url: string;
  key: string;
  title: string;
  kind: LeadKind;
  segment: string;
  snippet: string;
  email: string | null;
  platform: Platform;
  publishedAt: string | null;
  query: string;
}

export interface Lead extends NewLead { id: number; foundAt: string; seenAt: string }

export interface Band { jev: number; low: number; high: number }

export type PlaceType =
  | "platform" | "subreddit" | "forum" | "qa" | "chat" | "newsletter" | "podcast" | "video" | "blog" | "event"
  | "directory" | "marketplace" | "partner" | "social" | "repo" | "own";
export type PlaceStatus = "doing" | "done" | "dismissed";
export type PlaceMove = "engage" | "prepare" | "later" | "skip";

export interface NewPlace {
  key: string;
  name: string;
  type: PlaceType;
  url: string | null;
  description: string;
  size: number | null;
  /** The page says the community forbids self-promotion. */
  noPromo: boolean;
  themes: string[];
  source: "seed" | "exa" | "lead";
  baseline?: boolean;
}

export interface Place extends NewPlace { baseline: boolean; hits: number; status: PlaceStatus | null; foundAt: string; seenAt: string }

export interface SearchLog { id: number; query: string; type: string | null; theme: string | null; results: number; error: string | null; at: string; cost: number }

export interface Verdict {
  /** "lead:<id>" or "place:<key>". */
  subject: string;
  status: "assessed" | "unavailable";
  verdict: string;
  pick: Move | PlaceMove | null;
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
  inputHash: string;
  error: string | null;
  at: string;
}

export interface ChannelStat {
  id: string; mean: number; std: number; cvar: number; novelty: number; p_best: number; ei: number;
  reliable: boolean; status: string; niche: string; checks: string[];
}

export interface ChannelDecision {
  commit: string;
  innovation: string | null;
  portfolio: Record<string, number>;
  evpi: number;
  escalate: string[];
  stats: ChannelStat[];
  judge: string;
  at: string;
  /** The places cdm weighed, so the decision can be read without the problem. */
  options?: { id: string; key: string; name: string; type: PlaceType }[];
}
