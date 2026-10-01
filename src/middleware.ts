import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "./lib/session";
import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, isLocale } from "./lib/i18n/config";
import { localeFromAcceptLanguage, localeFromCountry, localeFromEnv } from "./lib/i18n/detect";

/**
 * Protects the app pages: no session -> /login; with a session -> cannot go
 * back to /login. API routes handle their own auth (requireUser).
 */
const PUBLIC_PATHS = ["/login"];
/** Open to everyone, with or without a session (no redirects at all). */
const OPEN_PATHS = ["/about"];
const ONBOARDING_PATH = "/onboarding";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);

  // "/" is the public landing page; anyone with a session is still sent
  // straight to the dashboard (same as the `isPublic` + session branch below).
  const isPublic = pathname === "/" || PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const isOnboarding = pathname.startsWith(ONBOARDING_PATH);
  // `undefined` = cookie signed before this field existed (old session);
  // treated as "has a company" until the person logs in again — only `null`
  // (explicit claim, new session) forces onboarding. Avoids logging out or
  // locking anyone who already had a valid session when this field was
  // introduced.
  const missingCompany = session?.companyId === null;

  const isOpen = OPEN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  let response: NextResponse;

  if (isOpen) {
    response = NextResponse.next();
  } else if (!session && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    response = NextResponse.redirect(url);
  } else if (session && isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = missingCompany ? ONBOARDING_PATH : "/dashboard";
    url.search = "";
    response = NextResponse.redirect(url);
  } else if (session && missingCompany && !isOnboarding) {
    // First login of an admin with no company yet: only onboarding is reachable.
    const url = req.nextUrl.clone();
    url.pathname = ONBOARDING_PATH;
    url.search = "";
    response = NextResponse.redirect(url);
  } else if (session && !missingCompany && isOnboarding) {
    // Already has a company — onboarding no longer makes sense.
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    response = NextResponse.redirect(url);
  } else {
    response = NextResponse.next();
  }

  // Interface language: only decided on the 1st visit (no cookie yet) —
  // after that, the stored value (detected or picked by hand) rules. An
  // explicit APP_LANGUAGE comes first; then Vercel geo (only exists on
  // deployments); Accept-Language covers localhost; with no signal at all it
  // falls back to English (see DEFAULT_LOCALE).
  if (!isLocale(req.cookies.get(LOCALE_COOKIE)?.value)) {
    const locale =
      localeFromEnv() ??
      localeFromCountry(req.headers.get("x-vercel-ip-country")) ??
      localeFromAcceptLanguage(req.headers.get("accept-language")) ??
      DEFAULT_LOCALE;
    response.cookies.set(LOCALE_COOKIE, locale, {
      path: "/",
      maxAge: LOCALE_COOKIE_MAX_AGE,
      sameSite: "lax",
    });
  }

  return response;
}

export const config = {
  // Applies to everything except static assets, uploads and the API routes.
  matcher: ["/((?!api|_next/static|_next/image|uploads|favicon.ico|.*\\.png$).*)"],
};
