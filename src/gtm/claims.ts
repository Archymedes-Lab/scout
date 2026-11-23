// Claim guard: finds statements the claim register forbids. Used on every rendered page, on
// generated drafts before they can be approved, and from the CLI on any file (`gtm lint`).
//
// A match is ignored when the same sentence negates it shortly before, or inside the matched span
// ("Not a replacement for endpoint security", "Cloud is not live yet" are honest boundaries, not
// claims), because boundaries are copy we want.
import { FORBIDDEN, type Forbidden, type ProductId } from "./claims-catalog.ts";

export interface Violation { rule: string; match: string; reason: string; source: string; line: number }

const NEGATION = /\b(not|no|never|isn't|is not|nor|without|cannot|can't|don't|doesn't)\b/i;
const compiled = FORBIDDEN.map((f) => ({ f, re: new RegExp(f.pattern, "gi") }));

/** Text before `index` back to the start of its sentence (or line), capped at 60 characters. */
function sentencePrefix(text: string, index: number): string {
  const start = Math.max(text.lastIndexOf(".", index - 1), text.lastIndexOf("\n", index - 1), text.lastIndexOf(";", index - 1), index - 60);
  return text.slice(start + 1, index);
}

export function lint(text: string, product?: ProductId): Violation[] {
  const out: Violation[] = [];
  for (const { f, re } of compiled) {
    if (f.product && product && f.product !== product) continue;
    re.lastIndex = 0;
    for (let m = re.exec(text); m; m = re.exec(text)) {
      if (!f.negationIsTheClaim && (NEGATION.test(sentencePrefix(text, m.index)) || NEGATION.test(m[0]))) continue;
      out.push(violation(f, m[0], text, m.index));
    }
  }
  return out.sort((a, b) => a.line - b.line);
}

const violation = (f: Forbidden, match: string, text: string, index: number): Violation => ({
  rule: f.id,
  match,
  reason: f.reason,
  source: f.source,
  line: text.slice(0, index).split("\n").length,
});

export function assertClean(text: string, product?: ProductId, where = "copy"): void {
  const v = lint(text, product);
  if (v.length) throw new Error(`${where} breaks the claim register:\n${v.map((x) => `  line ${x.line}: "${x.match}" [${x.rule}] ${x.reason}`).join("\n")}`);
}
