import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, localePath, splitLocalePath } from "@/i18n/config";

/** Areas outside the customer site: no language prefix. */
const nonCustomer = /^\/(vendor|admin|auth|api)(\/|$)/;
const dashboards = /^\/(vendor|admin)(\/|$)/;

/** Customer pages that need a signed-in user (path without its language). */
// TODO(phase-4): add checkout and my-bookings routes.
const signedInOnly = /^\/account(\/|$)/;

/**
 * Two jobs:
 * 1. Customer site languages. English has no prefix, so "/account" is served
 *    from app/(customer)/[locale] as "/en/account"; "/en/…" redirects to the
 *    unprefixed URL so each page has one English address.
 * 2. Refreshes the Supabase session cookie before signed-in pages render, and
 *    sends signed-out visitors to sign in. This is only an optimistic check:
 *    the layouts verify access again (lib/auth/session.ts).
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (nonCustomer.test(pathname)) {
    if (!dashboards.test(pathname)) return NextResponse.next();
    return withSession(request, () => NextResponse.next({ request }), "/login");
  }

  const prefixed = pathname.split("/")[1] === defaultLocale;
  const { locale, path } = splitLocalePath(pathname);
  if (prefixed) {
    const url = request.nextUrl.clone();
    url.pathname = path;
    return NextResponse.redirect(url, 308);
  }

  const respond =
    locale === defaultLocale
      ? () => {
          const url = request.nextUrl.clone();
          url.pathname = `/${defaultLocale}${path === "/" ? "" : path}`;
          url.search = search;
          return NextResponse.rewrite(url, { request });
        }
      : () => NextResponse.next({ request });

  if (!signedInOnly.test(path)) return respond();
  return withSession(request, respond, localePath(locale, "/login"));
}

async function withSession(
  request: NextRequest,
  respond: () => NextResponse,
  loginPath: string,
) {
  let response = respond();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet)
            request.cookies.set(name, value);
          response = respond();
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          for (const [key, value] of Object.entries(headers ?? {})) {
            response.headers.set(key, value);
          }
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    const login = request.nextUrl.clone();
    login.pathname = loginPath;
    login.search = "";
    login.searchParams.set(
      "next",
      request.nextUrl.pathname + request.nextUrl.search,
    );
    return NextResponse.redirect(login);
  }

  return response;
}

// Everything but Next.js internals and files with an extension. Public
// customer pages only get the language rewrite and stay static.
export const config = {
  matcher: ["/((?!_next/|.*\\.[^/]+$).*)"],
};
