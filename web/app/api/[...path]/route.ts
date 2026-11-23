// Every /api/* call is forwarded to Scout's engine (src/server.ts, loopback :7440). Keys, the database, Orion and cdm stay
// in the engine; the browser only ever talks to this origin. Deployed (SCOUT_SNAPSHOT=1) there is no engine: the same
// views are served read-only from data/snapshot.json (`bun run snapshot`).
import { readFileSync } from "node:fs";
import path from "node:path";
import { serveSnapshot, type Snapshot } from "@/lib/snapshot";

const ENGINE = process.env.SCOUT_ENGINE_URL ?? "http://127.0.0.1:7440";
let snapshot: Snapshot | null = null;
const loadSnapshot = () => (snapshot ??= JSON.parse(readFileSync(path.join(process.cwd(), "data", "snapshot.json"), "utf8")) as Snapshot);

async function route(req: Request, ctx: RouteContext<"/api/[...path]">) {
  const { path: parts } = await ctx.params;
  const search = new URL(req.url).search;
  if (process.env.SCOUT_SNAPSHOT === "1") return serveSnapshot(loadSnapshot(), req.method, `/${parts.join("/")}`, search);
  const target = `${ENGINE}/api/${parts.map(encodeURIComponent).join("/")}${search}`;
  try {
    const res = await fetch(target, {
      method: req.method,
      headers: { "content-type": req.headers.get("content-type") ?? "application/json" },
      body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.text(),
      cache: "no-store",
    });
    return new Response(res.body, { status: res.status, headers: { "content-type": res.headers.get("content-type") ?? "application/json", ...(res.headers.get("content-disposition") ? { "content-disposition": res.headers.get("content-disposition")! } : {}) } });
  } catch {
    return Response.json({ error: "Scout's engine is not running. Start it with `bun run engine` in ~/sales.", engineDown: true }, { status: 502 });
  }
}

export const GET = route;
export const POST = route;
