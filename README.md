# Scout

Where Argus will find its users. Scout searches **every kind of place on the internet** where people who run AI
agents gather, finds **potential users**, and decides what to do about each: Orion judges every place and every
person, and cdm splits the team's time across the best places. Scout decides and prepares; it never posts or sends.
[archymedes-gtm](../archymedes-gtm) drafts, checks claims, gets approval and sends. Design and phases: [PLAN.md](PLAN.md).

```bash
cp .env.example .env      # EXA_API_KEY (search), TYPESAFE_API_KEY (Jev, for Orion and cdm)
bun install && (cd web && bun install)
bun run dev               # engine on 127.0.0.1:7440 + web on http://localhost:3020
```

The web app uses Sage's design system ("Swiss Blue": `~/sage/web/DESIGN.md`; tokens, primitives and hills are copied
from Sage, so the two read as one family). Pages:

| Page | What it shows |
| --- | --- |
| Overview | Counts, cdm's commit and innovation bet, the best places, the people to reach, places by type |
| Places | Every place found, filtered by type and Orion's move; "Why" opens Orion's ranking, bands, drivers and rules; mark "We're on it" / done / not for us |
| Users | Potential users with Orion's move; download the gtm import CSV, thread replies and the report |
| Search | Ad-hoc Exa search; every page is mapped to its place and kept |
| Plan | cdm's time split, E[U], CVaR, P(best), gates and checks for every option |
| Runs | Start and watch background jobs: search every place, find users, re-plan, run everything |

## How "all places" works

`src/places.ts` searches a matrix of **14 place types × 9 audience themes** (126 Exa queries): subreddits, forums,
Q&A sites, Discord/Slack/Telegram, newsletters, podcasts, YouTube, publications, events, directories and launch sites,
marketplaces, partners, social groups and open-source projects, across AI-agent users, developer-machine security,
supply chain, Windows/WSL, self-hosting, sysadmin/DevOps, agency owners, fintech engineering and infosec. Every URL is
mapped to the place it lives in (a Reddit thread → its subreddit, a Discourse topic → its forum, a Discord invite →
the server), deduped, and counted by how many searches surfaced it. Audience size and "no self-promotion" rules are
read from the page. Threads found while hunting users add their communities too.

Then **Orion** judges every place: engage now / prepare an asset first / later / skip, over 8 weighted factors, with a
hard rule that a no-self-promotion community can't be "engage now". **cdm** weighs today's plan against Orion's best.

## Free users and paying users

Jev puts every potential user in one of three groups: **paying prospect** (a team or business that would pay for seats),
**free user** (an individual developer, student or maintainer), or not a user. It also judges every place by who
gathers there: mostly paying buyers, mostly free users, or both. Orion sees that call when it judges, the gtm
hand-off lists paying prospects first, and the Places and Users pages filter by it. User searches cover both groups:
agencies, fintech teams, IT providers, startups facing a security review and platform teams for **paying**;
WSL developers, students and open-source maintainers for **free**; incident and supply-chain threads for both.

**Find paying prospects** runs Exa's Agent API (`/agent/runs`): a bounded list of up to 20 teams likely to pay, with
a published email where one exists and the page that proves the fit. Each run has a $3 cap and skips leads already
in Scout.

## How Scout uses Exa

Scout follows Exa's own `build-with-exa` skill (github.com/exa-labs/agent-skills):
- `/search` with bare highlights.
- Place searches add `systemPrompt` + `outputSchema` so Exa lists every place a page names. "Best AI coding
  subreddits" pages yield dozens of places per call.
- No invented categories or date filters.
- The Agent API for list-building.

Each search's cost is logged, and the Overview shows total spend. An out-of-credits or bad-key error stops a run at
the first search.

## CLI

```bash
bun run scout places [--types subreddit,newsletter] [--themes ai_agents]   # search + Orion
bun run scout plan [--mock]                                                # cdm (mock judge offline)
bun run scout users                                                        # Exa + Orion for people
bun run scout report                                                       # data/reports/*
bun run scout cycle                                                        # all of it
```

Hand-off: `cd ~/archymedes-gtm && bun src/cli.ts import <gtm-import.csv> --product jarvis`, then review drafts there.

Checks: `bun run check` (engine tsc + web tsc + 79 tests); `cd web && bun run build`.

## Licence

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
