import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getCurrentAppUser } from "@/lib/supabase/server";
import { hasPermission, isFrontRole, PERMISSIONS, type PermissionCode, type RoleName } from "@/lib/rbac";
import { Button } from "@/components/ui";
import { APP_NAME, APP_NAME_SHORT, APP_TAGLINE, APP_LOGO_URL } from "@/lib/appConfig";

export const metadata: Metadata = {
  title: APP_NAME,
  description:
    "Scoring de projets de promotion immobilière, classification et provisionnement BKAM (19/G/2002, 1/W/2025).",
};

interface NavItem {
  href: string;
  label: string;
  perm: PermissionCode;
  /** Masqué pour les profils front (réseau) quand true — écrans d'analyse risque. */
  riskOnly?: boolean;
}

const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "Activité",
    items: [
      { href: "/", label: "Tableau de bord", perm: PERMISSIONS.PROJECT_READ },
      { href: "/queue", label: "Mes dossiers", perm: PERMISSIONS.PROJECT_READ },
      { href: "/projects", label: "Projets", perm: PERMISSIONS.PROJECT_READ },
      { href: "/promoters", label: "Promoteurs", perm: PERMISSIONS.PROJECT_READ },
      { href: "/groups", label: "Groupes", perm: PERMISSIONS.PROJECT_READ },
    ],
  },
  {
    title: "Analyse risque",
    items: [
      { href: "/risk", label: "Vue risque", perm: PERMISSIONS.PROJECT_READ, riskOnly: true },
      { href: "/migration", label: "Migration notes", perm: PERMISSIONS.PROJECT_READ, riskOnly: true },
      { href: "/stress", label: "Stress test", perm: PERMISSIONS.PROJECT_READ, riskOnly: true },
      { href: "/admin/calibration", label: "Calibrage risque", perm: PERMISSIONS.MODEL_READ },
    ],
  },
  {
    title: "Paramétrage",
    items: [
      { href: "/admin/model", label: "Modèle de scoring", perm: PERMISSIONS.MODEL_READ },
      { href: "/admin/regimes", label: "Régimes BKAM", perm: PERMISSIONS.REGIME_READ },
    ],
  },
  {
    title: "Outils",
    items: [
      { href: "/imports", label: "Imports", perm: PERMISSIONS.IMPORT_RUN },
      { href: "/audit", label: "Audit", perm: PERMISSIONS.AUDIT_READ },
    ],
  },
];

/** Items visibles pour un rôle : permission requise + filtrage front/risque. */
function visibleSections(role: RoleName) {
  const front = isFrontRole(role);
  return NAV_SECTIONS.map((s) => ({
    title: s.title,
    items: s.items.filter((n) => hasPermission(role, n.perm) && !(front && n.riskOnly)),
  })).filter((s) => s.items.length > 0);
}

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
            <div className="p-4 border-b border-border flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={APP_LOGO_URL} alt={APP_NAME} className="h-9 w-9 rounded-md object-contain shrink-0" />
              <div className="min-w-0">
                <div className="font-bold text-sm leading-tight">{APP_NAME_SHORT}</div>
                <div className="text-xs text-muted-foreground">{APP_TAGLINE}</div>
              </div>
            </div>
            <nav className="flex-1 p-2 space-y-3 overflow-y-auto">
              {visibleSections(user.role.name as RoleName).map((s) => (
                <div key={s.title} className="space-y-1">
                  <div className="px-3 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                    {s.title}
                  </div>
                  {s.items.map((n) => (
                    <Link
                      key={n.href}
                      href={n.href}
                      className="block rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      {n.label}
                    </Link>
                  ))}
                </div>
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
