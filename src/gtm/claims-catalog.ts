// The claim register: what may be said about each product, with the evidence behind it, and what
// must never be said. Every piece of copy this system renders or generates is linted against the
// forbidden list (claims.ts). Sources are the product repos and the public site.
// Vendored from Archymedes' go-to-market tooling.
//
// Update a figure here when the evidence changes; nothing else should hard-code it.

export type ProductId = "cli" | "orion" | "jarvis";
export type ClaimStatus = "verified" | "founder" | "proposed";

export interface Claim {
  id: string;
  product: ProductId | "company";
  text: string;
  status: ClaimStatus;
  evidence: string;
  /** Date the evidence was last checked (YYYY-MM-DD). */
  checked: string;
}

export const CLAIMS: Claim[] = [
  // Archymedes CLI
  { id: "cli.open_source", product: "cli", text: "Open source under Apache-2.0", status: "verified", evidence: "~/archymedes-cli/LICENSE", checked: "2026-10-08" },
  { id: "cli.npm", product: "cli", text: "Install with npm install -g archymedes-cli", status: "verified", evidence: "https://www.npmjs.com/package/archymedes-cli", checked: "2026-10-08" },
  { id: "cli.providers", product: "cli", text: "Works with 11 providers, including local models through Ollama", status: "verified", evidence: "~/archymedes-cli/docs/marketing/announcement.md", checked: "2026-10-08" },
  { id: "cli.free_mode", product: "cli", text: "--free runs only on zero-priced models and never falls back to a paid one (needs your own OpenRouter key)", status: "verified", evidence: "~/archymedes-cli/README.md", checked: "2026-10-08" },
  { id: "cli.undo", product: "cli", text: "Every edit is checkpointed; /diff shows it and /undo takes it back", status: "verified", evidence: "~/archymedes-cli/README.md", checked: "2026-10-08" },
  { id: "cli.verified_green", product: "cli", text: "A result only goes green when the checks it recorded actually passed", status: "verified", evidence: "~/archymedes-site/lib/products.ts", checked: "2026-10-08" },
  { id: "cli.cost", product: "cli", text: "Cost shown every turn in your own currency, with a --budget cap per task", status: "verified", evidence: "~/archymedes-cli/README.md", checked: "2026-10-08" },
  { id: "cli.languages", product: "cli", text: "Interface in 16 languages", status: "verified", evidence: "~/archymedes-cli/docs/marketing/announcement.md", checked: "2026-10-08" },
  { id: "cli.sessions", product: "cli", text: "Sessions are saved after every tool step and survive a crash", status: "verified", evidence: "~/archymedes-cli/README.md", checked: "2026-10-08" },
  { id: "cli.jev", product: "cli", text: "An optional, advisory second opinion from Jev before risky tools and after each turn", status: "founder", evidence: "~/archymedes-cli/docs/continuation/JEV_VERDICT.md (not yet exercised with a live key)", checked: "2026-10-08" },

  // Orion
  { id: "orion.math_decides", product: "orion", text: "The AI structures and explains; a deterministic engine computes the result. The model never picks the winner", status: "verified", evidence: "~/orion/README.md", checked: "2026-10-08" },
  { id: "orion.questions", product: "orion", text: "Asks at most three questions, and only ones that could change the answer", status: "verified", evidence: "~/orion/README.md", checked: "2026-10-08" },
  { id: "orion.honest_tie", product: "orion", text: "With no real signal it shows a tie with wide bands, not an invented number", status: "verified", evidence: "~/orion/README.md", checked: "2026-10-08" },
  { id: "orion.flip", product: "orion", text: "Shows what would have to be true for another option to win", status: "verified", evidence: "~/orion/src/decision-engine", checked: "2026-10-08" },
  { id: "orion.checkins", product: "orion", text: "Checks in after a choice to record how it turned out", status: "verified", evidence: "~/orion git log 2026-10-07", checked: "2026-10-08" },
  { id: "orion.friend_votes", product: "orion", text: "Friends can weigh in through a shared link", status: "verified", evidence: "~/orion/src/app/s/[id].tsx", checked: "2026-10-08" },
  { id: "orion.private", product: "orion", text: "Private mode saves nothing", status: "verified", evidence: "~/orion/README.md", checked: "2026-10-08" },
  { id: "orion.pricing", product: "orion", text: "Free core with unlimited decisions; Pro $4.99 a month or $29.99 a year; one-decision pass $4.99", status: "founder", evidence: "~/orion/src/billing/plans.ts", checked: "2026-10-08" },

  // JARVIS
  { id: "jarvis.pricing", product: "jarvis", text: "Argus Desktop $79 a year; Argus Server $50 per server a year; paid by card (Stripe) or mobile money (Paypack)", status: "founder", evidence: "docs/PRICE-BOOK.md; docs/OWNER-DECISIONS-2026-11-03.md; catalog/polar.json", checked: "2026-11-03" },
  { id: "jarvis.local", product: "jarvis", text: "Local-first: the dashboard listens only on your own machine and nothing leaves it by default", status: "verified", evidence: "~/jarvis/README.md", checked: "2026-10-08" },
  { id: "jarvis.no_deps", product: "jarvis", text: "The core is pure Python standard library: no third-party dependencies to trust", status: "verified", evidence: "~/jarvis/README.md", checked: "2026-10-08" },
  { id: "jarvis.commands", product: "jarvis", text: "37 audit commands, each answering a plain question", status: "verified", evidence: "~/jarvis/README.md (The commands)", checked: "2026-10-08" },
  { id: "jarvis.indicators", product: "jarvis", text: "Hunts across about 397,000 public threat indicators from 15 feeds", status: "verified", evidence: "~/jarvis/README.md", checked: "2026-10-08" },
  { id: "jarvis.coverage", product: "jarvis", text: "A live coverage map: 91 of 186 attacker techniques proven, 31 claimed, 64 blind, and it shows the blind ones", status: "verified", evidence: "~/jarvis/docs/architecture/COVERAGE-PLAN.md", checked: "2026-10-08" },
  { id: "jarvis.undo", product: "jarvis", text: "Automatic actions are limited to reversible containment, every action is in a ledger, and there is an undo", status: "verified", evidence: "~/jarvis/README.md", checked: "2026-10-08" },
  { id: "jarvis.platform", product: "jarvis", text: "Windows with WSL2 today", status: "verified", evidence: "~/jarvis/QUICKSTART.md", checked: "2026-10-08" },
  { id: "jarvis.tests", product: "jarvis", text: "2,163 automated tests", status: "founder", evidence: "~/jarvis/docs/guides/COVERAGE-MEDIA-RELEASE-2026-10-05.md", checked: "2026-10-08" },

  // Company
  { id: "company.rwanda", product: "company", text: "An open AI lab in Rwanda", status: "verified", evidence: "~/archymedes-site/lib/home-copy.ts", checked: "2026-10-08" },
];

export interface Forbidden {
  id: string;
  /** Case-insensitive regular expression, matched against prose. */
  pattern: string;
  /** Limit the rule to copy about one product; omit for every product. */
  product?: ProductId;
  reason: string;
  source: string;
  /** The overclaim itself contains a negation ("free, no key needed"), so negation must not excuse it. */
  negationIsTheClaim?: boolean;
}

export const FORBIDDEN: Forbidden[] = [
  // Security absolutes (JARVIS, and anything else)
  { id: "abs.100_secure", pattern: String.raw`\b(100\s*%|completely|fully|totally)\s+(secure|safe|protected)`, reason: "Never claim complete security.", source: "~/jarvis/docs/security/MAXIMUM-ASSURANCE.md:12" },
  { id: "abs.unhackable", pattern: String.raw`\b(unhackable|invulnerable|bulletproof|impenetrable)\b`, reason: "Never claim invulnerability.", source: "~/jarvis/docs/security/MAXIMUM-ASSURANCE.md:12" },
  { id: "abs.24_7", pattern: String.raw`\b(24\s*/\s*7|round[- ]the[- ]clock|always[- ]on)\b`, product: "jarvis", reason: "Continuous 24/7 monitoring is not proven; it samples on an interval.", source: "~/jarvis/README.md:1135" },
  { id: "abs.edr", pattern: String.raw`\b(replace[sd]?|replacement for)\b[^.]{0,40}\b(EDR|antivirus|endpoint security)`, product: "jarvis", reason: "Not a replacement for enterprise endpoint security.", source: "~/archymedes-site/lib/products.ts" },
  { id: "abs.kernel", pattern: String.raw`\bkernel[- ]level\b`, product: "jarvis", reason: "It is not a kernel-level EDR; the kernel sensor is a contract only.", source: "~/jarvis/jarvis-kernel/README.md" },
  { id: "abs.catches_all", pattern: String.raw`\b(catch(es)?|detect(s)?|stop(s)?|block(s)?)\s+(every|all)\s+(attack|threat|malware|intrusion)`, reason: "Coverage is partial and stated (91 of 186 proven).", source: "~/jarvis/docs/architecture/COVERAGE-PLAN.md" },
  { id: "abs.admin_proof", pattern: String.raw`\b(tamper[- ]proof|administrator[- ]proof|admin[- ]proof)\b`, reason: "Evidence is tamper-evident, not tamper-proof; admin or kernel compromise can falsify local observations.", source: "~/jarvis/README.md" },
  { id: "jarvis.one_click", pattern: String.raw`\b(one[- ]click|double[- ]click)\s+install`, product: "jarvis", reason: "No packaged installer yet; install is ./quickstart.sh from a checkout.", source: "~/jarvis/QUICKSTART.md" },
  { id: "jarvis.mac", pattern: String.raw`\b(mac\s?os|macbook|linux desktop)\b[^.]{0,30}\bsupport`, product: "jarvis", reason: "Windows with WSL2 only today.", source: "~/jarvis/QUICKSTART.md" },

  // CLI
  { id: "cli.cloud_live", pattern: String.raw`\b(archymedes cloud|hosted (routing|credits|billing)|routing receipts?)\b[^.]{0,40}\b(available|live|today|now)\b`, reason: "Cloud is pre-launch and not accepting payments.", source: "~/archymedes-cli/docs/marketing/landing-copy.md:87" },
  { id: "cli.free_no_key", pattern: String.raw`\bfree\b[^.]{0,25}\b(no|without (an?|any))\s+(api\s+)?key`, product: "cli", reason: "--free needs your own OpenRouter key or a self-hosted gateway.", source: "~/archymedes-cli/docs/marketing/landing-copy.md", negationIsTheClaim: true },
  { id: "cli.faster_than", pattern: String.raw`\b(faster|cheaper|better|more accurate)\s+than\s+(claude code|codex|cursor|cline|copilot|opencode|gemini)`, reason: "No benchmark comparison with other tools exists; journey timings use a scripted model.", source: "~/archymedes-cli/docs/RELEASE_ASSESSMENT.md" },
  { id: "cli.reliability_91", pattern: String.raw`\b91\s*/\s*100\b`, reason: "The 91/100 reliability report is dated and names a provider the build no longer ships.", source: "~/archymedes-site/docs/pitch-deck/technology-portfolio.md" },
  { id: "cli.circuitnotion", pattern: String.raw`\b(circuitnotion|circuit-2-turbo)\b`, reason: "Provider no longer shipped.", source: "~/archymedes-cli packages/archymedes-cli/README.md (stale)" },
  { id: "cli.ssrf", pattern: String.raw`\b(complete|full)\s+SSRF\s+protection`, reason: "DNS rebinding is still possible in web_fetch.", source: "~/archymedes-cli commit 94a2f07" },

  // Orion
  { id: "orion.advice", pattern: String.raw`\b(medical|legal|financial|investment)\s+advice\b(?![^.]{0,30}\b(not|seek|professional))`, product: "orion", reason: "Orion carries a professional-advice notice; it never gives such advice.", source: "~/archymedes-site/lib/products.ts" },
  { id: "orion.ai_decides", pattern: String.raw`\b(AI|the model)\s+(decides|chooses|picks)\s+for you`, product: "orion", reason: "The model never picks the winner and Orion never acts for you.", source: "~/orion/README.md" },
  { id: "orion.app_store", pattern: String.raw`\b(app[- ]store|google play|play store)\b`, product: "orion", reason: "Not in any app store; the web beta is what exists.", source: "~/orion/eas.json (empty profiles)" },
  { id: "orion.old_tiers", pattern: String.raw`\$\s?(9\.99|15)\b`, product: "orion", reason: "The $9.99 and $15 tiers in the deck do not exist in the product.", source: "~/orion/src/billing/plans.ts" },

  // Price book 2026-11-03 (docs/PRICE-BOOK.md): stale prices and the old processor
  { id: "jarvis.old_price_89", pattern: String.raw`\$\s?89\b`, product: "jarvis", reason: "The $89 founding licence is retired; see the price book.", source: "docs/PRICE-BOOK.md" },
  { id: "jarvis.old_monthly", pattern: String.raw`\$\s?(20|12)\s?(\/|per|a)\s?(mo|month)`, product: "jarvis", reason: "Argus has no monthly plan; Desktop is $79 a year and Server is $50 per server a year.", source: "docs/PRICE-BOOK.md" },
  { id: "jarvis.old_review", pattern: String.raw`\$\s?149\b|server review|argus watch\b|\$\s?9\s?(\/|per|a)\s?(mo|month)`, product: "jarvis", reason: "The $149 Server Review and $9/month Watch are retired; Server is $50 a year.", source: "docs/PRICE-BOOK.md" },
  { id: "orion.regional_299", pattern: String.raw`\$\s?2\.99`, product: "orion", reason: "No $2.99 ORION tier: Pro $4.99/month or $29.99/year, pass $4.99.", source: "docs/PRICE-BOOK.md; ~/orion/src/billing/plans.ts" },

  // Traction honesty (any product)
  { id: "traction.users", pattern: String.raw`\b(thousands|\d{1,3}(,\d{3})+|\d+k)\s+(of\s+)?(users|developers|customers)\b`, reason: "npm downloads are package events, not users; there is no user count to cite.", source: "~/archymedes-site/docs/pitch-deck/sources-and-evidence.md" },
  { id: "traction.trusted_by", pattern: String.raw`\b(trusted|used|loved)\s+by\b`, reason: "No named customers yet.", source: "~/archymedes-site/docs/pitch-deck/content-review.md" },
  { id: "traction.revenue", pattern: String.raw`\b(revenue|paying customers|ARR|MRR)\s+of\b`, reason: "Revenue figures must come from the ledger, not copy.", source: "this register" },
];

export const claimsFor = (product: ProductId) => CLAIMS.filter((c) => c.product === product || c.product === "company");
export const claim = (id: string): Claim => {
  const c = CLAIMS.find((x) => x.id === id);
  if (!c) throw new Error(`unknown claim ${id}`);
  return c;
};
