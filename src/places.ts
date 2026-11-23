import type { Store } from "./db.ts";
import { ExaError, exaQuery, snippetOf } from "./exa.ts";
import type { NewPlace, PlaceType } from "./types.ts";

/**
 * Every kind of place on the internet where a potential Argus user spends time. Discovery searches the full matrix of
 * place type × audience theme, and any page found is mapped to the place it lives in (a Reddit thread to its
 * subreddit, a Discourse topic to its forum), so posts about the problem reveal the communities that hold it.
 */
export const PLACE_TYPES: { id: PlaceType; label: string; plural: string; search: boolean; ask: (t: Theme) => string }[] = [
  { id: "platform", label: "Platform", plural: "Platforms", search: true, ask: (t) => `platform where ${t.audience} discover, launch and discuss new tools` },
  { id: "subreddit", label: "Subreddit", plural: "Subreddits", search: true, ask: (t) => `subreddit community for ${t.audience}` },
  { id: "forum", label: "Forum", plural: "Forums", search: true, ask: (t) => `online discussion forum for ${t.audience}` },
  { id: "qa", label: "Q&A site", plural: "Q&A sites", search: true, ask: (t) => `Q&A site where people ask questions about ${t.topic}` },
  { id: "chat", label: "Chat community", plural: "Discord, Slack and Telegram", search: true, ask: (t) => `Discord or Slack community for ${t.audience}` },
  { id: "newsletter", label: "Newsletter", plural: "Newsletters", search: true, ask: (t) => `weekly newsletter for ${t.audience}` },
  { id: "podcast", label: "Podcast", plural: "Podcasts", search: true, ask: (t) => `podcast for ${t.audience} that interviews guests` },
  { id: "video", label: "Video channel", plural: "YouTube channels", search: true, ask: (t) => `YouTube channel for ${t.audience}` },
  { id: "blog", label: "Website", plural: "Websites and publications", search: true, ask: (t) => `website or publication read by ${t.audience}` },
  { id: "event", label: "Event", plural: "Events and meetups", search: true, ask: (t) => `conference or meetup for ${t.audience} with a call for speakers` },
  { id: "directory", label: "Directory", plural: "Directories and launch sites", search: true, ask: (t) => `directory or awesome list of tools for ${t.topic}` },
  { id: "marketplace", label: "Marketplace", plural: "Marketplaces", search: true, ask: (t) => `marketplace or extension store that lists tools for ${t.topic}` },
  { id: "partner", label: "Partner", plural: "Partners and resellers", search: true, ask: (t) => `consultancy or managed service provider selling ${t.topic} services to small teams` },
  { id: "social", label: "Social group", plural: "Social groups", search: true, ask: (t) => `LinkedIn group or Mastodon community for ${t.audience}` },
  { id: "repo", label: "Open-source project", plural: "Open-source projects", search: true, ask: (t) => `open-source project used by ${t.audience}` },
  { id: "own", label: "Our channel", plural: "Our own channels", search: false, ask: () => "" },
];

export interface Theme { id: string; label: string; audience: string; topic: string }

export const THEMES: Theme[] = [
  { id: "ai_agents", label: "AI coding agents", audience: "developers using AI coding agents like Claude Code, Cursor and Codex", topic: "AI coding agents" },
  { id: "devsec", label: "Developer machine security", audience: "developers who care about securing their own machines", topic: "securing developer laptops and workstations" },
  { id: "supply_chain", label: "Supply chain", audience: "engineers worried about malicious npm and PyPI packages", topic: "software supply chain attacks" },
  { id: "windows_wsl", label: "Windows and WSL", audience: "developers on Windows and WSL2", topic: "Windows and WSL2 development" },
  { id: "selfhosted", label: "Self-hosting", audience: "self-hosters and homelab owners running Linux servers", topic: "self-hosted Linux servers" },
  { id: "sysadmin", label: "Sysadmin and DevOps", audience: "sysadmins and DevOps engineers", topic: "Linux server hardening and monitoring" },
  { id: "agencies", label: "Agency owners", audience: "owners of software development agencies", topic: "running a software agency" },
  { id: "fintech", label: "Fintech engineering", audience: "fintech engineering teams", topic: "security and compliance for fintech engineering" },
  { id: "infosec", label: "Infosec practitioners", audience: "infosec practitioners and blue teams", topic: "endpoint detection and threat hunting" },
];

export interface PlannedQuery { type: PlaceType; theme: string; query: string }

export function queryPlan(types?: string[], themes?: string[]): PlannedQuery[] {
  return PLACE_TYPES.filter((t) => t.search && (!types?.length || types.includes(t.id))).flatMap((t) =>
    THEMES.filter((th) => !themes?.length || themes.includes(th.id)).map((th) => ({ type: t.id, theme: th.id, query: t.ask(th) })));
}

// Security vendors write about the same problem; they are competitors, or partners when we look for partners.
const VENDOR_HOSTS = ["crowdstrike.com", "sentinelone.com", "paloaltonetworks.com", "snyk.io", "socket.dev", "microsoft.com", "wiz.io", "checkpoint.com", "sophos.com", "kaspersky.com", "malwarebytes.com", "trendmicro.com"];
const DIRECTORY_HOSTS = ["theresanaiforthat.com", "futuretools.io"];
/** Platforms where a maker can launch, list, post or keep a profile: one place per platform, keyed by host. */
const PLATFORM_BY_NAME = new Map<string, string>();
export const PLATFORMS: Record<string, string> = {
  "producthunt.com": "Product Hunt", "indiehackers.com": "Indie Hackers", "betalist.com": "BetaList", "alternativeto.net": "AlternativeTo",
  "saashub.com": "SaaSHub", "stackshare.io": "StackShare", "g2.com": "G2", "capterra.com": "Capterra", "uneed.best": "Uneed",
  "devhunt.org": "DevHunt", "peerlist.io": "Peerlist", "microlaunch.net": "Microlaunch", "fazier.com": "Fazier", "hashnode.com": "Hashnode",
  "dev.to": "DEV Community", "medium.com": "Medium", "substack.com": "Substack", "x.com": "X", "twitter.com": "X", "bsky.app": "Bluesky",
  "threads.net": "Threads", "linkedin.com": "LinkedIn", "mastodon.social": "Mastodon", "slashdot.org": "Slashdot", "hackernoon.com": "HackerNoon",
};
for (const [host, name] of Object.entries(PLATFORMS)) if (!PLATFORM_BY_NAME.has(name.toLowerCase())) PLATFORM_BY_NAME.set(name.toLowerCase(), host);
const QA_HOSTS = ["stackoverflow.com", "serverfault.com", "superuser.com", "askubuntu.com"];
const EVENT_HOSTS = ["lu.ma", "eventbrite.com", "sessionize.com", "papercall.io"];
const on = (host: string, list: string[]) => list.some((h) => host === h || host.endsWith(`.${h}`));

/** Title without " | Site" or " - Reddit" tails. */
export function cleanTitle(title: string | null | undefined, fallback: string): string {
  const t = (title ?? "").replace(/\s+/g, " ").trim();
  if (!t) return fallback;
  const head = t.split(/\s[|–—·]\s|\s-\s/)[0]!.trim();
  return (head.length >= 3 ? head : t).slice(0, 90);
}

/** The place a URL belongs to: key, type and a readable name. `queryType` is used when the URL is an ordinary site. */
export function placeFromUrl(url: string, title: string | null | undefined, queryType: PlaceType): { key: string; type: PlaceType; name: string } | null {
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  const host = u.hostname.toLowerCase().replace(/^(www|old|new|m)\./, "");
  const seg = u.pathname.split("/").filter(Boolean);
  const lower = seg.map((s) => s.toLowerCase());
  const at = (type: PlaceType, key: string, name: string) => ({ key, type, name });

  if (on(host, VENDOR_HOSTS)) return queryType === "partner" ? at("partner", host, cleanTitle(title, host)) : null;
  if (on(host, ["reddit.com"])) return lower[0] === "r" && seg[1] ? at("subreddit", `reddit.com/r/${lower[1]}`, `r/${seg[1]}`) : null;
  // Reddit mirrors and indexes (redlib, gummysearch…) keep the /r/<name> path: they stand for the real subreddit.
  if (lower[0] === "r" && seg[1] && /^\w{2,21}$/.test(seg[1])) return at("subreddit", `reddit.com/r/${lower[1]}`, `r/${seg[1]}`);
  if (host === "news.ycombinator.com") return at("forum", host, "Hacker News");
  if (host === "lobste.rs") return at("forum", host, "Lobsters");
  if (host.endsWith(".stackexchange.com") || on(host, QA_HOSTS)) return at("qa", host, cleanTitle(title, host).replace(/^.*?\s-\s/, "") || host);
  if (host === "discord.gg" && seg[0]) return at("chat", `discord.gg/${lower[0]}`, cleanTitle(title, `Discord ${seg[0]}`));
  if ((host === "discord.com" || host === "discordapp.com") && lower[0] === "invite" && seg[1]) return at("chat", `discord.gg/${lower[1]}`, cleanTitle(title, `Discord ${seg[1]}`));
  if (host === "t.me" && seg[0]) return at("chat", `t.me/${lower[0]}`, cleanTitle(title, `Telegram ${seg[0]}`));
  if (host.endsWith(".slack.com")) return at("chat", host, cleanTitle(title, host));
  if (host === "youtube.com") {
    if (seg[0]?.startsWith("@")) return at("video", `youtube.com/${lower[0]}`, seg[0]);
    if ((lower[0] === "c" || lower[0] === "channel" || lower[0] === "user") && seg[1]) return at("video", `youtube.com/${lower[0]}/${lower[1]}`, cleanTitle(title, seg[1]));
    return null;
  }
  if (host === "github.com") {
    if (lower[0] === "marketplace") return at("marketplace", seg[1] ? `github.com/marketplace/${lower[1]}` : "github.com/marketplace", cleanTitle(title, "GitHub Marketplace"));
    if (!seg[0] || ["topics", "search", "orgs", "settings"].includes(lower[0]!)) return null;
    const key = seg[1] ? `github.com/${lower[0]}/${lower[1]}` : `github.com/${lower[0]}`;
    return at(lower[1]?.includes("awesome") ? "directory" : "repo", key, seg[1] ? `${seg[0]}/${seg[1]}` : seg[0]!);
  }
  if (host === "marketplace.visualstudio.com" || host === "open-vsx.org" || host === "plugins.jetbrains.com") return at("marketplace", host, cleanTitle(title, host));
  if (host.endsWith(".substack.com") || host.endsWith(".beehiiv.com")) return at("newsletter", host, cleanTitle(title, host));
  if ((host === "buttondown.email" || host === "buttondown.com") && seg[0]) return at("newsletter", `${host}/${lower[0]}`, cleanTitle(title, seg[0]));
  if (host === "medium.com" && seg[0]) return at("blog", `medium.com/${lower[0]}`, seg[0]);
  if (host === "dev.to" && lower[0] === "t" && seg[1]) return at("blog", `dev.to/t/${lower[1]}`, `DEV #${seg[1]}`);
  if (host === "meetup.com" && seg[0]) return at("event", `meetup.com/${lower[0]}`, cleanTitle(title, seg[0]));
  if (on(host, EVENT_HOSTS) && seg[0]) return at("event", `${host}/${lower[0]}`, cleanTitle(title, seg[0]));
  if (host === "podcasts.apple.com") {
    const i = lower.indexOf("podcast");
    return i >= 0 && seg[i + 1] ? at("podcast", `podcasts.apple.com/${lower.slice(0, i + 2).join("/")}`, cleanTitle(title, seg[i + 1]!)) : null;
  }
  if (host === "open.spotify.com" && lower[0] === "show" && seg[1]) return at("podcast", `open.spotify.com/show/${seg[1]}`, cleanTitle(title, "Spotify podcast"));
  if (host === "linkedin.com" && lower[0] === "groups" && seg[1]) return at("social", `linkedin.com/groups/${lower[1]}`, cleanTitle(title, "LinkedIn group"));
  if (PLATFORMS[host]) return at("platform", host, PLATFORMS[host]!);
  if (on(host, DIRECTORY_HOSTS)) return at("directory", host, cleanTitle(title, host).replace(/^.*\| /, ""));
  if (lower.includes("t") || lower.includes("threads") || host.startsWith("forum.") || host.startsWith("community.") || host.startsWith("discuss.")) return at("forum", host, cleanTitle(title, host));
  // Only the URL can prove a subreddit, a Discord, a channel or a repo; any other site found that way is a publication.
  return at(URL_ONLY.includes(queryType) ? "blog" : queryType, host, cleanTitle(title, host));
}

const URL_ONLY: PlaceType[] = ["subreddit", "qa", "chat", "video", "podcast", "marketplace", "social", "repo"];

/** A place a page names, as Exa's structured output returns it. */
export interface Mention { name: string; url: string | null; kind?: string | null; members?: string | null; selfPromotion?: string | null }

const KIND: [RegExp, PlaceType][] = [
  [/platform|launch site|launchpad/i, "platform"], [/subreddit|reddit/i, "subreddit"], [/discord|slack|telegram|chat/i, "chat"], [/newsletter/i, "newsletter"], [/podcast/i, "podcast"],
  [/youtube|video|channel/i, "video"], [/conference|meetup|event|summit/i, "event"], [/directory|awesome|list|launch/i, "directory"],
  [/marketplace|store/i, "marketplace"], [/forum|community|board/i, "forum"], [/q&a|stack ?exchange|question/i, "qa"],
  [/blog|publication|magazine|site/i, "blog"], [/repo|github|open[- ]source/i, "repo"], [/linkedin|mastodon|social|group/i, "social"],
];

/**
 * The place behind a mention. A named subreddit is trusted over its URL (Exa sometimes pairs a name with another
 * subreddit's link); anything else needs a URL, because a URL is never guessed.
 */
export function placeFromMention(m: Mention, queryType: PlaceType): { key: string; type: PlaceType; name: string } | null {
  const name = (m.name ?? "").trim();
  if (!name) return null;
  const sub = name.match(/^\/?r\/(\w{2,21})\/?$/);
  if (sub) return { key: `reddit.com/r/${sub[1]!.toLowerCase()}`, type: "subreddit", name: `r/${sub[1]}` };
  // A well-known platform is found by its curated name even when the page gives no link.
  const known = PLATFORM_BY_NAME.get(name.toLowerCase());
  if (known) return { key: known, type: "platform", name: PLATFORMS[known]! };
  if (!m.url) return null;
  const kind = KIND.find(([re]) => re.test(m.kind ?? ""))?.[1];
  const p = placeFromUrl(m.url, name, kind ?? queryType);
  if (!p) return null;
  // The kind Exa read off the page is evidence: a "Discord server" linked from its own site is still a chat community.
  if (kind && URL_ONLY.includes(kind) && p.type !== kind) {
    const u = new URL(m.url);
    return { key: `${u.hostname.toLowerCase().replace(/^www\./, "")}${u.pathname.toLowerCase().replace(/\/+$/, "")}`, type: kind, name: name.slice(0, 90) };
  }
  return { ...p, name: p.type === "subreddit" ? p.name : name.slice(0, 90) };
}

/** "27 Best Software Development Subreddits": a page that lists places is a source of places, not a place. */
export function isRoundup(title: string): boolean {
  return /^list of\b/i.test(title.trim())
    || /\b(best|top)\s+(\d+\s+)?([\w&'-]+\s+){0,4}(subreddits|communities|forums|discord servers|servers|slack (groups|communities)|newsletters|podcasts|youtube channels|channels|blogs|websites|sites|conferences|events|directories|platforms|launch sites)\b/i.test(title);
}

/** Asked of Exa with every place search: list what the pages name, never guess. */
export const PLACES_PROMPT = "List every distinct online community, publication or venue the pages name or are: subreddits, forums, Q&A sites, Discord, Slack or Telegram servers, newsletters, podcasts, YouTube channels, events, directories, marketplaces, social groups and open-source projects. Give the canonical URL only when a page shows it, otherwise null. Copy member counts and self-promotion rules only when a page states them, otherwise null. Never guess.";
export const PLACES_SCHEMA = {
  type: "object",
  properties: {
    places: {
      type: "array",
      items: {
        type: "object",
        properties: { name: { type: "string" }, url: { type: ["string", "null"] }, kind: { type: "string" }, members: { type: ["string", "null"] }, selfPromotion: { type: ["string", "null"] } },
        required: ["name", "kind"],
      },
    },
  },
  required: ["places"],
};

const SIZE = /(\d[\d,]*(?:\.\d+)?)\s*([kKmM])?\+?\s+(?:active\s+|monthly\s+)?(members|subscribers|readers|followers|developers|listeners|attendees|engineers|subs|stars|downloads|installs)\b/;

/** Audience size if the page states one: "12k members", "45,000 subscribers", "1.2M developers". */
export function sizeOf(text: string): number | null {
  const m = text.match(SIZE);
  if (!m) return null;
  const n = Number(m[1]!.replace(/,/g, ""));
  const mult = m[2] ? (m[2].toLowerCase() === "k" ? 1e3 : 1e6) : 1;
  return Number.isFinite(n) ? Math.round(n * mult) : null;
}

export function noPromo(text: string): boolean {
  return /\bno\s+(self[- ]?promo\w*|advertis\w*|marketing|vendor\w*|spam)\b|\bself[- ]?promo\w*\s+(is\s+)?(not allowed|prohibited|banned|forbidden)/i.test(text);
}

/** Known places, judged like everything Exa finds. The baseline is today's plan, which cdm compares everything with. */
export const SEED_PLACES: NewPlace[] = [
  { key: "baseline", name: "Today's plan: HN discovery + founder email to agencies", type: "own", url: null, source: "seed", baseline: true, size: null, noPromo: false, themes: ["agencies"],
    description: "archymedes-gtm finds HN threads, and founders email software agencies in the US and Central/Eastern Europe through the approval queue." },
  { key: "own/audits", name: "Paid setup and safety audits", type: "own", url: null, source: "seed", size: null, noPromo: false, themes: ["agencies"],
    description: "Sell one-week $1,500 setup and safety audits to agencies running coding agents, converting each audit into Argus seats." },
  { key: "own/friday", name: "Argus prompt inside Friday", type: "own", url: "https://www.npmjs.com/package/@archymedes/friday", source: "seed", size: null, noPromo: false, themes: ["ai_agents"],
    description: "Mention Argus inside Friday, Archymedes' free open-source coding agent, where a user enables risky tools." },
  { key: "news.ycombinator.com/show", name: "Show HN", type: "forum", url: "https://news.ycombinator.com/show", source: "seed", size: null, noPromo: false, themes: ["ai_agents", "devsec"],
    description: "Launch Argus on Show HN around one concrete audit: what runs because you opened an editor, a repo or a shell." },
  { key: "reddit.com/r/claudeai", name: "r/ClaudeAI", type: "subreddit", url: "https://www.reddit.com/r/ClaudeAI/", source: "seed", size: null, noPromo: false, themes: ["ai_agents"],
    description: "Claude and Claude Code users; threads where an agent did something unsafe." },
  { key: "producthunt.com", name: "Product Hunt", type: "platform", url: "https://www.producthunt.com", source: "seed", size: null, noPromo: false, themes: ["ai_agents", "devsec"],
    description: "Daily launch platform for new products; developer tools launch with a maker comment and a demo." },
  { key: "indiehackers.com", name: "Indie Hackers", type: "platform", url: "https://www.indiehackers.com", source: "seed", size: null, noPromo: false, themes: ["ai_agents", "devsec"],
    description: "Forum and product directory for founders building in public; posts about first customers do well." },
  { key: "devhunt.org", name: "DevHunt", type: "platform", url: "https://devhunt.org", source: "seed", size: null, noPromo: false, themes: ["ai_agents", "devsec"],
    description: "Launch platform specifically for developer tools, voted on by developers." },
  { key: "alternativeto.net", name: "AlternativeTo", type: "platform", url: "https://alternativeto.net", source: "seed", size: null, noPromo: false, themes: ["ai_agents", "devsec"],
    description: "Software listings people browse for alternatives to tools they know, such as endpoint and security tools." },
  { key: "betalist.com", name: "BetaList", type: "platform", url: "https://betalist.com", source: "seed", size: null, noPromo: false, themes: ["ai_agents", "devsec"],
    description: "Directory of early-stage products looking for their first users." },
  { key: "hackernoon.com", name: "HackerNoon", type: "platform", url: "https://hackernoon.com", source: "seed", size: null, noPromo: false, themes: ["ai_agents", "devsec"],
    description: "Tech publishing platform that accepts contributor stories from builders." },
  { key: "peerlist.io", name: "Peerlist", type: "platform", url: "https://peerlist.io", source: "seed", size: null, noPromo: false, themes: ["ai_agents", "devsec"],
    description: "Professional network for developers with a weekly project launchpad." },
  { key: "g2.com", name: "G2", type: "platform", url: "https://www.g2.com", source: "seed", size: null, noPromo: false, themes: ["ai_agents", "devsec"],
    description: "Software review platform buyers check before purchasing for a team." },
  { key: "reddit.com/r/selfhosted", name: "r/selfhosted", type: "subreddit", url: "https://www.reddit.com/r/selfhosted/", source: "seed", size: null, noPromo: false, themes: ["selfhosted"],
    description: "Self-hosters running their own Linux servers, increasingly with agents on them." },
];

async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>): Promise<void> {
  let i = 0;
  await Promise.all(Array.from({ length: Math.max(1, Math.min(n, items.length)) }, async () => { while (i < items.length) await fn(items[i++]!); }));
}

export interface PlaceSearchOpts { fetcher?: typeof fetch; types?: string[]; themes?: string[]; perQuery?: number; concurrency?: number; onProgress?: (done: number, total: number) => void }

function mentionsOf(output: { content?: unknown } | null): Mention[] {
  let c = output?.content;
  if (typeof c === "string") { try { c = JSON.parse(c); } catch { return []; } }
  const places = (c as { places?: unknown } | undefined)?.places;
  return Array.isArray(places) ? places.filter((m): m is Mention => !!m && typeof (m as Mention).name === "string") : [];
}

/** A bad key or an empty account fails every search the same way: stop at the first one. */
export const fatalExa = (e: unknown) => e instanceof ExaError && [401, 402, 403].includes(e.status);

export async function discoverPlaces(store: Store, o: PlaceSearchOpts = {}): Promise<{ searches: number; added: number; errors: string[]; fatal: string | null; cost: number }> {
  const plan = queryPlan(o.types, o.themes);
  let added = 0, done = 0, cost = 0;
  let fatal: string | null = null;
  const errors: string[] = [];
  await pool(plan, o.concurrency ?? 4, async (q) => {
    if (fatal) return;
    const at = new Date().toISOString();
    try {
      const { results, output, cost: c } = await exaQuery({ query: q.query, numResults: o.perQuery ?? 10, systemPrompt: PLACES_PROMPT, outputSchema: PLACES_SCHEMA }, o.fetcher);
      cost += c;
      for (const m of mentionsOf(output)) {
        const p = placeFromMention(m, q.type);
        if (!p) continue;
        const text = `${m.members ?? ""} ${m.selfPromotion ?? ""}`;
        const description = [m.members && `Members: ${m.members}.`, m.selfPromotion && `Self-promotion: ${m.selfPromotion}.`].filter(Boolean).join(" ");
        if (store.upsertPlace({ ...p, url: p.key.includes("/") ? `https://${p.key}` : m.url, description, size: sizeOf(`${m.members ?? ""} members`), noPromo: noPromo(text) || /not allowed|prohibited|banned|forbidden|^no\b/i.test(m.selfPromotion ?? ""), themes: [q.theme], source: "exa" }).created) added++;
      }
      for (const r of results) {
        if (isRoundup(r.title ?? "")) continue; // its places arrive through the structured output above
        const p = placeFromUrl(r.url, r.title, q.type);
        if (!p) continue;
        const text = `${r.title ?? ""} ${snippetOf(r)}`;
        if (store.upsertPlace({ ...p, url: p.key.includes("/") ? `https://${p.key}` : r.url, description: snippetOf(r), size: sizeOf(text), noPromo: noPromo(text), themes: [q.theme], source: "exa" }).created) added++;
      }
      store.logSearch({ query: q.query, type: q.type, theme: q.theme, results: results.length, error: null, at, cost: c });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (fatalExa(e)) fatal ??= msg;
      errors.push(`${q.type}/${q.theme}: ${msg}`);
      store.logSearch({ query: q.query, type: q.type, theme: q.theme, results: 0, error: msg, at, cost: 0 });
    }
    o.onProgress?.(++done, plan.length);
  });
  return { searches: plan.length, added, errors, fatal, cost };
}

/** Places found before platforms were their own kind keep their history and become platforms. */
export function retypePlatforms(store: Store): number {
  let n = 0;
  for (const p of store.places()) {
    if (PLATFORMS[p.key] && p.type !== "platform") n += Number(store.setPlaceType(p.key, "platform", PLATFORMS[p.key]!));
    else if (p.type === "blog" && /\b(discord|slack|telegram)\b/i.test(p.name)) n += Number(store.setPlaceType(p.key, "chat", p.name));
  }
  return n;
}

export const typeLabel = (t: string) => PLACE_TYPES.find((x) => x.id === t)?.label ?? t;
