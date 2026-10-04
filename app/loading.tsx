// Squelette affiché pendant le chargement d'une page (rendu serveur).
export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-live="polite">
      <span className="sr-only">Chargement…</span>
      <div className="h-8 w-72 rounded-md bg-border" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 rounded-lg bg-background border border-border" />)}
      </div>
      <div className="h-80 rounded-lg bg-background border border-border" />
    </div>
  );
}
