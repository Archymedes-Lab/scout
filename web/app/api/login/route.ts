import { COOKIE, issue, MAX_AGE_S, safeEqual, safeNext } from "@/lib/session";

export async function POST(req: Request) {
  const form = await req.formData();
  const password = process.env.SCOUT_PASSWORD;
  const secret = process.env.SCOUT_SESSION_SECRET;
  const next = safeNext(String(form.get("next") ?? "/"));
  if (!password || !secret) return Response.redirect(new URL(next, req.url), 303);
  if (!safeEqual(String(form.get("password") ?? ""), password)) return Response.redirect(new URL(`/login?error=1&next=${encodeURIComponent(next)}`, req.url), 303);
  const headers = new Headers({ location: next });
  headers.append("set-cookie", `${COOKIE}=${await issue(secret)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_S}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
  return new Response(null, { status: 303, headers });
}
