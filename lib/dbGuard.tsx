import { Card, CardContent } from "@/components/ui";

/** Diagnostic ciblé selon le message d'erreur Prisma (cause la plus fréquente d'abord). */
function dbErrorHint(msg: string): string | null {
  if (/does not exist in the current database/i.test(msg) && /public\./i.test(msg)) {
    return (
      "Cause probable : le paramètre `?schema=pi_scoring` manque dans DATABASE_URL " +
      "(Prisma cherche les tables dans `public` au lieu de `pi_scoring`). " +
      "Ajoutez `schema=pi_scoring` à la query string de DATABASE_URL et DIRECT_URL, puis redéployez."
    );
  }
  if (/authentication failed|credentials/i.test(msg)) {
    return (
      "Cause probable : mot de passe incorrect dans DATABASE_URL. " +
      "Réinitialisez le mot de passe base (Supabase → Project Settings → Database) " +
      "et mettez à jour DATABASE_URL/DIRECT_URL sur l'hébergeur, puis redéployez."
    );
  }
  if (/can't reach database server|connect(ion)? (refused|timed? ?out)/i.test(msg)) {
    return (
      "Cause probable : hôte/port injoignable depuis l'hébergeur. " +
      "Vérifiez l'hôte du pooler Supabase (port 6543 avec `pgbouncer=true`) et que " +
      "l'hébergeur autorise les connexions sortantes PostgreSQL."
    );
  }
  if (/environment variable not found|DATABASE_URL/i.test(msg)) {
    return "Cause probable : la variable DATABASE_URL n'est pas définie sur l'hébergeur (environnement d'exécution).";
  }
  return null;
}

/** Encadré affiché lorsque la base n'est pas joignable (setup non terminé). */
export function DbSetupNotice({ error }: { error?: unknown }) {
  const msg = error instanceof Error ? error.message : String(error ?? "");
  const hint = msg ? dbErrorHint(msg) : null;
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
        {hint && (
          <p className="text-sm mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-amber-900">
            {hint}
          </p>
        )}
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
