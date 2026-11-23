import { CLAIMS } from "./gtm/claims-catalog.ts";
import type { Segment } from "./types.ts";

/**
 * What Scout knows about Argus. Facts are read from archymedes-gtm's claim register (verified only), so a claim
 * retired there disappears here. Argus is the product the register still calls "jarvis".
 */
export function argusFacts(): string[] {
  return CLAIMS.filter((c) => c.product === "jarvis" && c.status === "verified").map((c) => c.text);
}

/** From ~/archymedes-site/lib/products.ts and the GTM price book (18 Oct 2026). */
export const BOUNDARIES = [
  "Not a replacement for enterprise endpoint security.",
  "No macOS edition yet.",
  "Someone with full administrator or kernel control can falsify what any local tool sees; Argus says so.",
  "Not open source (only Friday is).",
];
export const PRICE = "$79 per seat per year (or $20/month); founding licence and paid setup audits lead.";

/** Who Argus is for. Queries are phrased as the page we want Exa to return. */
export const SEGMENTS: Segment[] = [
  { id: "agent_incident", audience: "both", label: "Developers hit by an agent doing something unsafe",
    query: "my AI coding agent ran a destructive command on my machine and I want to know what it touched",
    angle: "Argus shows what runs because you opened an editor, a repo or a shell, which is where an agent works, and keeps every automatic action reversible." },
  { id: "supply_chain", audience: "both", label: "Developers worried about malicious packages on their machine",
    query: "malicious npm package postinstall script stole credentials from a developer laptop",
    angle: "Argus answers plain questions about your own machine, like which credentials sit in plain text and what starts on its own, without sending anything off it." },
  { id: "agencies", audience: "paying", label: "Software agencies shipping with AI coding agents",
    query: "software development agency that builds client projects with AI coding agents like Claude Code and Cursor",
    angle: "Agencies run coding agents on machines that hold client code; Argus is a local check on what those machines are running, with evidence you can show a client." },
  { id: "wsl", audience: "free", label: "Windows and WSL2 developers running agents",
    query: "running Claude Code or Codex inside WSL2 on Windows security concerns",
    angle: "Argus audits both the Windows host and WSL2 side and names its own blind spots instead of hiding them." },
  { id: "linux_servers", audience: "both", label: "Teams running agents on their own Linux servers",
    query: "self-hosted Linux server running autonomous AI agents how to audit what they changed",
    angle: "Argus's server edition runs as an unprivileged account and audits SSH keys, sudo rules, systemd units and cron." },
  { id: "fintech", audience: "paying", label: "Fintech engineering teams setting AI agent policy",
    query: "fintech startup engineering team policy for AI coding agents on developer machines",
    angle: "Argus keeps a local ledger of what it observed and did, which gives a security review something concrete to look at." },
  // Paying: teams with a budget and several machines to cover.
  { id: "msp", audience: "paying", label: "IT providers managing developer machines",
    query: "managed IT service provider for software companies that secures developer workstations",
    angle: "Argus gives a provider a local, evidence-first audit of each developer machine, including what AI agents run on it." },
  { id: "security_review", audience: "paying", label: "Startups facing a security review with agents in use",
    query: "startup preparing for a SOC 2 audit asking how to handle engineers using AI coding agents",
    angle: "Argus keeps a ledger of what it observed and did on each machine, which gives an auditor something concrete to look at." },
  { id: "platform_teams", audience: "paying", label: "Platform teams rolling out coding agents",
    query: "engineering team rolled out Claude Code or Codex to all developers and is setting guardrails",
    angle: "Argus shows what runs on each developer machine because an agent opened a repo or a shell, with an undo for anything it does." },
  // Free: individuals who would use the core audits and spread the word.
  { id: "learners", audience: "free", label: "Students and new developers using coding agents",
    query: "student learning to code with Claude Code asking whether it is safe to let it run commands",
    angle: "Argus answers plain questions about your own machine, like what starts on its own, and nothing leaves the machine by default." },
  { id: "maintainers", audience: "free", label: "Open-source maintainers worried about their machines",
    query: "open source maintainer worried their laptop could be compromised through a malicious dependency",
    angle: "Argus answers plain questions about your own machine, like which credentials sit in plain text, without sending anything off it." },
];

const clip = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, Math.max(0, n - 1))}…`);

/** The context Jev sees about Argus, within a character budget. */
export function briefText(max = 2400): string {
  const text = [
    "PRODUCT: Argus (formerly JARVIS), by Archymedes, a four-person AI lab in Kigali. A local security guardian for machines that run AI coding agents.",
    `PRICE: ${PRICE}`,
    `FACTS:\n${argusFacts().map((f) => `- ${f}`).join("\n")}`,
    `BOUNDARIES:\n${BOUNDARIES.map((b) => `- ${b}`).join("\n")}`,
  ].join("\n");
  return clip(text, max);
}
