import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import "./globals.css";
import { getCurrentAppUser } from "@/lib/supabase/server";
import { hasPermission, isFrontRole, PERMISSIONS, type PermissionCode, type RoleName } from "@/lib/rbac";
import { AppNav, type IconName } from "@/components/AppNav";
import { APP_NAME, APP_NAME_SHORT, APP_TAGLINE, APP_LOGO_URL } from "@/lib/appConfig";
import { THEME_COOKIE, parseThemePreference, themeAttribute } from "@/lib/theme";

export const metadata: Metadata = {
  title: APP_NAME,
  description:
    "Scoring de projets de promotion immobilière, classification et provisionnement BKAM (19/G/2002, 1/W/2025).",
};

interface NavItem {
  href: string;
  label: string;
  perm: PermissionCode;
  icon: IconName;
  /** Masqué pour les profils front (réseau) quand true — écrans d'analyse risque. */
  riskOnly?: boolean;
}

const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "Activité",
    items: [
      { href: "/", label: "Tableau de bord", perm: PERMISSIONS.PROJECT_READ, icon: "home" },
      { href: "/queue", label: "Mes dossiers", perm: PERMISSIONS.PROJECT_READ, icon: "inbox" },
      { href: "/alerts", label: "Alertes & échéances", perm: PERMISSIONS.PROJECT_READ, icon: "bell" },
      { href: "/projects", label: "Projets", perm: PERMISSIONS.PROJECT_READ, icon: "folder" },
      { href: "/promoters", label: "Promoteurs", perm: PERMISSIONS.PROJECT_READ, icon: "building" },
      { href: "/groups", label: "Groupes", perm: PERMISSIONS.PROJECT_READ, icon: "users" },
    ],
  },
  {
    title: "Analyse risque",
    items: [
      { href: "/risk", label: "Vue risque", perm: PERMISSIONS.PROJECT_READ, riskOnly: true, icon: "shield" },
      { href: "/migration", label: "Migration des notes", perm: PERMISSIONS.PROJECT_READ, riskOnly: true, icon: "trend" },
      { href: "/stress", label: "Stress test", perm: PERMISSIONS.PROJECT_READ, riskOnly: true, icon: "bolt" },
      { href: "/admin/calibration", label: "Calibrage risque", perm: PERMISSIONS.MODEL_READ, icon: "gauge" },
    ],
  },
  {
    title: "Paramétrage",
    items: [
      { href: "/admin/model", label: "Modèle de scoring", perm: PERMISSIONS.MODEL_READ, icon: "sliders" },
      { href: "/admin/regimes", label: "Régimes BKAM", perm: PERMISSIONS.REGIME_READ, icon: "scale" },
      { href: "/admin/referentiels", label: "Référentiels métier", perm: PERMISSIONS.MODEL_READ, icon: "book" },
    ],
  },
  {
    title: "Outils",
    items: [
      { href: "/imports", label: "Imports", perm: PERMISSIONS.IMPORT_RUN, icon: "upload" },
      { href: "/audit", label: "Audit", perm: PERMISSIONS.AUDIT_READ, icon: "history" },
    ],
  },
];

/** Items visibles pour un rôle : permission requise + filtrage front/risque. */
function visibleSections(role: RoleName) {
  const front = isFrontRole(role);
  return NAV_SECTIONS.map((s) => ({
    title: s.title,
    items: s.items
      .filter((n) => hasPermission(role, n.perm) && !(front && n.riskOnly))
      .map(({ href, label, icon }) => ({ href, label, icon })),
  })).filter((s) => s.items.length > 0);
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // L'authentification est garantie par le middleware ; on récupère l'acteur
  // applicatif pour afficher son identité et la déconnexion. Hors session
  // (page /login), on rend un shell minimal sans navigation.
  const user = await getCurrentAppUser();
  // Thème choisi (cookie) rendu côté serveur ; sans choix, le CSS suit le système.
  const theme = parseThemePreference((await cookies()).get(THEME_COOKIE)?.value);

  if (!user) {
    return (
      <html lang="fr" data-theme={themeAttribute(theme)}>
        <body>{children}</body>
      </html>
    );
  }

  const brand = (
    <div className="flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={APP_LOGO_URL} alt="" className="h-9 w-9 rounded-md object-contain shrink-0" />
      <div className="min-w-0">
        <div className="font-bold text-sm leading-tight">{APP_NAME_SHORT}</div>
        <div className="text-xs text-muted-foreground">{APP_TAGLINE}</div>
      </div>
    </div>
  );
  const brandCompact = (
    <div className="flex items-center gap-2 min-w-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={APP_LOGO_URL} alt="" className="h-7 w-7 rounded object-contain shrink-0" />
      <span className="font-semibold text-sm truncate">{APP_NAME_SHORT}</span>
    </div>
  );

  return (
    <html lang="fr" data-theme={themeAttribute(theme)}>
      <body>
        <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:shadow">
          Aller au contenu
        </a>
        <div className="min-h-screen md:flex">
          <AppNav
            sections={visibleSections(user.role.name as RoleName)}
            user={{ name: user.name, email: user.email, role: user.role.label, theme }}
            brand={brand}
            brandCompact={brandCompact}
          />
          <main id="contenu" tabIndex={-1} className="flex-1 min-w-0 focus:outline-none">
            <div className="max-w-7xl mx-auto px-4 py-5 sm:p-6">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
