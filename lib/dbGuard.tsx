import { Card, CardContent } from "@/components/ui";

/** Encadré affiché lorsque la base n'est pas joignable (setup non terminé). */
export function DbSetupNotice({ error }: { error?: unknown }) {
  const msg = error instanceof Error ? error.message : String(error ?? "");
  return (
    <Card>
      <CardContent>
        <h2 className="font-semibold text-lg">Base de données non configurée</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Cette page nécessite une base PostgreSQL/Supabase. Configurez{" "}
          <code className="bg-muted px-1 rounded">DATABASE_URL</code> puis exécutez :
        </p>
        <pre className="mt-3 bg-muted rounded p-3 text-xs overflow-x-auto">
{`cp .env.example .env   # renseigner DATABASE_URL / DIRECT_URL
npm run prisma:push    # créer le schéma
npm run seed           # données de référence + démo
npm run dev`}
        </pre>
        {msg && <p className="text-xs text-red-600 mt-2 break-all">{msg}</p>}
      </CardContent>
    </Card>
  );
}

/** Encadré affiché lorsqu'un acteur n'a pas la permission requise. */
export function AccessDenied({ hint }: { hint?: string }) {
  return (
    <Card>
      <CardContent>
        <h2 className="font-semibold text-lg">Accès refusé</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Votre rôle ne dispose pas des droits nécessaires pour consulter cette page.
        </p>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

/** Exécute une lecture serveur en capturant l'absence de base. */
export async function safe<T>(fn: () => Promise<T>): Promise<{ ok: true; data: T } | { ok: false; error: unknown }> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    return { ok: false, error };
  }
}
