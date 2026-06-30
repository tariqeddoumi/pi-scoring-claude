import { NextResponse, type NextRequest } from "next/server";
import { createClient, getCurrentAppUser } from "@/lib/supabase/server";
import { securityEvent } from "@/lib/securityLog";

// Déconnexion : invalide la session Supabase (efface les cookies) puis
// redirige vers la page de connexion. Déclenchée par un POST (formulaire).
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentAppUser();
    if (user) {
      securityEvent("logout", { actorId: user.id, email: user.email, role: user.role.name });
    }
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // Auth non configurée : on redirige quand même vers /login.
  }
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
