// Lecture complète d'un résultat de scoring (modèle v3/v4) : version du modèle
// utilisée, classe interne, chaîne de calcul, notes économique et sûretés,
// données décisionnelles manquantes, conditions et retours en comité.

import { Card, CardContent, CardHeader, CardTitle, Badge, Stat } from "@/components/ui";
import { INPUT_LABELS } from "@/lib/inputLabels";
import type { ScoringRunDetails } from "@/lib/domain/scoringRunDetails";
import { formatDecimal } from "@/lib/utils";
import { TONE } from "@/lib/tones";

const STAGE_LABELS: Record<string, string> = {
  ETUDE: "étude",
  OCTROI: "octroi",
  SIGNATURE: "signature",
  TIRAGE: "tirage",
};

const pct = (v: number) => `${formatDecimal(v * 100, 2).replace(".", ",")} %`;
const sign = (v: number) => (v === 0 ? "0 %" : `${v > 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(0)} %`);

export function ScoringReading({
  details,
  runVersion,
  runVersionStatus,
  activeVersion,
  scoreFinal,
  coeffBAM,
  scoreAfterPenalties,
}: {
  details: ScoringRunDetails | null;
  runVersion: string | null;
  runVersionStatus: string | null;
  activeVersion: string | null;
  scoreFinal: number | null;
  coeffBAM: number | null;
  scoreAfterPenalties: number | null;
}) {
  const stale = runVersionStatus != null && runVersionStatus !== "PUBLISHED";
  return (
    <Card className="lg:col-span-3">
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle>Lecture du résultat</CardTitle>
          <div className="flex items-center gap-2">
            {runVersion && (
              <Badge className={stale ? TONE.warning : TONE.neutral}>
                Modèle {runVersion}
                {stale ? " — version retirée" : ""}
              </Badge>
            )}
            {details && <Badge className={TONE.neutral}>Classe interne : {details.internalClass}</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {stale && (
          <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Ce score a été calculé avec le modèle {runVersion}, qui n'est plus la version publiée
            {activeVersion ? ` (${activeVersion})` : ""}. Relancer le calcul pour appliquer le modèle en vigueur.
          </p>
        )}

        {!details ? (
          <p className="text-sm text-muted-foreground">
            Calcul antérieur à la conservation du détail : relancer le scoring pour afficher les données manquantes,
            les notes économique et sûretés, et les conditions.
          </p>
        ) : (
          <>
            {details.dataIncomplete && (
              <div className="rounded-md border border-slate-400 bg-slate-100 px-3 py-2 text-sm">
                <p className="font-medium">Dossier incomplet — données décisionnelles absentes :</p>
                {details.missingCriticalInputs.length > 0 ? (
                  <ul className="mt-1 list-disc pl-5">
                    {details.missingCriticalInputs.map((k) => (
                      <li key={k}>{INPUT_LABELS[k] ?? k}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1">Classe réglementaire non établie (qualité des données bloquante).</p>
                )}
              </div>
            )}
            {details.defaultAsserted && (
              <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
                Classe réglementaire en défaut ({details.regulatoryClass}) : décision NO_GO imposée.
              </p>
            )}
            {(details.unknownSegment || details.unknownZone) && (
              <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {details.unknownSegment ? "Segment" : ""}
                {details.unknownSegment && details.unknownZone ? " et zone" : details.unknownZone ? "Zone" : ""} hors référentiel du
                modèle : aucun ajustement appliqué — à corriger sur la fiche projet.
              </p>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
              <Stat label="Score économique brut" value={formatDecimal(details.scoreEco, 2)} hint="S_éco (D1–D4)" />
              <Stat label="Ajustements" value={`${sign(details.alphaSeg)} / ${sign(details.betaZone)}`} hint="segment / zone" />
              <Stat label="Malus alertes" value={details.totalMalus > 0 ? `−${details.totalMalus}` : "0"} hint={scoreAfterPenalties != null ? `après : ${formatDecimal(scoreAfterPenalties, 2)}` : undefined} />
              <Stat label="Coefficient BAM" value={coeffBAM != null ? formatDecimal(coeffBAM, 2) : "—"} hint={details.regulatoryClass ?? "classe non établie"} />
              <Stat label="Score final" value={scoreFinal != null ? formatDecimal(scoreFinal, 2) : "—"} />
              <Stat label="PD indicative" value={pct(details.pdProxy)} hint="non calibrée" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Stat label="Note économique" value={formatDecimal(details.economicScore, 1)} hint="capacité de remboursement" />
              <Stat
                label="Note de sûretés"
                value={details.guaranteeScore != null ? formatDecimal(details.guaranteeScore, 1) : "—"}
                hint="couverture / rang / désengagement"
              />
            </div>

            {details.conditions.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-medium">Conditions attachées à la décision</p>
                <ul className="space-y-1 text-sm">
                  {details.conditions.map((c) => (
                    <li key={c.code} className="flex items-center gap-2">
                      <Badge className={c.blocking ? TONE.danger : TONE.neutral}>
                        {c.blocking ? "bloquante" : "à lever"} · {STAGE_LABELS[c.stage] ?? c.stage}
                      </Badge>
                      <span>{c.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {details.committeeFlags.length > 0 && (
              <p className="text-sm text-red-700">
                Retour en comité requis par : {details.committeeFlags.join(", ")}.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
