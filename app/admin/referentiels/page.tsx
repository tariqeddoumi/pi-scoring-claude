import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui";
import { DbSetupNotice, safe } from "@/lib/dbGuard";
import { ReferentialEditor, type RefRow } from "@/components/ReferentialEditor";
import { getCurrentAppUser } from "@/lib/supabase/server";
import { hasPermission, PERMISSIONS, type RoleName } from "@/lib/rbac";
import { REFERENTIAL_KINDS, REFERENTIAL_LABELS } from "@/server/services/referentialLoader";

export const dynamic = "force-dynamic";

const HINTS: Record<string, { hint: string; configHint: string }> = {
  AUTHORIZATION: {
    hint: "Pièces exigibles d'un programme et jalon qu'elles verrouillent. Une pièce « blocksWorks » interdit le décaissement des travaux tant qu'elle n'est pas levée.",
    configHint: 'Ex. {"stage":"TIRAGE","appliesTo":["CONSTRUCTION","MIXTE"],"blocksWorks":true,"regRef":"Loi 12-90"} — stage : ETUDE | OCTROI | SIGNATURE | TIRAGE.',
  },
  BUYER_FINANCING: {
    hint: "Statuts de financement de l'acquéreur et facteur de sécurisation appliqué aux ventes engagées.",
    configHint: 'Ex. {"securityFactor":0.8} — facteur entre 0 et 1.',
  },
  FACILITY_NATURE: {
    hint: "Natures de concours du crédit promoteur. « requiresWorksCertificate » impose une situation de travaux visée au déblocage.",
    configHint: 'Ex. {"requiresWorksCertificate":true,"typicalQuotity":0.7}.',
  },
  BUYER_AID: {
    hint: "Dispositifs publics d'appui à l'acquisition. Montants et conditions relèvent d'un référentiel daté, à maintenir avec le Juridique.",
    configHint: "Généralement {} — la note porte les conditions.",
  },
  PRUDENTIAL_LIMIT: {
    hint: "Code DIVISION_RISQUES : fonds propres prudentiels et limite par contrepartie / groupe. Alimente l'alerte « Limite de division des risques dépassée » lors de la synchronisation du suivi. Sans fonds propres renseignés, le contrôle n'est pas effectué.",
    configHint: 'Ex. {"ownFunds":15000000000,"limitPct":0.2,"largeExposurePct":0.05,"netOfGuarantees":false} — montants en MAD, taux entre 0 et 1, à caler sur le référentiel réglementaire en vigueur.',
  },
};

export default async function ReferentielsAdminPage() {
  const res = await safe(() =>
    prisma.referentialItem.findMany({ orderBy: [{ kind: "asc" }, { orderIndex: "asc" }] }),
  );
  if (!res.ok) return <DbSetupNotice error={res.error} />;
  const items = res.data;

  const actor = await getCurrentAppUser();
  const canEdit = !!actor && hasPermission(actor.role.name as RoleName, PERMISSIONS.MODEL_WRITE);

  const rowsFor = (kind: string): RefRow[] =>
    items
      .filter((i) => i.kind === kind)
      .map((i) => ({
        kind: i.kind,
        code: i.code,
        label: i.label,
        orderIndex: i.orderIndex,
        active: i.active,
        config: JSON.stringify(i.config ?? {}),
        note: i.note,
      }));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/model" className="text-sm text-muted-foreground hover:underline">← Administration</Link>
        <h1 className="text-2xl font-bold">Référentiels métier</h1>
        <p className="text-muted-foreground text-sm">
          Listes alignées sur la pratique marocaine, modifiables sans redéploiement. À défaut d&apos;item actif,
          l&apos;application retombe sur les valeurs par défaut du code.
        </p>
      </div>

      {!canEdit && (
        <Card><CardContent className="py-4 text-sm text-muted-foreground">
          Consultation seule — la modification requiert la permission d&apos;administration du modèle.
        </CardContent></Card>
      )}

      {REFERENTIAL_KINDS.map((kind) => (
        <ReferentialEditor
          key={kind}
          kind={kind}
          title={REFERENTIAL_LABELS[kind]}
          hint={HINTS[kind]?.hint ?? ""}
          configHint={HINTS[kind]?.configHint ?? ""}
          rows={rowsFor(kind)}
          canEdit={canEdit}
        />
      ))}
    </div>
  );
}
