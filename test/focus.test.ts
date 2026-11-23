import { expect, test } from "bun:test";
import { openStore } from "../src/db.ts";
import { FOCUS_GROUPS, FOCUS_PER_GROUP, focusKeys } from "../src/focus.ts";
import { assessPlace, type Scorer } from "../src/orion.ts";
import { PLACE_TYPES } from "../src/places.ts";
import type { NewPlace, PlaceType } from "../src/types.ts";

const mk = (key: string, type: PlaceType): NewPlace => ({ key, name: key, type, url: null, description: "", size: null, noPromo: false, themes: [], source: "exa" });

/** "engage" wins, by a margin that grows with `strength`, so Orion's scores are ordered. */
const engageBy = (strength: number): Scorer => async ({ options, factors }) => ({
  scores: options.flatMap((o) => factors.map((f) => ({ optionId: o.id, factorId: f.id, value: o.id === "engage" ? Math.min(10, 2 + strength / 8) : -2, probabilityConfidence: 0.9 }))),
  model: "fake",
});
const skipAll: Scorer = async ({ options, factors }) => ({ scores: options.flatMap((o) => factors.map((f) => ({ optionId: o.id, factorId: f.id, value: o.id === "skip" ? 9 : -6, probabilityConfidence: 0.9 }))) });

test("every searchable place type belongs to exactly one Focus group", () => {
  for (const t of PLACE_TYPES.filter((x) => x.search)) expect(FOCUS_GROUPS.filter((g) => g.types.includes(t.id)).length).toBe(1);
});

test("platforms, websites and forums lead Focus", () => {
  expect(FOCUS_GROUPS.slice(0, 3).map((g) => g.id)).toEqual(["platforms", "websites", "communities"]);
});

test("Focus spans the kinds of place: strong forums cannot crowd out weaker events and websites", async () => {
  const s = openStore(":memory:");
  for (let i = 0; i < 20; i++) { s.upsertPlace(mk(`forum${i}.io`, "forum")); await assessPlace(s, `forum${i}.io`, { scorer: engageBy(40 + i) }); }
  for (let i = 0; i < 3; i++) { s.upsertPlace(mk(`event${i}.io`, "event")); await assessPlace(s, `event${i}.io`, { scorer: engageBy(i) }); }
  s.upsertPlace(mk("site.io", "blog")); await assessPlace(s, "site.io", { scorer: engageBy(1) });
  const focus = focusKeys(s, 5);
  for (let i = 0; i < 3; i++) expect(focus).toContain(`event${i}.io`);
  expect(focus).toContain("site.io");
  const forums = focus.filter((k) => k.startsWith("forum"));
  expect(forums.length).toBe(5);
  // Within a group, Orion's own score decides: the five strongest forums.
  expect(new Set(forums)).toEqual(new Set(["forum19.io", "forum18.io", "forum17.io", "forum16.io", "forum15.io"]));
});

test("roundup pages never make Focus", async () => {
  const s = openStore(":memory:");
  s.upsertPlace(mk("list.io", "blog")); s.setPlaceType("list.io", "blog", "27 Best Software Development Subreddits");
  await assessPlace(s, "list.io", { scorer: engageBy(30) });
  expect(focusKeys(s)).toEqual([]);
});

test("only places Orion said to engage now; dismissed places never count; size bounded by groups × per-group", async () => {
  expect(FOCUS_PER_GROUP * FOCUS_GROUPS.length).toBeLessThanOrEqual(40);
  const s = openStore(":memory:");
  s.upsertPlace(mk("skip.io", "forum")); await assessPlace(s, "skip.io", { scorer: skipAll });
  s.upsertPlace(mk("gone.io", "event")); await assessPlace(s, "gone.io", { scorer: engageBy(9) });
  s.setPlaceStatus("gone.io", "dismissed");
  expect(focusKeys(s)).toEqual([]);
});
