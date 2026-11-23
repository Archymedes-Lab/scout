import { valid } from "./session.ts";

/**
 * Who may see what. Scout holds real companies' contact emails, so a deployed copy refuses to serve until a password and
 * session secret are set, then every page and API call needs a signed session. Locally (engine on loopback) it is open.
 */
export type Gate = { kind: "allow" } | { kind: "unconfigured" } | { kind: "unauthorized" } | { kind: "login"; next: string };

const OPEN = ["/login", "/api/login", "/api/logout", "/manifest.webmanifest"];

export async function gate(pathname: string, cookie: string | undefined, env: { password?: string; secret?: string; deployed: boolean }, search = ""): Promise<Gate> {
  if (!env.password || !env.secret) return env.deployed ? { kind: "unconfigured" } : { kind: "allow" };
  if (OPEN.includes(pathname)) return { kind: "allow" };
  if (await valid(cookie, env.secret)) return { kind: "allow" };
  if (pathname.startsWith("/api/")) return { kind: "unauthorized" };
  return { kind: "login", next: `${pathname}${search}` };
}
