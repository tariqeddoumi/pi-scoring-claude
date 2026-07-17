import Link from "next/link";

// Sous-navigation commune aux trois vues d'un dossier : Fiche | Scoring | Suivi.
// Rend la circulation évidente pour les centres d'affaires (un dossier = trois
// onglets, toujours au même endroit).

const TABS = [
  { key: "fiche", label: "Fiche du dossier", path: "" },
  { key: "scoring", label: "Saisie & scoring", path: "/scoring" },
  { key: "suivi", label: "Suivi & événements", path: "/suivi" },
] as const;

export type ProjectTabKey = (typeof TABS)[number]["key"];

export function ProjectSubnav({ projectId, active }: { projectId: string; active: ProjectTabKey }) {
  return (
    <div className="flex gap-1 border-b border-border">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={`/projects/${projectId}${t.path}`}
          className={`px-4 py-2 text-sm font-medium rounded-t-md border border-b-0 ${
            active === t.key
              ? "bg-background border-border text-foreground -mb-px"
              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
