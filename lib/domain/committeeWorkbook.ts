// =====================================================================
//  committeeWorkbook.ts — Construction PURE du classeur Excel « dossier de
//  comité » détaillé (multi-feuilles). Aucune IO : prend des données déjà
//  agrégées (CommitteeData) et renvoie, par feuille, un tableau de tableaux
//  (AoA) prêt à encoder en .xlsx (SheetJS). Testable unitairement.
//
//  Plus détaillé que le rapport HTML imprimable : descend au niveau critère
//  (note 1..10, contribution), liste les déclencheurs 1/W et le détail des
//  garanties, et expose la qualité des données (§6.2).
// =====================================================================

export interface CommitteeData {
  project: {
    reference: string;
    name: string;
    promoter: string;
    city: string | null;
    segment: string | null;
    nature: string; // "Promotion" | "Exploitation"
  };
  score: number | null; // 0..100
  decision: string | null; // libellé
  regulatory: {
    className: string; // libellé classe (ou "—")
    regimeName: string;
    isWatchList: boolean;
    restructuringNote: string | null;
    overrideNote: string | null;
    dataQualityStatus: string | null;
    missingCriticalData: string[];
    triggers: { kind: string; targetClass: string; reason: string }[];
  };
  metrics: {
    ead: number;
    slotting: string;
    stage: number;
    pd: number; // 0..1
    lgd: number; // 0..1
    expectedLoss: number;
    ecl: number;
    rwa: number;
    riskWeight: number; // 0..1
  };
  provision: {
    ead: number;
    reservedAgios: number;
    eligibleGuarantees: number;
    provisionBase: number;
    rate: number; // 0..1
    provisionAmount: number;
    isIrregular: boolean;
    breakdown: { typeCode: string; marketValue: number; effectiveQuotity: number; eligibleValue: number }[];
  } | null;
  domains: { code: string; name: string; score: number }[]; // score 0..100
  criteria: {
    domainCode: string;
    code: string;
    name: string;
    rawValue: string | null;
    score: number; // 1..10
    weighted: number;
    matchedRef: string | null;
    gateBlocked: boolean;
  }[];
  redFlags: { name: string; malus: number }[];
}

export interface WorkbookSheet {
  name: string;
  rows: (string | number)[][];
}

const pct1 = (v: number) => Math.round(v * 1000) / 10; // 0..1 -> 0..100 (1 déc.)
const yesno = (b: boolean) => (b ? "Oui" : "Non");

/**
 * Construit les feuilles du dossier de comité détaillé. Les montants et taux
 * sont laissés en valeurs numériques (Excel les traite comme nombres).
 */
export function buildCommitteeWorkbook(d: CommitteeData): WorkbookSheet[] {
  const synthese: (string | number)[][] = [
    ["Dossier de comité — Promotion immobilière"],
    [],
    ["Référence", d.project.reference],
    ["Projet", d.project.name],
    ["Promoteur", d.project.promoter],
    ["Ville", d.project.city ?? ""],
    ["Segment", d.project.segment ?? ""],
    ["Nature", d.project.nature],
    [],
    ["Score final (/100)", d.score ?? ""],
    ["Décision", d.decision ?? "Non scoré"],
    ["Classe réglementaire", d.regulatory.className],
    ["Régime", d.regulatory.regimeName],
    ["Watch List", yesno(d.regulatory.isWatchList)],
    ["Qualité des données", d.regulatory.dataQualityStatus ?? "—"],
    ["Données manquantes", d.regulatory.missingCriticalData.join(", ")],
    [],
    ["— Métriques de risque (Bâle / IFRS 9, indicatif) —"],
    ["EAD (MAD)", d.metrics.ead],
    ["Slotting", d.metrics.slotting],
    ["Stage IFRS 9", d.metrics.stage],
    ["PD (%)", pct1(d.metrics.pd)],
    ["LGD (%)", pct1(d.metrics.lgd)],
    ["Perte attendue EL (MAD)", d.metrics.expectedLoss],
    ["ECL IFRS 9 (MAD)", d.metrics.ecl],
    ["RWA (MAD)", d.metrics.rwa],
    ["Pondération de risque (%)", pct1(d.metrics.riskWeight)],
    ["Provision BKAM (MAD)", d.provision?.provisionAmount ?? ""],
  ];

  const scoring: (string | number)[][] = [["Domaine", "Critère", "Code", "Valeur", "Note /10", "Contribution", "Modalité retenue", "Gate"]];
  for (const dom of d.domains) {
    scoring.push([`${dom.code} — ${dom.name}`, "", "", "", `${Math.round(dom.score)}/100`, "", "(score domaine)", ""]);
    for (const c of d.criteria.filter((x) => x.domainCode === dom.code)) {
      scoring.push(["", c.name, c.code, c.rawValue ?? "", c.score, c.weighted, c.matchedRef ?? "", yesno(c.gateBlocked)]);
    }
  }
  if (d.redFlags.length) {
    scoring.push([]);
    scoring.push(["Red flags D5", "Malus"]);
    for (const f of d.redFlags) scoring.push([f.name, f.malus]);
  }

  const classification: (string | number)[][] = [
    ["Classe retenue", d.regulatory.className],
    ["Régime", d.regulatory.regimeName],
    ["Watch List", yesno(d.regulatory.isWatchList)],
    ["Restructuration", d.regulatory.restructuringNote ?? "—"],
    ["Dérogation comité", d.regulatory.overrideNote ?? "—"],
    ["Qualité des données", d.regulatory.dataQualityStatus ?? "—"],
    ["Données manquantes", d.regulatory.missingCriticalData.join(", ") || "—"],
    [],
    ["Déclencheurs", "Classe visée", "Motif"],
    ...(d.regulatory.triggers.length
      ? d.regulatory.triggers.map((t) => [t.kind, t.targetClass, t.reason])
      : [["—", "—", "Aucun (créance saine)"]]),
  ];

  const provision: (string | number)[][] = d.provision
    ? [
        ["EAD (MAD)", d.provision.ead],
        ["Agios réservés (MAD)", d.provision.reservedAgios],
        ["Garanties éligibles (MAD)", d.provision.eligibleGuarantees],
        ["Base provisionnable (MAD)", d.provision.provisionBase],
        ["Taux (%)", pct1(d.provision.rate)],
        ["Provision (MAD)", d.provision.provisionAmount],
        ["Créance irrégulière (couverte 100%)", yesno(d.provision.isIrregular)],
        [],
        ["Garantie", "Valeur de marché (MAD)", "Quotité effective (%)", "Valeur admise (MAD)"],
        ...d.provision.breakdown.map((b) => [b.typeCode, b.marketValue, pct1(b.effectiveQuotity), b.eligibleValue]),
      ]
    : [["Aucun provisionnement calculé."]];

  return [
    { name: "Synthèse", rows: synthese },
    { name: "Scoring", rows: scoring },
    { name: "Classification 1W", rows: classification },
    { name: "Provision", rows: provision },
  ];
}
