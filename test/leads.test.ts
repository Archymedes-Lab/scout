import { describe, expect, test } from "bun:test";
import { openStore } from "../src/db.ts";
import { discoverLeads, extractEmail, kindOf, leadKey, platformOf } from "../src/leads.ts";
import { fakeExa } from "./fakes.ts";

describe("lead normalisation", () => {
  test("leadKey ignores scheme, www, query, fragment, trailing slash and case", () => {
    const k = leadKey("https://www.Example.com/Team/?utm_source=x#top");
    for (const u of ["http://example.com/team", "https://example.com/team/", "https://EXAMPLE.com/team?a=1"]) expect(leadKey(u)).toBe(k);
    expect(leadKey("https://example.com/other")).not.toBe(k);
  });

  test("leadKey returns empty for anything that is not an http(s) URL", () => {
    for (const u of ["", "not a url", "mailto:a@b.co", "ftp://x.org/y", "javascript:alert(1)"]) expect(leadKey(u)).toBe("");
  });

  test("kindOf: public threads, people, vendors, otherwise companies", () => {
    expect(kindOf("https://www.reddit.com/r/ClaudeAI/comments/abc/agent_deleted_my_files/")).toBe("thread");
    expect(kindOf("https://news.ycombinator.com/item?id=123")).toBe("thread");
    expect(kindOf("https://github.com/anthropics/claude-code/issues/42")).toBe("thread");
    expect(kindOf("https://dev.to/someone/my-agent-story")).toBe("thread");
    expect(kindOf("https://www.linkedin.com/in/jane-doe")).toBe("person");
    expect(kindOf("https://www.crowdstrike.com/blog/ai-agents")).toBe("vendor");
    expect(kindOf("https://acme-agency.io/about")).toBe("company");
  });

  test("extractEmail finds a real address and refuses no-reply, example and asset-looking matches", () => {
    expect(extractEmail("Contact hello@acme-agency.io for projects")).toBe("hello@acme-agency.io");
    for (const t of ["noreply@acme.io", "user@example.com", "logo@2x.png", "no email here", ""]) expect(extractEmail(t)).toBeNull();
  });

  test("platformOf: macOS only when nothing else is named; Windows and Linux together are mixed", () => {
    expect(platformOf("My MacBook running Claude Code")).toBe("mac");
    expect(platformOf("WSL2 on Windows 11")).toBe("windows");
    expect(platformOf("Ubuntu server with systemd")).toBe("linux");
    expect(platformOf("Windows laptop and an Ubuntu server")).toBe("mixed");
    expect(platformOf("macOS and WSL")).toBe("windows");
    expect(platformOf("nothing relevant")).toBe("unknown");
  });
});

describe("discoverLeads", () => {
  test("dedupes across segments, keeps the source URL and is idempotent", async () => {
    const store = openStore(":memory:");
    const first = await discoverLeads(store, { fetcher: fakeExa(), perQuery: 5 });
    expect(first.added).toBeGreaterThan(0);
    const leads = store.leads();
    expect(new Set(leads.map((l) => l.key)).size).toBe(leads.length);
    for (const l of leads) expect(l.url).toMatch(/^https?:\/\//);
    const again = await discoverLeads(store, { fetcher: fakeExa(), perQuery: 5 });
    expect(again.added).toBe(0);
    expect(store.leads().length).toBe(leads.length);
  });
});
