import Link from "next/link";
import { headers } from "next/headers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { DbSetupNotice, safe } from "@/lib/dbGuard";
import { getCurrentAppUser } from "@/lib/supabase/server";
import { appBaseUrl } from "@/lib/cronAuth";
import { mailConfig } from "@/server/services/mailer";
import { digestFor } from "@/server/services/alertDigest";
import { TONE } from "@/lib/tones";

export const dynamic = "force-dynamic";

/** Aperçu du résumé hebdomadaire des alertes de l'utilisateur, tel qu'il est envoyé par e-mail. */
export default async function AlertDigestPreviewPage() {
  const user = await getCurrentAppUser();
  if (!user) return null;
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host") ?? "localhost"}`;
  const res = await safe(() => digestFor(user, appBaseUrl(origin)));
  if (!res.ok) return <DbSetupNotice error={res.error} />;
  const digest = res.data;
  const configured = mailConfig() != null;
  const isRm = user.role.name === "RELATIONSHIP_MANAGER";

  return (
    <div className="space-y-4">
      <div>
        <Link href="/alerts" className="text-sm text-muted-foreground hover:text-foreground">← Alertes & échéances</Link>
        <h1 className="text-2xl font-bold">Résumé hebdomadaire par e-mail</h1>
        <p className="text-sm text-muted-foreground">
          Chaque lundi à 8 h (heure de Casablanca), chaque chargé d&apos;affaires reçoit les alertes de ses dossiers.
          Aucun e-mail n&apos;est envoyé quand il n&apos;y a rien à signaler.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className={`rounded-md border px-3 py-2 text-sm ${configured ? TONE.success : TONE.warning}`}>
          <strong>Envoi des e-mails : {configured ? "activé" : "non configuré"}.</strong>{" "}
          {configured ? "Le fournisseur d'e-mail est paramétré." : "Le résumé est calculé mais pas envoyé (RESEND_API_KEY et MAIL_FROM à renseigner)."}
        </div>
        <div className={`rounded-md border px-3 py-2 text-sm ${TONE.info}`}>
          {isRm ? `Destinataire : ${user.email}.` : "Votre profil ne reçoit pas ce résumé (réservé aux chargés d'affaires) : l'aperçu porte sur tout le portefeuille."}
        </div>
      </div>

      {digest ? (
        <Card>
          <CardHeader>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Objet</div>
            <CardTitle>{digest.subject}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <iframe title="Aperçu de l'e-mail" srcDoc={digest.html} sandbox="" className="h-[70vh] w-full rounded-b-lg border-0 bg-white" />
          </CardContent>
        </Card>
      ) : (
        <Card><CardContent className="py-12 text-center">
          <p className="font-medium">Rien à signaler cette semaine : aucun e-mail ne serait envoyé.</p>
        </CardContent></Card>
      )}
    </div>
  );
}
