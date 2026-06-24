import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Déconnexion : invalide la session Supabase (efface les cookies) puis
// redirige vers la page de connexion. Déclenchée par un POST (formulaire).
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    await supabase.auth.signOut();
  } catch {
    // Auth non configurée : on redirige quand même vers /login.
  }
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
