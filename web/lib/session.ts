/** Signed session cookie (WebCrypto, so it runs in the proxy and in route handlers). Same scheme as Sage and Capital Radar. */
export const COOKIE = "scout_session";
export const MAX_AGE_S = 60 * 60 * 24 * 30;
const enc = new TextEncoder();

async function hmac(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(msg)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export async function issue(secret: string, now = Date.now()): Promise<string> {
  const exp = String(now + MAX_AGE_S * 1000);
  return `${exp}.${await hmac(secret, `v1.${exp}`)}`;
}

export async function valid(token: string | undefined, secret: string, now = Date.now()): Promise<boolean> {
  if (!token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) < now) return false;
  return safeEqual(sig, await hmac(secret, `v1.${exp}`));
}

/** Only same-site paths: blocks "//evil.com" and absolute-URL open redirects. */
export function safeNext(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}
