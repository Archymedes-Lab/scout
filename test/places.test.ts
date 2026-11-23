import { describe, expect, test } from "bun:test";
import { openStore } from "../src/db.ts";
import { discoverPlaces, noPromo, PLACE_TYPES, isRoundup, placeFromMention, placeFromUrl, queryPlan, retypePlatforms, sizeOf, THEMES } from "../src/places.ts";
import type { PlaceType } from "../src/types.ts";
import { fakeExa } from "./fakes.ts";

describe("query matrix", () => {
  test("covers every place type × every theme exactly once, with no duplicate queries", () => {
    const plan = queryPlan();
    expect(plan.length).toBe(PLACE_TYPES.filter((t) => t.search).length * THEMES.length);
    for (const t of PLACE_TYPES.filter((x) => x.search)) for (const th of THEMES) expect(plan.filter((q) => q.type === t.id && q.theme === th.id).length).toBe(1);
    expect(new Set(plan.map((q) => q.query)).size).toBe(plan.length);
  });

  test("can be narrowed to some types and themes", () => {
    const plan = queryPlan(["subreddit", "newsletter"], ["ai_agents"]);
    expect(plan.map((q) => q.type).sort()).toEqual(["newsletter", "subreddit"]);
  });
});

describe("placeFromUrl: a post reveals the place it lives in", () => {
  const cases: [string, string, PlaceType][] = [
    ["https://www.reddit.com/r/ClaudeAI/comments/abc/agent_deleted_files/", "reddit.com/r/claudeai", "subreddit"],
    ["https://old.reddit.com/r/selfhosted/", "reddit.com/r/selfhosted", "subreddit"],
    ["https://news.ycombinator.com/item?id=1", "news.ycombinator.com", "forum"],
    ["https://security.stackexchange.com/questions/1/x", "security.stackexchange.com", "qa"],
    ["https://discord.gg/AbC123", "discord.gg/abc123", "chat"],
    ["https://discord.com/invite/AbC123", "discord.gg/abc123", "chat"],
    ["https://t.me/devsecops", "t.me/devsecops", "chat"],
    ["https://www.youtube.com/@LiveOverflow/videos", "youtube.com/@liveoverflow", "video"],
    ["https://github.com/sindresorhus/awesome/blob/main/readme.md", "github.com/sindresorhus/awesome", "directory"],
    ["https://github.com/anthropics/claude-code/issues/42", "github.com/anthropics/claude-code", "repo"],
    ["https://tldrsec.substack.com/p/issue-200", "tldrsec.substack.com", "newsletter"],
    ["https://medium.com/better-programming/some-post-123", "medium.com/better-programming", "blog"],
    ["https://dev.to/t/security", "dev.to/t/security", "blog"],
    ["https://www.meetup.com/owasp-krakow/events/1/", "meetup.com/owasp-krakow", "event"],
    ["https://podcasts.apple.com/us/podcast/darknet-diaries/id1296350485", "podcasts.apple.com/us/podcast/darknet-diaries", "podcast"],
    ["https://www.producthunt.com/posts/foo", "producthunt.com", "platform"],
    ["https://www.indiehackers.com/post/how-we-got-users-abc", "indiehackers.com", "platform"],
    ["https://alternativeto.net/software/crowdstrike/", "alternativeto.net", "platform"],
    ["https://www.g2.com/categories/endpoint-protection", "g2.com", "platform"],
    ["https://dev.to/someone/my-agent-story", "dev.to", "platform"],
    ["https://forum.example.org/t/agents-on-servers/123", "forum.example.org", "forum"],
    ["https://www.linkedin.com/groups/12345/", "linkedin.com/groups/12345", "social"],
  ];
  for (const [url, key, type] of cases) test(url, () => {
    const p = placeFromUrl(url, "Title", "blog");
    expect(p?.key).toBe(key);
    expect(p?.type).toBe(type);
  });

  test("an ordinary site takes the type of the query that found it, keyed by host", () => {
    expect(placeFromUrl("https://www.bsidessf.org/schedule", "BSidesSF", "event")).toEqual({ key: "bsidessf.org", type: "event", name: "BSidesSF" });
  });

  test("an ordinary site is never given a type only its URL could prove (a blog found by a subreddit search is not a subreddit)", () => {
    for (const t of ["subreddit", "qa", "chat", "video", "podcast", "marketplace", "social", "repo"] as PlaceType[]) {
      expect(placeFromUrl("https://maconly.dev/blog", "Agents on my MacBook", t)?.type).toBe("blog");
    }
    for (const t of ["forum", "newsletter", "blog", "event", "directory", "partner"] as PlaceType[]) {
      expect(placeFromUrl("https://example.org/x", "X", t)?.type).toBe(t);
    }
  });

  test("not a URL, or a security vendor outside partner searches → no place", () => {
    expect(placeFromUrl("nope", "x", "blog")).toBeNull();
    expect(placeFromUrl("https://www.crowdstrike.com/blog/x", "x", "blog")).toBeNull();
    expect(placeFromUrl("https://www.crowdstrike.com/partners", "x", "partner")?.type).toBe("partner");
  });
});

describe("Exa's structured output: places named on a page", () => {
  test("Reddit mirrors and indexes resolve to the real subreddit", () => {
    expect(placeFromUrl("https://redlib.vanillax.me/r/ChatGPTCoding", "x", "blog")?.key).toBe("reddit.com/r/chatgptcoding");
    expect(placeFromUrl("https://gummysearch.com/r/CursorAI/", "x", "blog")?.key).toBe("reddit.com/r/cursorai");
  });

  test("a named subreddit wins over a mismatched URL; trailing slashes are ignored", () => {
    expect(placeFromMention({ name: "r/GithubCopilot", url: "https://old.reddit.com/r/codex/", kind: "subreddit" }, "subreddit")).toEqual({ key: "reddit.com/r/githubcopilot", type: "subreddit", name: "r/GithubCopilot" });
    expect(placeFromMention({ name: "r/google_antigravity/", url: null, kind: "subreddit" }, "subreddit")?.key).toBe("reddit.com/r/google_antigravity");
  });

  test("other places need a URL (never guessed); the stated kind sets the type for ordinary sites", () => {
    expect(placeFromMention({ name: "tl;dr sec", url: "https://tldrsec.com", kind: "newsletter" }, "blog")).toEqual({ key: "tldrsec.com", type: "newsletter", name: "tl;dr sec" });
    expect(placeFromMention({ name: "Some Discord", url: null, kind: "Discord server" }, "chat")).toBeNull();
    expect(placeFromMention({ name: "BSides Kraków", url: "https://bsideskrakow.pl", kind: "conference" }, "blog")?.type).toBe("event");
    expect(placeFromMention({ name: "", url: "https://x.io", kind: "forum" }, "forum")).toBeNull();
  });
});

describe("platforms", () => {
  test("platforms are searched across every theme, and get readable names", () => {
    expect(queryPlan(["platform"]).length).toBe(THEMES.length);
    expect(placeFromUrl("https://www.producthunt.com/posts/foo", "Foo - Product Hunt", "blog")?.name).toBe("Product Hunt");
  });

  test("places found before platforms existed are retyped in place, keeping their history", async () => {
    const store = openStore(":memory:");
    store.upsertPlace({ key: "producthunt.com", name: "Product Hunt", type: "directory", url: "https://www.producthunt.com", description: "launches", size: null, noPromo: false, themes: ["ai_agents"], source: "exa" });
    store.upsertPlace({ key: "producthunt.com", name: "Product Hunt", type: "directory", url: null, description: "", size: null, noPromo: false, themes: [], source: "exa" });
    store.setPlaceStatus("producthunt.com", "doing");
    store.upsertPlace({ key: "example.org", name: "Example", type: "blog", url: null, description: "", size: null, noPromo: false, themes: [], source: "exa" });
    expect(retypePlatforms(store)).toBe(1);
    const p = store.place("producthunt.com")!;
    expect(p.type).toBe("platform");
    expect(p.hits).toBe(2);
    expect(p.status).toBe("doing");
    expect(store.place("example.org")!.type).toBe("blog");
  });
});

describe("lessons from the first live run", () => {
  test("a well-known platform named without a URL is still found, by its curated name", () => {
    expect(placeFromMention({ name: "Product Hunt", url: null, kind: "launch platform" }, "platform")).toEqual({ key: "producthunt.com", type: "platform", name: "Product Hunt" });
    expect(placeFromMention({ name: "indie hackers", url: null, kind: "community" }, "forum")?.key).toBe("indiehackers.com");
    expect(placeFromMention({ name: "Some Unknown Launchpad", url: null, kind: "platform" }, "platform")).toBeNull();
  });

  test("a chat community the page names keeps its kind even when its link is an ordinary site", () => {
    const p = placeFromMention({ name: "Simply Cyber Discord", url: "https://simplycyber.io/discord", kind: "Discord server" }, "chat");
    expect(p).toEqual({ key: "simplycyber.io/discord", type: "chat", name: "Simply Cyber Discord" });
    expect(placeFromMention({ name: "Payments FM Slack", url: "https://paymentsfm.com/slack", kind: "Slack community" }, "blog")?.type).toBe("chat");
  });

  test("roundup pages are sources of places, not places", () => {
    for (const t of ["27 Best Software Development Subreddits", "Top 10 Discord servers for developers", "The best newsletters for DevOps engineers in 2026", "List of AI coding communities"]) expect(isRoundup(t)).toBe(true);
    for (const t of ["Self-Host Talk", "Hacker News", "Best Practices for WSL2 Security"]) expect(isRoundup(t)).toBe(false);
  });

  test("existing chat communities filed as websites are retyped by name", () => {
    const store = openStore(":memory:");
    store.upsertPlace({ key: "simplycyber.io", name: "Simply Cyber Discord", type: "blog", url: null, description: "", size: null, noPromo: false, themes: [], source: "exa" });
    store.upsertPlace({ key: "example.org", name: "Example blog", type: "blog", url: null, description: "", size: null, noPromo: false, themes: [], source: "exa" });
    expect(retypePlatforms(store)).toBe(1);
    expect(store.place("simplycyber.io")!.type).toBe("chat");
    expect(store.place("example.org")!.type).toBe("blog");
  });
});

describe("page signals", () => {
  test("sizeOf reads members, subscribers, readers and followers in k/M/commas; null otherwise", () => {
    expect(sizeOf("Join 12k members")).toBe(12_000);
    expect(sizeOf("45,000 subscribers")).toBe(45_000);
    expect(sizeOf("read by 1.2M developers")).toBe(1_200_000);
    expect(sizeOf("r/ClaudeAI 310K members")).toBe(310_000);
    expect(sizeOf("founded in 2019")).toBeNull();
  });

  test("noPromo spots communities that forbid self-promotion", () => {
    expect(noPromo("Rule 3: No self-promotion")).toBe(true);
    expect(noPromo("no advertising or spam")).toBe(true);
    expect(noPromo("Self-promotion is allowed on Saturdays")).toBe(false);
    expect(noPromo("a friendly forum")).toBe(false);
  });
});

describe("discoverPlaces", () => {
  test("dedupes places across queries, counts how many searches surfaced each, logs every search, idempotent per key", async () => {
    const store = openStore(":memory:");
    const r = await discoverPlaces(store, { fetcher: fakeExa(), types: ["subreddit", "forum"], themes: ["ai_agents", "selfhosted"], perQuery: 5 });
    const places = store.places();
    expect(r.searches).toBe(4);
    expect(store.searches().length).toBe(4);
    expect(new Set(places.map((p) => p.key)).size).toBe(places.length);
    const claude = places.find((p) => p.key === "reddit.com/r/claudeai")!;
    expect(claude.hits).toBe(4);
    await discoverPlaces(store, { fetcher: fakeExa(), types: ["subreddit"], themes: ["ai_agents"], perQuery: 5 });
    expect(store.places().length).toBe(places.length);
    expect(store.places().find((p) => p.key === "reddit.com/r/claudeai")!.hits).toBe(5);
  });

  test("searches follow Exa's recommended shape and ask for the places each page names", async () => {
    const store = openStore(":memory:");
    const bodies: Record<string, unknown>[] = [];
    const spy = (async (u: string | URL | Request, i?: RequestInit) => { bodies.push(JSON.parse(String(i?.body))); return fakeExa()(u, i); }) as typeof fetch;
    const r = await discoverPlaces(store, { fetcher: spy, types: ["subreddit", "repo"], themes: ["ai_agents"], perQuery: 5 });
    for (const b of bodies) {
      expect(b.contents).toEqual({ highlights: true });
      expect(b.category).toBeUndefined();
      expect(b.startPublishedDate).toBeUndefined();
      expect(b.outputSchema).toBeDefined();
      expect(typeof b.systemPrompt).toBe("string");
    }
    // The fake names r/MentionedOnly in its structured output only; it must still become a place.
    expect(store.place("reddit.com/r/mentionedonly")?.type).toBe("subreddit");
    expect(r.cost).toBeCloseTo(0.014, 6);
  });

  test("out of credits or a bad key stops the run at once instead of failing every search", async () => {
    const store = openStore(":memory:");
    let calls = 0;
    const broke = (async () => { calls++; return new Response('{"error":"You have exceeded your credits limit","tag":"NO_MORE_CREDITS"}', { status: 402 }); }) as unknown as typeof fetch;
    const r = await discoverPlaces(store, { fetcher: broke, perQuery: 3, concurrency: 4 });
    expect(r.fatal).toContain("credits");
    expect(calls).toBeLessThanOrEqual(4);
    expect(r.errors.length).toBeLessThanOrEqual(4);
  });

  test("a failing search is logged with its error and does not stop the others", async () => {
    const store = openStore(":memory:");
    let n = 0;
    const flaky = (async (u: string | URL | Request, i?: RequestInit) => (++n === 1 ? new Response("bad", { status: 400 }) : fakeExa()(u, i))) as typeof fetch;
    const r = await discoverPlaces(store, { fetcher: flaky, types: ["subreddit"], themes: ["ai_agents", "selfhosted"], perQuery: 3 });
    expect(r.errors.length).toBe(1);
    expect(store.searches().filter((s) => s.error).length).toBe(1);
    expect(store.places().length).toBeGreaterThan(0);
  });
});
