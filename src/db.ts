import { Database } from "bun:sqlite";
import type { TierRecord } from "./tiers.ts";
import type { ChannelDecision, Lead, NewLead, NewPlace, Place, PlaceStatus, SearchLog, Verdict } from "./types.ts";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY, key TEXT UNIQUE NOT NULL, url TEXT NOT NULL, title TEXT NOT NULL, kind TEXT NOT NULL,
  segment TEXT NOT NULL, snippet TEXT NOT NULL, email TEXT, platform TEXT NOT NULL, published_at TEXT, query TEXT NOT NULL,
  found_at TEXT NOT NULL, seen_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS places (
  key TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL, url TEXT, description TEXT NOT NULL, size INTEGER,
  no_promo INTEGER NOT NULL, themes TEXT NOT NULL, source TEXT NOT NULL, baseline INTEGER NOT NULL, hits INTEGER NOT NULL,
  status TEXT, found_at TEXT NOT NULL, seen_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS judgments (subject TEXT PRIMARY KEY, json TEXT NOT NULL, scores TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS searches (id INTEGER PRIMARY KEY, query TEXT NOT NULL, type TEXT, theme TEXT, results INTEGER NOT NULL, error TEXT, at TEXT NOT NULL, cost REAL NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS tiers (subject TEXT PRIMARY KEY, json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS channel_decisions (id INTEGER PRIMARY KEY, at TEXT NOT NULL, json TEXT NOT NULL);
`;

interface LeadRow {
  id: number; key: string; url: string; title: string; kind: string; segment: string; snippet: string; email: string | null;
  platform: string; published_at: string | null; query: string; found_at: string; seen_at: string;
}
interface PlaceRow {
  key: string; name: string; type: string; url: string | null; description: string; size: number | null; no_promo: number;
  themes: string; source: string; baseline: number; hits: number; status: string | null; found_at: string; seen_at: string;
}

const toLead = (r: LeadRow): Lead => ({
  id: r.id, key: r.key, url: r.url, title: r.title, kind: r.kind as Lead["kind"], segment: r.segment, snippet: r.snippet,
  email: r.email, platform: r.platform as Lead["platform"], publishedAt: r.published_at, query: r.query, foundAt: r.found_at, seenAt: r.seen_at,
});
const toPlace = (r: PlaceRow): Place => ({
  key: r.key, name: r.name, type: r.type as Place["type"], url: r.url, description: r.description, size: r.size, noPromo: !!r.no_promo,
  themes: JSON.parse(r.themes) as string[], source: r.source as Place["source"], baseline: !!r.baseline, hits: r.hits,
  status: r.status as PlaceStatus | null, foundAt: r.found_at, seenAt: r.seen_at,
});

export const leadSubject = (id: number) => `lead:${id}`;
export const placeSubject = (key: string) => `place:${key}`;

export class Store {
  constructor(readonly db: Database) { db.exec("PRAGMA journal_mode = WAL;"); db.exec(SCHEMA); }

  upsertLead(n: NewLead): { id: number; created: boolean } {
    const now = new Date().toISOString();
    const prev = this.db.query<{ id: number }, [string]>("SELECT id FROM leads WHERE key = ?").get(n.key);
    if (prev) {
      this.db.query("UPDATE leads SET snippet = ?, title = ?, email = COALESCE(?, email), platform = ?, seen_at = ? WHERE id = ?")
        .run(n.snippet, n.title, n.email, n.platform, now, prev.id);
      return { id: prev.id, created: false };
    }
    const r = this.db.query("INSERT INTO leads (key,url,title,kind,segment,snippet,email,platform,published_at,query,found_at,seen_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
      .run(n.key, n.url, n.title, n.kind, n.segment, n.snippet, n.email, n.platform, n.publishedAt, n.query, now, now);
    return { id: Number(r.lastInsertRowid), created: true };
  }

  lead(id: number): Lead | null {
    const r = this.db.query<LeadRow, [number]>("SELECT * FROM leads WHERE id = ?").get(id);
    return r ? toLead(r) : null;
  }

  leads(): Lead[] {
    return this.db.query<LeadRow, []>("SELECT * FROM leads ORDER BY id").all().map(toLead);
  }

  /** A place seen again gains a hit, keeps its name and status, and merges what the new page says. */
  upsertPlace(n: NewPlace): { created: boolean } {
    const now = new Date().toISOString();
    const prev = this.place(n.key);
    if (prev) {
      const themes = [...new Set([...prev.themes, ...n.themes])];
      const description = n.description.length > prev.description.length ? n.description : prev.description;
      this.db.query("UPDATE places SET description = ?, size = COALESCE(?, size), no_promo = ?, themes = ?, url = COALESCE(url, ?), hits = hits + 1, seen_at = ? WHERE key = ?")
        .run(description, n.size, prev.noPromo || n.noPromo ? 1 : 0, JSON.stringify(themes), n.url, now, n.key);
      return { created: false };
    }
    this.db.query("INSERT INTO places (key,name,type,url,description,size,no_promo,themes,source,baseline,hits,status,found_at,seen_at) VALUES (?,?,?,?,?,?,?,?,?,?,1,NULL,?,?)")
      .run(n.key, n.name, n.type, n.url, n.description, n.size, n.noPromo ? 1 : 0, JSON.stringify(n.themes), n.source, n.baseline ? 1 : 0, now, now);
    return { created: true };
  }

  place(key: string): Place | null {
    const r = this.db.query<PlaceRow, [string]>("SELECT * FROM places WHERE key = ?").get(key);
    return r ? toPlace(r) : null;
  }

  places(): Place[] {
    return this.db.query<PlaceRow, []>("SELECT * FROM places ORDER BY rowid").all().map(toPlace);
  }

  setPlaceType(key: string, type: string, name: string): boolean {
    return this.db.query("UPDATE places SET type = ?, name = ? WHERE key = ?").run(type, name, key).changes > 0;
  }

  setPlaceStatus(key: string, status: PlaceStatus | null): boolean {
    return this.db.query("UPDATE places SET status = ? WHERE key = ?").run(status, key).changes > 0;
  }

  saveJudgment(v: Verdict, scores: unknown): void {
    this.db.query("INSERT INTO judgments (subject, json, scores) VALUES (?,?,?) ON CONFLICT(subject) DO UPDATE SET json = excluded.json, scores = excluded.scores")
      .run(v.subject, JSON.stringify(v), JSON.stringify(scores));
  }

  judgment(subject: string): Verdict | null {
    const r = this.db.query<{ json: string }, [string]>("SELECT json FROM judgments WHERE subject = ?").get(subject);
    return r ? (JSON.parse(r.json) as Verdict) : null;
  }

  judgmentScores(subject: string): unknown[] | null {
    const r = this.db.query<{ scores: string }, [string]>("SELECT scores FROM judgments WHERE subject = ?").get(subject);
    return r ? (JSON.parse(r.scores) as unknown[]) : null;
  }

  /** Every judgment whose subject starts with `prefix`, in one query: per-row lookups are too slow at a thousand places. */
  allJudgments(prefix: string): Map<string, Verdict> {
    const rows = this.db.query<{ subject: string; json: string }, [string, string]>("SELECT subject, json FROM judgments WHERE subject >= ? AND subject < ?").all(prefix, `${prefix}\uffff`);
    return new Map(rows.map((r) => [r.subject, JSON.parse(r.json) as Verdict]));
  }

  allTiers(prefix: string): Map<string, TierRecord> {
    const rows = this.db.query<{ subject: string; json: string }, [string, string]>("SELECT subject, json FROM tiers WHERE subject >= ? AND subject < ?").all(prefix, `${prefix}\uffff`);
    return new Map(rows.map((r) => [r.subject, JSON.parse(r.json) as TierRecord]));
  }

  verdict(leadId: number): Verdict | null { return this.judgment(leadSubject(leadId)); }
  placeVerdict(key: string): Verdict | null { return this.judgment(placeSubject(key)); }

  saveTier(t: TierRecord): void {
    this.db.query("INSERT INTO tiers (subject, json) VALUES (?,?) ON CONFLICT(subject) DO UPDATE SET json = excluded.json").run(t.subject, JSON.stringify(t));
  }

  tier(subject: string): TierRecord | null {
    const r = this.db.query<{ json: string }, [string]>("SELECT json FROM tiers WHERE subject = ?").get(subject);
    return r ? (JSON.parse(r.json) as TierRecord) : null;
  }

  logSearch(s: Omit<SearchLog, "id">): void {
    this.db.query("INSERT INTO searches (query, type, theme, results, error, at, cost) VALUES (?,?,?,?,?,?,?)").run(s.query, s.type, s.theme, s.results, s.error, s.at, s.cost);
  }

  /** Total Exa spend recorded, in dollars. */
  spend(): number {
    return this.db.query<{ total: number | null }, []>("SELECT SUM(cost) AS total FROM searches").get()?.total ?? 0;
  }

  searches(limit = 500): SearchLog[] {
    return this.db.query<SearchLog, [number]>("SELECT * FROM searches ORDER BY id DESC LIMIT ?").all(limit);
  }

  saveChannelDecision(d: ChannelDecision): void {
    this.db.query("INSERT INTO channel_decisions (at, json) VALUES (?,?)").run(d.at, JSON.stringify(d));
  }

  latestChannelDecision(): ChannelDecision | null {
    const r = this.db.query<{ json: string }, []>("SELECT json FROM channel_decisions ORDER BY at DESC, id DESC LIMIT 1").get();
    return r ? (JSON.parse(r.json) as ChannelDecision) : null;
  }
}

export function openStore(path = process.env.SCOUT_DB ?? new URL("../data/scout.db", import.meta.url).pathname): Store {
  return new Store(new Database(path, { create: true }));
}
