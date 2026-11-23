import type { Api } from "./api.ts";

/** Loopback only: the API lists people and the pages we found them on. The web app (web/) proxies /api/* here. */
export function createServer(api: Api, port = Number(process.env.SCOUT_ENGINE_PORT ?? 7440)) {
  return Bun.serve({
    hostname: "127.0.0.1",
    port,
    idleTimeout: 120,
    fetch(req) {
      const { pathname } = new URL(req.url);
      if (pathname.startsWith("/api/")) return api(req, pathname.slice(4));
      return Response.json({ error: "Not found" }, { status: 404 });
    },
  });
}
