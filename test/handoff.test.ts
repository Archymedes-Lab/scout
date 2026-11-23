import { expect, test } from "bun:test";
import { parseCsv } from "../src/gtm/csv.ts";
import { openStore } from "../src/db.ts";
import { gtmRows, replyCandidates, toCsv } from "../src/handoff.ts";
import { assessLead } from "../src/orion.ts";
import type { NewLead } from "../src/types.ts";
import { favour } from "./fakes.ts";

const mk = (i: number, over: Partial<NewLead>): NewLead => ({ url: `https://l${i}.io/`, key: `l${i}.io`, title: `Lead, "${i}"`, kind: "company", segment: "agencies", snippet: "line one\nline two", email: `a${i}@l${i}.io`, platform: "linux", publishedAt: null, query: "q", ...over });

test("only reach_now leads with an email go to gtm; reply candidates are public threads picked for reply_public", async () => {
  const s = openStore(":memory:");
  const reach = s.upsertLead(mk(1, {})).id;
  const nurture = s.upsertLead(mk(2, {})).id;
  const thread = s.upsertLead(mk(3, { kind: "thread", email: null, url: "https://reddit.com/r/a/comments/3/", key: "reddit.com/r/a/comments/3" })).id;
  await assessLead(s, reach, { scorer: favour("reach_now") });
  await assessLead(s, nurture, { scorer: favour("nurture") });
  await assessLead(s, thread, { scorer: favour("reply_public") });
  expect(gtmRows(s).map((r) => r.email)).toEqual(["a1@l1.io"]);
  expect(replyCandidates(s).map((r) => r.url)).toEqual(["https://reddit.com/r/a/comments/3/"]);
});

test("CSV round-trips through gtm's own parser with commas, quotes and newlines intact; every row has email and source", async () => {
  const s = openStore(":memory:");
  for (let i = 1; i <= 3; i++) await assessLead(s, s.upsertLead(mk(i, {})).id, { scorer: favour("reach_now") });
  const rows = gtmRows(s);
  const parsed = parseCsv(toCsv(rows));
  expect(parsed.length).toBe(3);
  parsed.forEach((p, i) => {
    expect(p.email).toBe(rows[i]!.email);
    expect(p.name).toBe(rows[i]!.name);
    expect(p.source).toMatch(/^https:\/\//);
    expect(p.note).toBe(rows[i]!.note);
  });
});
