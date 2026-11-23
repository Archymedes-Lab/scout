import type { Store } from "./db.ts";
import { topScore } from "./orion.ts";
import { isRoundup } from "./places.ts";
import type { PlaceType } from "./types.ts";

/**
 * Orion judges each place on its own, so on a broad search it says "engage now" for hundreds. Four people cannot work
 * hundreds of places, so capacity is a separate, deterministic rule: Focus is the top few "engage now" places in each
 * kind of place, platforms, websites and forums first, ordered by Orion's own score, so one strong kind never crowds
 * out the others. Orion's verdicts are untouched; this only chooses what to work first.
 */
export const FOCUS_GROUPS: { id: string; label: string; types: PlaceType[] }[] = [
  { id: "platforms", label: "Platforms and directories", types: ["platform", "directory", "marketplace"] },
  { id: "websites", label: "Websites and media", types: ["blog", "newsletter", "podcast", "video"] },
  { id: "communities", label: "Forums and communities", types: ["forum", "subreddit", "qa", "chat", "social"] },
  { id: "events", label: "Events and meetups", types: ["event"] },
  { id: "projects", label: "Open-source projects", types: ["repo"] },
  { id: "partners", label: "Partners", types: ["partner"] },
  { id: "own", label: "Our own channels", types: ["own"] },
];
export const FOCUS_PER_GROUP = 5;

export const focusGroupOf = (t: PlaceType) => FOCUS_GROUPS.find((g) => g.types.includes(t))?.id ?? "websites";

export function focusKeys(store: Store, perGroup = FOCUS_PER_GROUP, verdicts = store.allJudgments("place:")): string[] {
  const engaged = store.places()
    .filter((p) => !p.baseline && p.status !== "dismissed" && !isRoundup(p.name))
    .map((p) => ({ p, v: verdicts.get(`place:${p.key}`) ?? null }))
    .filter(({ v }) => v?.pick === "engage")
    .sort((a, b) => topScore(b.v) - topScore(a.v) || b.p.hits - a.p.hits);
  return FOCUS_GROUPS.flatMap((g) => engaged.filter(({ p }) => g.types.includes(p.type)).slice(0, perGroup).map(({ p }) => p.key));
}
