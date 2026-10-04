"use client";

// Erreur inattendue d'une page : message clair, nouvel essai, retour à l'accueil.
// Le détail technique n'est pas affiché (référence seulement).
import Link from "next/link";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="mx-auto max-w-lg rounded-lg border border-border bg-background p-8 text-center shadow-sm">
      <h1 className="text-xl font-semibold">Cette page n&apos;a pas pu s&apos;afficher</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Réessayez dans un instant. Si le problème persiste, transmettez la référence ci-dessous à l&apos;administrateur.
      </p>
      {error.digest && <p className="mt-3 font-mono text-xs text-muted-foreground">Référence : {error.digest}</p>}
      <div className="mt-6 flex justify-center gap-2">
        <button onClick={reset} className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">Réessayer</button>
        <Link href="/" className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted">Tableau de bord</Link>
      </div>
    </div>
  );
}
