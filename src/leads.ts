import { SEGMENTS } from "./brief.ts";
import type { Store } from "./db.ts";
import { exaSearch, snippetOf, type ExaResult } from "./exa.ts";
import { fatalExa, placeFromUrl } from "./places.ts";
import type { LeadKind, NewLead, Platform, Segment } from "./types.ts";

/** Host + path, lowercased, without www, query, fragment or trailing slash. Empty for anything not http(s). */
export function leadKey(url: string): string {
  let u: URL;
  try { u = new URL(url); } catch { return ""; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return "";
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  const path = u.pathname.toLowerCase().replace(/\/+$/, "");
  return `${host}${path}`;
}

const THREAD_HOSTS = ["reddit.com", "news.ycombinator.com", "lobste.rs", "dev.to", "stackoverflow.com", "superuser.com", "serverfault.com"];
// Security vendors write about the same problem; they are competitors or partners, never users.
const VENDOR_HOSTS = ["crowdstrike.com", "sentinelone.com", "paloaltonetworks.com", "snyk.io", "socket.dev", "microsoft.com", "wiz.io", "checkpoint.com", "sophos.com", "kaspersky.com", "malwarebytes.com", "trendmicro.com"];

const onHost = (host: string, list: string[]) => list.some((h) => host === h || host.endsWith(`.${h}`));

export function kindOf(url: string): LeadKind {
  let u: URL;
  try { u = new URL(url); } catch { return "company"; }
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  if (onHost(host, VENDOR_HOSTS)) return "vendor";
  if (onHost(host, THREAD_HOSTS)) return "thread";
  if (host === "github.com" && /\/(issues|discussions)\//.test(u.pathname)) return "thread";
  if (/\/(t|comments|discussions|thread|threads)\//.test(u.pathname)) return "thread";
  if ((host === "linkedin.com" && u.pathname.startsWith("/in/")) || host === "x.com" || host === "twitter.com") return "person";
  return "company";
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const BAD_EMAIL = /^(no-?reply|donotreply|mailer-daemon)@|@(example|test)\.(com|org|net)$|\.(png|jpe?g|gif|svg|webp)$/i;

export function extractEmail(text: string): string | null {
  for (const m of text.match(EMAIL) ?? []) if (!BAD_EMAIL.test(m)) return m.toLowerCase();
  return null;
}

/** Argus runs on Windows (with WSL2) and Linux servers. macOS counts only when nothing else is named. */
export function platformOf(text: string): Platform {
  const t = text.toLowerCase();
  const win = /\b(windows|wsl2?|powershell)\b/.test(t);
  const linux = /\b(linux|ubuntu|debian|fedora|systemd|vps)\b|\bservers?\b/.test(t);
  const mac = /\b(macos|mac os|macbook|osx)\b/.test(t);
  if (win && linux) return "mixed";
  if (win) return "windows";
  if (linux) return "linux";
  return mac ? "mac" : "unknown";
}

export function toLead(r: ExaResult, seg: Segment): NewLead | null {
  const key = leadKey(r.url);
  if (!key) return null;
  const snippet = snippetOf(r);
  const text = `${r.title ?? ""} ${snippet}`;
  return {
    url: r.url, key, title: (r.title ?? key).replace(/\s+/g, " ").trim().slice(0, 160), kind: kindOf(r.url), segment: seg.id, snippet,
    email: extractEmail(text), platform: platformOf(text), publishedAt: r.publishedDate ?? null, query: seg.query,
  };
}

export interface DiscoverOpts { fetcher?: typeof fetch; segments?: Segment[]; perQuery?: number }

/** One Exa search per segment; leads are deduped by key, so a page found twice is one lead. */
export async function discoverLeads(store: Store, o: DiscoverOpts = {}): Promise<{ found: number; added: number; errors: string[] }> {
  let found = 0, added = 0;
  const errors: string[] = [];
  for (const seg of o.segments ?? SEGMENTS) {
    let results: ExaResult[];
    try {
      results = await exaSearch({ query: seg.query, numResults: o.perQuery ?? 10 }, o.fetcher);
    } catch (e) {
      errors.push(`${seg.id}: ${e instanceof Error ? e.message : String(e)}`);
      if (fatalExa(e)) break;
      continue;
    }
    for (const r of results) {
      const lead = toLead(r, seg);
      if (!lead) continue;
      found++;
      if (store.upsertLead(lead).created) added++;
      // A thread about the problem also reveals a place where the problem is discussed.
      const place = lead.kind === "thread" ? placeFromUrl(lead.url, null, "forum") : null;
      if (place) store.upsertPlace({ ...place, url: `https://${place.key}`, description: "", size: null, noPromo: false, themes: [], source: "lead" });
    }
  }
  return { found, added, errors };
}
