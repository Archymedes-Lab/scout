import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { argusFacts, BOUNDARIES, PRICE } from "./brief.ts";
import type { Store } from "./db.ts";
import { topScore } from "./orion.ts";
import { SEED_PLACES, typeLabel } from "./places.ts";
import type { ChannelDecision, NewPlace, Place, PlaceType } from "./types.ts";

/**
 * cdm (~/creative-decision) chooses where to spend the team's promotion time. Orion has already triaged every place;
 * cdm weighs the baseline against the best places Orion says to engage or prepare: Jev judges each on five value
 * dimensions and three constraints, cdm calibrates the beliefs, values each as an exact lottery and returns a committed
 * place, a bounded innovation bet and a time split. Scout only builds the problem and reads the answer.
 */
export interface CdmProblem {
  goal: string;
  context: Record<string, string>;
  precedents: string[];
  options: { id: string; text: string; baseline: boolean; key: string; name: string; type: PlaceType }[];
  dimensions: { id: string; question: string; levels: string[]; weight: number }[];
  constraints: { id: string; violation: string; hard: boolean }[];
  niches: Record<string, string>;
}

const optionOf = (p: NewPlace | Place, baseline: boolean) => ({
  id: p.key, key: p.key, name: p.name, type: p.type, baseline,
  text: `${p.name} (${typeLabel(p.type)}${p.size ? `, about ${p.size.toLocaleString("en-US")} people` : ""}): ${p.description.slice(0, 260)}`,
});

export function placesProblem(store: Store, max = 10): CdmProblem {
  const all = store.places();
  const baseline = all.find((p) => p.baseline) ?? SEED_PLACES.find((p) => p.baseline)!;
  const judged = all.filter((p) => !p.baseline && p.status !== "dismissed").map((p) => ({ p, v: store.placeVerdict(p.key) }));
  const engaged = judged.filter(({ v }) => v?.pick === "engage" || v?.pick === "prepare")
    .sort((a, b) => topScore(b.v) - topScore(a.v) || b.p.hits - a.p.hits).map(({ p }) => p);
  // Before Orion has run, the seed places stand in so there is still something to weigh.
  const pool = engaged.length ? engaged : judged.filter(({ v, p }) => !v && p.source === "seed").map(({ p }) => p);
  const picked = [optionOf(baseline, true), ...pool.slice(0, Math.max(1, max) - 1).map((p) => optionOf(p, false))];
  return {
    goal: "Win Archymedes' first paying Argus seats fastest over the next 90 days, with four people and almost no marketing budget",
    context: {
      company: "Archymedes, a four-person AI lab in Kigali, Rwanda; $0 revenue",
      product: "Argus (formerly JARVIS): a local security guardian for Windows/WSL2 PCs and Linux servers that run AI coding agents",
      price: PRICE,
      facts: argusFacts().join("; "),
      boundaries: BOUNDARIES.join(" "),
      buyers: "Software agencies in the US and Central/Eastern Europe, fintech engineering teams, developers running coding agents",
    },
    precedents: ["Founder-led cold email to agencies", "Posting a launch on Hacker News", "Writing a blog post about the product"],
    options: picked,
    dimensions: [
      { id: "reach", question: "How many of Argus's likely buyers would `option` put Argus in front of within 90 days?",
        levels: ["Almost none", "Dozens", "Hundreds", "Thousands", "Tens of thousands"], weight: 0.25 },
      { id: "convert", question: "How likely are people reached through `option` to buy a paid Argus seat?",
        levels: ["Very unlikely", "Unlikely", "Even odds for a few", "Likely for some", "Likely for many"], weight: 0.3 },
      { id: "feasible", question: "How feasible is `option` for a four-person team alongside building the product?",
        levels: ["Not feasible", "A large strain", "Feasible with trade-offs", "Comfortably feasible", "Almost free to run"], weight: 0.2 },
      { id: "compound", question: "How much does the effort in `option` keep paying off after the first month?",
        levels: ["Not at all", "Fades quickly", "Some lasting effect", "Keeps paying", "Compounds"], weight: 0.15 },
      { id: "trust", question: "How credible would `option` make Argus to security-minded developers?",
        levels: ["Damages trust", "Neutral", "Slightly", "Clearly", "Strongly"], weight: 0.1 },
    ],
    constraints: [
      { id: "spam", violation: "break a community's self-promotion rules or amount to unsolicited bulk messaging", hard: true },
      { id: "claims", violation: "require claims Argus cannot back, such as replacing endpoint security, macOS support or catching every attack", hard: true },
      { id: "budget", violation: "need more than $500 a month of paid spend", hard: false },
    ],
    niches: {
      direct: "The team sells and delivers itself",
      community: "Helpful presence where developers already talk",
      media: "Someone else's audience: a newsletter, podcast, channel or publication",
      event: "A talk or booth in front of a room",
      listing: "A directory, marketplace or awesome list people browse",
      channel: "A partner sells or delivers",
      product: "Another Archymedes product creates the demand",
    },
  };
}

export interface CdmOpts {
  mock?: boolean;
  script?: string;
  project?: string;
}

/** Runs py/cdm_channels.py under cdm's own uv project. Throws on any failure: no decision is better than a fake one. */
export async function runCdm(problem: CdmProblem, o: CdmOpts = {}): Promise<ChannelDecision> {
  const script = resolve(import.meta.dir, "..", o.script ?? "py/cdm_channels.py");
  const project = o.project ?? process.env.CDM_PROJECT ?? join(homedir(), "creative-decision");
  const proc = Bun.spawn(["uv", "run", "--quiet", "--project", project, "python", "-I", script], {
    stdin: new Blob([JSON.stringify({ ...problem, mock: !!o.mock })]),
    stdout: "pipe", stderr: "pipe", env: process.env,
  });
  const [out, err, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
  if (code !== 0) throw new Error(`cdm failed (exit ${code}): ${err.trim().split("\n").slice(-3).join(" | ")}`);
  const d = JSON.parse(out) as Omit<ChannelDecision, "at">;
  if (!problem.options.some((x) => x.id === d.commit)) throw new Error(`cdm returned an unknown commit: ${d.commit}`);
  return { ...d, at: new Date().toISOString(), options: problem.options.map(({ id, key, name, type }) => ({ id, key, name, type })) };
}
