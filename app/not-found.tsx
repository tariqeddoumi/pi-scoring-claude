import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg rounded-lg border border-border bg-background p-8 text-center shadow-sm">
      <h1 className="text-xl font-semibold">Page ou dossier introuvable</h1>
      <p className="mt-2 text-sm text-muted-foreground">Le lien est peut-être ancien, ou le dossier a été supprimé ou n&apos;est pas accessible avec votre profil.</p>
      <div className="mt-6 flex justify-center gap-2">
        <Link href="/projects" className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">Liste des projets</Link>
        <Link href="/" className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted">Tableau de bord</Link>
      </div>
    </div>
  );
}
