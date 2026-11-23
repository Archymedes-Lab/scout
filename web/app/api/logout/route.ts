import { COOKIE } from "@/lib/session";

/** Ends the session on this device and returns to the sign-in page. */
export async function GET(req: Request) {
  const headers = new Headers({ location: new URL("/login", req.url).toString() });
  headers.append("set-cookie", `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  return new Response(null, { status: 303, headers });
}
