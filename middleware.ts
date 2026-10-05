import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { TEST_USER_COOKIE, testAuthEmail } from "@/lib/testAuth";

// Routes accessibles sans session. Les tâches planifiées (/api/cron) ont leur
// propre contrôle d'accès (CRON_SECRET, cf. lib/cronAuth.ts).
const PUBLIC_PREFIXES = ["/login", "/auth", "/api/cron"];

// Garde d'authentification globale (deny‑by‑default) : toute route non publique
// exige une session Supabase valide, sinon redirection vers /login.
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Identité de test (hors production uniquement, cf. lib/testAuth.ts).
  if (testAuthEmail(request.cookies.get(TEST_USER_COOKIE)?.value)) {
    if (pathname !== "/login") return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const { supabaseResponse, user } = await updateSession(request);

  const isPublic = PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(url);
  }

  // Utilisateur connecté arrivant sur /login → renvoyé vers l'accueil.
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  // Exclut les assets statiques et les fichiers images du contrôle.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
