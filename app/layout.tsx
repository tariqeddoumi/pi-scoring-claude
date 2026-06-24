import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getCurrentAppUser } from "@/lib/supabase/server";
import { hasPermission, PERMISSIONS, type PermissionCode, type RoleName } from "@/lib/rbac";
import { Button } from "@/components/ui";

export const metadata: Metadata = {
  title: "PI Scoring BKAM — Promotion Immobilière",
  description:
    "Scoring de projets de promotion immobilière, classification et provisionnement BKAM (19/G/2002, 1/W/2025).",
};

const NAV: { href: string; label: string; perm: PermissionCode }[] = [
  { href: "/", label: "Tableau de bord", perm: PERMISSIONS.PROJECT_READ },
  { href: "/risk", label: "Vue risque", perm: PERMISSIONS.PROJECT_READ },
  { href: "/migration", label: "Migration notes", perm: PERMISSIONS.PROJECT_READ },
  { href: "/projects", label: "Projets", perm: PERMISSIONS.PROJECT_READ },
  { href: "/groups", label: "Groupes", perm: PERMISSIONS.PROJECT_READ },
  { href: "/queue", label: "Mes dossiers", perm: PERMISSIONS.PROJECT_READ },
  { href: "/admin/model", label: "Modèle (Admin)", perm: PERMISSIONS.MODEL_READ },
  { href: "/admin/regimes", label: "Régimes BKAM", perm: PERMISSIONS.REGIME_READ },
  { href: "/imports", label: "Imports", perm: PERMISSIONS.IMPORT_RUN },
  { href: "/audit", label: "Audit", perm: PERMISSIONS.AUDIT_READ },
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // L'authentification est garantie par le middleware ; on récupère l'acteur
  // applicatif pour afficher son identité et la déconnexion. Hors session
  // (page /login), on rend un shell minimal sans navigation.
  const user = await getCurrentAppUser();

  if (!user) {
    return (
      <html lang="fr">
        <body>{children}</body>
      </html>
    );
  }

  return (
    <html lang="fr">
      <body>
        <div className="min-h-screen flex">
          <aside className="w-60 shrink-0 border-r border-border bg-background hidden md:flex md:flex-col">
            <div className="p-4 border-b border-border">
              <div className="font-bold text-lg leading-tight">PI Scoring</div>
              <div className="text-xs text-muted-foreground">BKAM 19/G · 1/W/2025</div>
            </div>
            <nav className="flex-1 p-2 space-y-1">
              {NAV.filter((n) => hasPermission(user.role.name as RoleName, n.perm)).map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="block rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
            <div className="p-4 border-t border-border space-y-2">
              <div className="text-sm font-medium leading-tight">{user.name}</div>
              <div className="text-xs text-muted-foreground">
                {user.email} · {user.role.label}
              </div>
              <form action="/auth/signout" method="post">
                <Button type="submit" variant="outline" className="w-full">
                  Se déconnecter
                </Button>
              </form>
            </div>
          </aside>
          <main className="flex-1 min-w-0">
            <div className="max-w-7xl mx-auto p-6">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
