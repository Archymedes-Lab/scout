# Scout — Argus sales automation

Scout answers two questions every week, with evidence:

1. **Where should we promote Argus?** cdm (`~/creative-decision`) picks a channel portfolio: one committed
   channel, one bounded innovation bet, and a time split across the rest.
2. **Who are the potential users, and what do we do about each?** Exa finds people and teams on the open web;
   Orion (`~/orion`) gives each lead one of four moves, with hard rules the model can't override.

Scout decides and prepares. It does not send. Contacts with an email go to `archymedes-gtm` (claim guard,
approval queue, Resend, tracked links); public threads become disclosed reply candidates someone posts by hand.

## Design calls (Jev, 29 Oct 2026)

| Question | Pick | p |
| --- | --- | --- |
| Shape | Bun engine + CLI + one local dashboard page; hand contacts to archymedes-gtm | 0.68 (extend gtm 0.31, Next app 0.01) |
| Roles | cdm → channel portfolio; Orion → per-lead verdict | 0.97 |
| Automation | Automate discovery, ranking, drafting hand-off; a person approves every message | 0.99 |

## Sources of truth (read, never copied)

- Argus facts: verified Argus claims in `~/archymedes-gtm/catalog/claims.ts`, plus boundaries in `~/archymedes-site/lib/products.ts`.
- Claim lint: `~/archymedes-gtm/src/claims.ts` `lint(text, "jarvis")`.
- Orion engine: `~/orion/src/decision-engine`, `~/orion/src/ai/model.ts`, `~/orion/server/typesafe.ts` (Jev client).
- cdm: `uv run --project ~/creative-decision`, called through `py/cdm_channels.py` (JSON in, JSON out).

## Pipeline

```
channels: seeds + Exa channel discovery ──► cdm (Jev judges, exact lotteries) ──► commit / innovation / split
leads:    Exa queries per segment ──► dedupe ──► Orion verdict (4 moves × 8 factors + hard rules)
hand-off: reach_now + email ──► gtm CSV (email, name, company, role, url, segment, source, note)
          reply_public       ──► reply candidates (thread URL, angle), posted by hand with disclosure
report:   markdown + local dashboard (127.0.0.1)
```

### Lead moves (Orion)

| Move | Meaning | Hard rule (from data, not the model) |
| --- | --- | --- |
| `reach_now` | Email via the gtm approval queue | blocked without an email; blocked for macOS-only leads |
| `reply_public` | Disclosed reply in their public thread | blocked unless the source is a public thread; blocked for macOS-only |
| `nurture` | Watch; reach with content or a later launch | none |
| `skip` | Not a fit | none |

Factors (weights are our assumptions, shown in the report): ICP fit, pain in their own words, sanctioned
path to reach them, ability to pay, seat count, speed to a paid seat, low spam risk, low founder time.

### Channel decision (cdm)

Baseline (status quo): HN discovery + founder-led email to agencies through archymedes-gtm.
Dimensions: ICP reach, conversion to paid seats, feasibility for four people, compounding, credibility with
security-minded developers. Hard constraints: breaks a community's self-promotion rules; needs claims Argus
can't back. Soft: needs paid spend over $500/month.

## Phases

| # | Deliverable | Done when |
| --- | --- | --- |
| 0 | Plan, scaffold, git | this file; `bun test` and `tsc` run |
| 1 | Brief + store | Argus brief loads verified claims; sqlite store round-trips channels, leads, verdicts |
| 2 | Exa client + lead discovery | segment queries → deduped leads with source URL, kind, email if visible, platform |
| 3 | Orion lead verdicts | 4 moves × 8 factors; hard rules hold for every input; cached by input hash |
| 4 | cdm channel portfolio | Python bridge runs cdm (mock judge offline, Jev live); commit, innovation, split stored |
| 5 | Hand-off + report | gtm CSV passes gtm's own importer; reply list; claim-linted angles; markdown report |
| 6 | CLI + dashboard + cycle | `scout cycle` runs everything; `scout serve` shows the latest decisions |
| 7 | Live run | real Exa + Jev run, results reviewed; weekly schedule offered |

Status 29 Oct 2026: phases 0–6 done (28 tests, tsc, ruff, mypy clean). Phase 7: cdm + Jev ran live on the seed channels; Orion + Jev verdicts checked live on sample leads; live lead discovery waits on `EXA_API_KEY` in `.env`.

## v2 (29 Oct 2026): every place on the internet, and Sage's design

The user asked for Sage's design and for Scout to "search about places on the internet and give us where we can get
users, all places".

| Question (Jev) | Pick | p |
| --- | --- | --- |
| Orion / cdm split for places | Orion triages every place; cdm splits time across the top ~10 Orion says to engage, plus the baseline | 0.96 |
| How to search "all places" | Matrix: every place type × every audience theme, and derive the place from any post found | 0.98 |

- **Place types** (14): subreddits, forums, Q&A sites, chat communities (Discord/Slack/Telegram), newsletters, podcasts,
  video channels, blogs and publications, events and meetups, directories and launch sites, marketplaces, partners
  (MSPs, consultancies, agency networks), social groups, open-source repos, plus our own channels.
- **Themes** (9): AI coding agents, developer-machine security, supply chain, Windows/WSL, self-hosting, sysadmin/DevOps,
  agency owners, fintech engineering, infosec practitioners.
- **Place moves (Orion):** engage now / prepare an asset first / later / skip, × 8 factors. Hard rule: a place whose
  page says no self-promotion can't be "engage now".
- **cdm** decides over the baseline + the top places Orion says to engage or prepare.
- **Engine** stays Bun (bun:sqlite, uv for cdm) as a loopback JSON API on :7440, with background jobs and progress.
  **Web** is Next 16 + Tailwind 4 on :3020 with Sage's Swiss Blue design system (tokens, primitives, hills, rail),
  proxying `/api/*` to the engine. Pages: Overview, Places, Plan (cdm), Users (leads), Search, Runs.

| # | Deliverable | Done when |
| --- | --- | --- |
| 8 | Places | query matrix covers every type × theme; places derived from any URL; deduped with hit counts; tests |
| 9 | Place verdicts + cdm over places | rules hold for every score set; cdm problem built from Orion's top places |
| 10 | Engine API + jobs | endpoints and background jobs tested with fakes |
| 11 | Web | Sage design system ported; six pages; typecheck + build; smoke-tested against the engine |

Status 29 Oct 2026: phases 8–11 done (64 tests, tsc, next build, pages screenshot-checked on a demo database). Live search waits on `EXA_API_KEY`.

## Rules

- Nothing is sent or posted by Scout. Every lead keeps the URL it came from (gtm rejects rows without `source`).
- A failed Jev or Exa call never overwrites the last good verdict; unassessed shows as "not assessed".
- Keys come from the environment or `~/sales/.env` (never another project's `.env`): `EXA_API_KEY`, `TYPESAFE_API_KEY`.
- Test first: invariants over edge inputs, one behaviour test per rule, one functional test of the cycle.
