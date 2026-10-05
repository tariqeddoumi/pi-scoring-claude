// Style commun des champs de formulaire (module neutre : utilisable par les
// composants serveur comme client). components/form.tsx s'appuie dessus.

/** Champ standard. */
export const CONTROL =
  "rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground " +
  "disabled:opacity-60 disabled:cursor-not-allowed aria-[invalid=true]:border-red-500 aria-[invalid=true]:bg-red-50/40";

/** Variante compacte pour les tableaux et éditeurs denses. */
export const CONTROL_COMPACT =
  "rounded-md border border-border bg-background px-2 py-1 text-sm placeholder:text-muted-foreground " +
  "disabled:opacity-60 disabled:cursor-not-allowed aria-[invalid=true]:border-red-500";
