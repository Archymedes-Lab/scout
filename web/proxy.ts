import { NextResponse, type NextRequest } from "next/server";
import { gate } from "@/lib/gate";
import { COOKIE } from "@/lib/session";

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const g = await gate(pathname, req.cookies.get(COOKIE)?.value, {
    password: process.env.SCOUT_PASSWORD, secret: process.env.SCOUT_SESSION_SECRET, deployed: !!process.env.VERCEL,
  }, search);
  if (g.kind === "allow") return NextResponse.next();
  if (g.kind === "unconfigured") return new NextResponse("Scout is not configured: set SCOUT_PASSWORD and SCOUT_SESSION_SECRET.", { status: 503 });
  if (g.kind === "unauthorized") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = g.next === "/" ? "" : `?next=${encodeURIComponent(g.next)}`;
  return NextResponse.redirect(url);
}

export const config = { matcher: "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:jpg|png|svg|ico|webmanifest)$).*)" };
