// =====================================================================
//  dossierDocuments.ts — Pièces du dossier de crédit de promotion immobilière.
//  Référentiel des pièces attendues (pratique marocaine), liste des pièces
//  manquantes selon l'étape du dossier, classement d'un fichier par son nom,
//  et fusion des valeurs lues dans plusieurs documents (sources, conflits).
//  Fonctions pures, testées ; la lecture des documents est faite par
//  server/services/claudeDocumentReader.ts.
// =====================================================================

import type { ConditionStage } from "./types";
import { AUTHORIZATION_CHAIN, type ProgramKind } from "./morocco";

export type DocCategory = "PROMOTEUR" | "FONCIER" | "AUTORISATIONS" | "PROJET" | "COMMERCIAL" | "FINANCEMENT" | "SUIVI";

export const DOC_CATEGORY_LABELS: Record<DocCategory, string> = {
  PROMOTEUR: "Promoteur",
  FONCIER: "Foncier",
  AUTORISATIONS: "Autorisations administratives",
  PROJET: "Projet et travaux",
  COMMERCIAL: "Commercialisation",
  FINANCEMENT: "Financement",
  SUIVI: "Suivi du chantier et livraison",
};

export interface DossierDocDef {
  code: string;
  label: string;
  category: DocCategory;
  /** Jalon au plus tard duquel la pièce doit être au dossier. */
  stage: ConditionStage;
  /** Programmes concernés (tous par défaut). */
  appliesTo?: readonly ProgramKind[];
  /** Pièce utile mais non exigée. */
  optional?: boolean;
  /** Pièce de fin de programme (réception, permis d'habiter…) : toujours « à prévoir » tant qu'elle manque. */
  atDelivery?: boolean;
  /** Ce que la pièce établit (aide à la lecture et à la relance du client). */
  purpose: string;
  /** Données de la saisie que la pièce permet de renseigner. */
  informs: readonly string[];
  /** Mots repérés dans le nom du fichier (classement sans lecture du contenu). */
  keywords: readonly string[];
}

const ALL: readonly ProgramKind[] = ["LOTISSEMENT", "CONSTRUCTION", "MIXTE"];
const auth = (code: string) => AUTHORIZATION_CHAIN.find((a) => a.code === code)!;

/** Pièces attendues, dans l'ordre de présentation. */
export const DOSSIER_DOCUMENTS: readonly DossierDocDef[] = [
  // Promoteur
  { code: "statuts", label: "Statuts de la société", category: "PROMOTEUR", stage: "ETUDE", purpose: "Forme juridique, capital, actionnariat et gouvernance.", informs: ["governance_quality", "promoter_type"], keywords: ["statuts", "statut"] },
  { code: "rc_modele_j", label: "Registre de commerce (modèle J)", category: "PROMOTEUR", stage: "ETUDE", purpose: "Existence légale, dirigeants, nantissements inscrits.", informs: ["governance_quality"], keywords: ["registre de commerce", "modele j", "rc"] },
  { code: "etats_financiers", label: "États financiers des 3 derniers exercices", category: "PROMOTEUR", stage: "ETUDE", purpose: "Endettement, fonds propres, rentabilité du promoteur.", informs: ["promoter_gearing", "equity_negative", "debt_equity_ratio", "revenue_drop_pct", "mono_project_concentration"], keywords: ["etats financiers", "bilan", "bilans", "cpc", "liasse", "comptes annuels"] },
  { code: "references_promoteur", label: "Références du promoteur (programmes réalisés)", category: "PROMOTEUR", stage: "ETUDE", purpose: "Expérience : programmes livrés, volumes, délais.", informs: ["promoter_completed_projects", "promoter_type"], keywords: ["references", "realisations", "book", "plaquette"] },
  { code: "attestations_fiscales_sociales", label: "Attestations de régularité fiscale et CNSS", category: "PROMOTEUR", stage: "OCTROI", purpose: "Absence d'arriérés fiscaux et sociaux.", informs: [], keywords: ["attestation fiscale", "regularite fiscale", "cnss", "attestation de regularite"] },
  { code: "structure_groupe", label: "Organigramme du groupe et engagements bancaires", category: "PROMOTEUR", stage: "ETUDE", optional: true, purpose: "Effet groupe, concentration et division des risques.", informs: ["mono_project_concentration"], keywords: ["organigramme", "groupe", "engagements"] },
  { code: "pv_pouvoirs", label: "PV d'assemblée et pouvoirs des signataires", category: "PROMOTEUR", stage: "SIGNATURE", purpose: "Capacité à emprunter et à consentir les sûretés.", informs: [], keywords: ["pv", "proces verbal", "pouvoirs", "assemblee"] },
  // Foncier
  { code: "certificat_propriete", label: "Certificat de propriété / titre foncier", category: "FONCIER", stage: "ETUDE", purpose: "Propriété du terrain, inscriptions et charges (purge du titre).", informs: ["land_permits_status", "landTitleRef", "landAreaSqm"], keywords: ["certificat de propriete", "titre foncier", "tf", "conservation fonciere"] },
  { code: "acte_acquisition", label: "Acte ou compromis d'acquisition du terrain", category: "FONCIER", stage: "ETUDE", purpose: "Prix du terrain, conditions et date d'acquisition.", informs: ["land_cost_ratio", "landAreaSqm"], keywords: ["acte d acquisition", "acte de vente", "compromis", "acquisition"] },
  { code: "expertise_terrain", label: "Rapport d'expertise (terrain / programme)", category: "FONCIER", stage: "OCTROI", purpose: "Valeur de la garantie et valeur à terminaison.", informs: ["ltv_stressed", "guarantee_coverage", "first_rank"], keywords: ["expertise", "evaluation", "rapport d expert", "valorisation"] },
  // Autorisations (chaîne marocaine, mêmes codes que la carte « Autorisations »)
  ...["note_renseignement", "autorisation_lotir", "permis_construire", "autorisation_morcellement"].map((code): DossierDocDef => {
    const a = auth(code);
    return {
      code, label: a.label, category: "AUTORISATIONS", stage: code === "note_renseignement" ? "ETUDE" : a.stage, appliesTo: a.appliesTo,
      purpose: a.regRef ? `${a.regRef}.` : "Autorisation administrative.",
      informs: ["land_permits_status", "authorization_completeness_pct", "works_authorization_blocked", ...(code === "permis_construire" ? ["buildPermitRef", "buildPermitDate", "builtAreaSqm"] : [])],
      keywords: { note_renseignement: ["note de renseignement", "renseignements urbanistiques"], autorisation_lotir: ["autorisation de lotir", "lotir"], permis_construire: ["permis de construire", "autorisation de construire", "permis"], autorisation_morcellement: ["morcellement", "eclatement"] }[code]!,
    };
  }),
  { code: "plans_autorises", label: "Plans autorisés (architecte)", category: "AUTORISATIONS", stage: "OCTROI", appliesTo: ["CONSTRUCTION", "MIXTE"], purpose: "Consistance du programme : nombre de lots, surfaces, typologies.", informs: ["totalUnits", "builtAreaSqm", "technical_complexity"], keywords: ["plans", "plan masse", "plans autorises"] },
  // Projet et travaux
  { code: "note_presentation", label: "Note de présentation du projet", category: "PROJET", stage: "ETUDE", purpose: "Description du programme, du promoteur et du montage.", informs: ["totalUnits", "landAreaSqm", "builtAreaSqm", "totalCost", "loanAmount", "ownEquity", "market_positioning", "tranche_dependency"], keywords: ["note de presentation", "presentation du projet", "presentation", "memo", "fiche projet"] },
  { code: "etude_marche", label: "Étude de marché", category: "PROJET", stage: "ETUDE", purpose: "Demande, concurrence, prix de sortie, rythme d'écoulement.", informs: ["market_positioning", "regional_market_tension", "macro_sensitivity", "stock_rotation_months"], keywords: ["etude de marche", "marche", "benchmark"] },
  { code: "business_plan", label: "Business plan / bilan prévisionnel et plan de trésorerie", category: "PROJET", stage: "ETUDE", purpose: "Chiffre d'affaires, coûts, marge, besoin de financement, trésorerie.", informs: ["gross_margin_pct", "stressed_margin_pct", "ltc", "funding_gap_pct", "cash_coverage", "interest_coverage", "land_cost_ratio", "slow_liquidity_share_pct", "totalCost", "loanAmount", "ownEquity"], keywords: ["business plan", "bp", "previsionnel", "plan de tresorerie", "tresorerie", "bilan previsionnel", "rentabilite"] },
  { code: "budget_travaux", label: "Budget détaillé des travaux / devis estimatif", category: "PROJET", stage: "ETUDE", purpose: "Coût de construction poste par poste, équipements à la charge du programme.", informs: ["totalCost", "equipment_unbudgeted_pct", "cost_overrun_pct"], keywords: ["budget", "devis", "dqe", "metre", "estimatif", "bordereau des prix"] },
  { code: "planning_travaux", label: "Planning des travaux", category: "PROJET", stage: "OCTROI", purpose: "Calendrier de réalisation et de livraison.", informs: ["startDate", "expectedDeliveryDate", "progress_vs_plan"], keywords: ["planning", "calendrier", "gantt"] },
  { code: "marche_travaux", label: "Marché / contrat avec l'entreprise de travaux", category: "PROJET", stage: "SIGNATURE", purpose: "Entreprise retenue, prix, délais, garanties de marché.", informs: ["contractor_quality"], keywords: ["marche de travaux", "contrat entreprise", "contrat de travaux", "marche", "cps"] },
  { code: "caution_execution", label: "Caution de bonne exécution / retenue de garantie", category: "PROJET", stage: "TIRAGE", optional: true, purpose: "Garanties de l'entreprise de travaux.", informs: ["contractor_quality"], keywords: ["caution", "bonne execution", "retenue de garantie"] },
  { code: "assurance_trc", label: "Assurance tous risques chantier (TRC)", category: "PROJET", stage: "TIRAGE", purpose: "Couverture du chantier, banque bénéficiaire.", informs: [], keywords: ["trc", "tous risques chantier", "assurance"] },
  { code: "convention_equipements", label: "Cahier des charges / convention d'équipements avec la commune", category: "PROJET", stage: "OCTROI", optional: true, purpose: "Équipements exigés (mosquée, école, voirie…), échéances et financement.", informs: ["equipment_unbudgeted_pct", "equipment_delivery_at_risk"], keywords: ["cahier des charges", "convention", "equipements"] },
  // Commercialisation
  { code: "etat_preventes", label: "État des réservations et préventes", category: "COMMERCIAL", stage: "ETUDE", purpose: "Lots réservés, avances encaissées, désistements.", informs: ["pre_sale_rate", "sales_vs_plan", "secured_sales_rate", "cancellation_rate_pct", "dso_days"], keywords: ["reservation", "reservations", "prevente", "preventes", "etat des ventes", "commercialisation", "ventes"] },
  { code: "grille_prix", label: "Grille de prix de vente", category: "COMMERCIAL", stage: "ETUDE", purpose: "Prix par typologie, cohérence avec le marché.", informs: ["market_positioning"], keywords: ["grille de prix", "grille", "prix de vente", "tarif"] },
  { code: "contrat_vefa", label: "Modèle de contrat de réservation / VEFA", category: "COMMERCIAL", stage: "SIGNATURE", optional: true, purpose: "Conditions de vente sur plan, garanties de l'acquéreur.", informs: [], keywords: ["vefa", "contrat de reservation", "contrat preliminaire"] },
  // Financement
  { code: "demande_credit", label: "Demande de crédit signée", category: "FINANCEMENT", stage: "ETUDE", purpose: "Montant, nature et durée du concours sollicité.", informs: ["loanAmount"], keywords: ["demande de credit", "demande de financement", "demande"] },
  { code: "plan_financement", label: "Plan de financement du programme", category: "FINANCEMENT", stage: "ETUDE", purpose: "Coût total, apport, crédit, avances clients.", informs: ["totalCost", "loanAmount", "ownEquity", "ltc", "equity_injected_ratio"], keywords: ["plan de financement", "financement"] },
  { code: "justificatif_apport", label: "Justificatifs de l'apport en fonds propres", category: "FINANCEMENT", stage: "OCTROI", purpose: "Apport réellement injecté (relevés, quittances du terrain).", informs: ["equity_injected_ratio", "ownEquity"], keywords: ["apport", "fonds propres", "releve", "releves", "justificatif"] },
  // Suivi et livraison
  { code: "situation_travaux", label: "Situation de travaux visée (architecte / BET)", category: "SUIVI", stage: "TIRAGE", purpose: "Avancement certifié, base des déblocages.", informs: ["progress_vs_plan", "drawdown_vs_progress_pct", "construction_delay_months"], keywords: ["situation de travaux", "situation", "attachement", "avancement"] },
  ...["reception_provisoire", "permis_habiter", "certificat_conformite", "reception_definitive"].map((code): DossierDocDef => {
    const a = auth(code);
    return {
      code, label: a.label, category: "SUIVI", stage: a.stage, appliesTo: a.appliesTo, atDelivery: true,
      purpose: "Achèvement et livraison : conditionne les actes de vente et les mainlevées.",
      informs: ["authorization_completeness_pct"],
      keywords: { reception_provisoire: ["reception provisoire"], permis_habiter: ["permis d habiter"], certificat_conformite: ["certificat de conformite", "conformite"], reception_definitive: ["reception definitive"] }[code]!,
    };
  }),
];

export const DOSSIER_DOC_DEFS = new Map(DOSSIER_DOCUMENTS.map((d) => [d.code, d]));
export const OTHER_DOC = "autre";

const STAGE_RANK: Record<ConditionStage, number> = { ETUDE: 0, OCTROI: 1, SIGNATURE: 2, TIRAGE: 3 };
export const STAGE_LABELS: Record<ConditionStage, string> = {
  ETUDE: "pour l'étude", OCTROI: "avant l'octroi", SIGNATURE: "avant la signature", TIRAGE: "avant le premier tirage",
};

/** Jalon atteint par le dossier, déduit de l'étape du circuit et des tirages. */
export function dossierStage(workflowState: string, drawnAmount = 0): ConditionStage {
  if (drawnAmount > 0) return "TIRAGE";
  if (workflowState === "APPROVED") return "SIGNATURE";
  if (workflowState === "MANAGER_VALIDATION" || workflowState === "COMMITTEE") return "OCTROI";
  return "ETUDE";
}

/** Normalisation des noms et des libellés : minuscules, sans accents ni ponctuation. */
export const foldText = (s: string) =>
  ` ${s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;

/** Type de pièce deviné d'après le nom du fichier (null si aucun indice). */
export function classifyByFileName(fileName: string): string | null {
  const name = foldText(fileName.replace(/\.[a-z0-9]{2,5}$/i, ""));
  let best: { code: string; score: number } | null = null;
  for (const d of DOSSIER_DOCUMENTS) {
    for (const k of d.keywords) {
      if (name.includes(` ${k} `) || (k.includes(" ") && name.includes(k))) {
        const score = k.length;
        if (!best || score > best.score) best = { code: d.code, score };
      }
    }
  }
  return best?.code ?? null;
}

// ------------------------------------------------------------ checklist

export type PieceStatus = "RECU" | "NON_APPLICABLE";

export interface PieceRecord {
  id: string;
  docType: string;
  status: PieceStatus;
  fileName: string | null;
  source: string; // "ia" | "nom" | "manuel"
  createdAt: Date | string;
}

export type ChecklistState = "recu" | "manquant" | "a_prevoir" | "non_applicable" | "facultatif";

export interface ChecklistItem {
  def: DossierDocDef;
  state: ChecklistState;
  pieces: PieceRecord[];
}

export interface Checklist {
  stage: ConditionStage;
  items: ChecklistItem[];
  missingNow: ChecklistItem[];
  toPlan: ChecklistItem[];
  received: number;
  expected: number;
}

/**
 * Pièces attendues pour le programme et leur état : reçue, non applicable,
 * manquante (exigée au jalon actuel ou avant), à prévoir (jalon ultérieur),
 * facultative.
 */
export function buildChecklist(pieces: PieceRecord[], ctx: { programKind: ProgramKind | null; stage: ConditionStage }): Checklist {
  const kind = ctx.programKind ?? "CONSTRUCTION";
  const items: ChecklistItem[] = DOSSIER_DOCUMENTS
    .filter((d) => (d.appliesTo ?? ALL).includes(kind))
    .map((def) => {
      const mine = pieces.filter((p) => p.docType === def.code);
      let state: ChecklistState;
      if (mine.some((p) => p.status === "RECU")) state = "recu";
      else if (mine.some((p) => p.status === "NON_APPLICABLE")) state = "non_applicable";
      else if (def.optional) state = "facultatif";
      else if (def.atDelivery || STAGE_RANK[def.stage] > STAGE_RANK[ctx.stage]) state = "a_prevoir";
      else state = "manquant";
      return { def, state, pieces: mine };
    });
  const expected = items.filter((i) => !i.def.optional && i.state !== "non_applicable");
  return {
    stage: ctx.stage,
    items,
    missingNow: items.filter((i) => i.state === "manquant"),
    toPlan: items.filter((i) => i.state === "a_prevoir"),
    received: expected.filter((i) => i.state === "recu").length,
    expected: expected.length,
  };
}

/** Liste des pièces à demander au client, prête à copier dans un e-mail. */
export function formatMissingList(c: Checklist, dossier: { reference: string; name: string }): string {
  const line = (i: ChecklistItem) => `- ${i.def.label}${i.state === "a_prevoir" ? ` (${i.def.atDelivery ? "à la livraison" : STAGE_LABELS[i.def.stage]})` : ""}`;
  const out = [`Dossier ${dossier.reference} — ${dossier.name}`, ""];
  if (c.missingNow.length) out.push(`Pièces à fournir ${STAGE_LABELS[c.stage]} :`, ...c.missingNow.map(line), "");
  const later = c.toPlan.filter((i) => !i.def.atDelivery);
  if (later.length) out.push("Pièces à prévoir pour la suite :", ...later.map(line), "");
  if (!c.missingNow.length && !later.length) out.push("Toutes les pièces attendues à ce stade ont été reçues.");
  return out.join("\n").trim();
}

// ------------------------------------------------------------ valeurs lues

export interface FieldSource {
  fileName: string;
  docType: string | null;
  page: number | null;
  quote: string;
}

export interface ExtractedField {
  key: string;
  value: number | boolean | string;
  page: number | null;
  quote: string;
}

export interface DocumentExtraction {
  fileName: string;
  docType: string | null;
  fields: ExtractedField[];
}

export interface CandidateOption {
  value: number | boolean | string;
  sources: FieldSource[];
}

export interface Candidate {
  key: string;
  options: CandidateOption[];
  /** Valeurs différentes selon les documents : à arbitrer. */
  conflict: boolean;
  current: number | boolean | string | null;
  /** Valeur proposée par défaut (la plus souvent lue, sinon la première). */
  proposed: number | boolean | string;
  /** Identique à la valeur déjà saisie : rien à faire. */
  unchanged: boolean;
}

const norm = (v: number | boolean | string) =>
  typeof v === "number" ? String(Math.round(v * 100) / 100) : typeof v === "string" ? foldText(v).trim() : String(v);

/** Regroupe les valeurs lues par donnée, avec leurs sources, et signale les conflits. */
export function mergeExtractions(
  docs: DocumentExtraction[],
  current: Record<string, number | boolean | string | null | undefined>,
  order: readonly string[] = [],
): Candidate[] {
  const byKey = new Map<string, CandidateOption[]>();
  for (const d of docs) {
    for (const f of d.fields) {
      const opts = byKey.get(f.key) ?? [];
      const src: FieldSource = { fileName: d.fileName, docType: d.docType, page: f.page, quote: f.quote };
      const same = opts.find((o) => norm(o.value) === norm(f.value));
      if (same) same.sources.push(src);
      else opts.push({ value: f.value, sources: [src] });
      byKey.set(f.key, opts);
    }
  }
  const rank = (k: string) => { const i = order.indexOf(k); return i < 0 ? order.length : i; };
  return [...byKey.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([key, options]) => {
      const sorted = [...options].sort((a, b) => b.sources.length - a.sources.length);
      const cur = current[key] ?? null;
      const proposed = sorted[0]!.value;
      return {
        key, options: sorted, conflict: sorted.length > 1, current: cur, proposed,
        unchanged: cur !== null && norm(cur) === norm(proposed) && sorted.length === 1,
      };
    });
}
