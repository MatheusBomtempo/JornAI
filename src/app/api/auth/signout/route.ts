import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

// GET /auth/signout — clears the session cookie and goes to /login. Used by
// server pages when the cookie is signed but no longer valid (see
// requirePageUser in lib/auth.ts). Only removes our own cookie, so a
// cross-site link here can do no more than sign someone out.
export function GET(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/login", req.url));
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
