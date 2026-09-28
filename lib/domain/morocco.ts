// =====================================================================
//  morocco.ts — Alignement sur les pratiques du marché et des banques
//  marocaines pour le financement de la promotion immobilière.
//
//  Trois briques manquantes identifiées au diagnostic d'alignement :
//   A. la CHAÎNE D'AUTORISATIONS marocaine (chaque pièce conditionne un
//      jalon de décaissement différent) ;
//   B. la STRUCTURE DU CRÉDIT PROMOTEUR (avance sur foncier, crédit
//      d'accompagnement débloqué contre situation de travaux visée par
//      l'architecte/le BET, remboursement par mainlevées) ;
//   C. le FINANCEMENT DE L'ACQUÉREUR (crédit, aide directe au logement,
//      FOGARIM, Damane Assakane) qui conditionne la liquidité des ventes.
//
//  Logique PURE, déterministe, testable — aucune dépendance base.
//  Les références légales servent la traçabilité ; elles ne valent pas
//  certification juridique (à faire valider par le service juridique).
// =====================================================================

import type { ConditionStage } from "./types";

/** Alias exporté du jalon, pour le chargement depuis un référentiel administrable. */
export type ConditionStageLike = ConditionStage;

// ---------------------------------------------------------------------
//  A. Chaîne d'autorisations
// ---------------------------------------------------------------------

/** Nature du programme : conditionne les pièces exigibles. */
export type ProgramKind = "LOTISSEMENT" | "CONSTRUCTION" | "MIXTE";

export interface AuthorizationDef {
  code: string;
  label: string;
  /** Jalon au plus tard duquel la pièce doit être levée. */
  stage: ConditionStage;
  /** Programmes pour lesquels la pièce est exigible. */
  appliesTo: ProgramKind[];
  /** Référence légale / administrative (traçabilité). */
  regRef?: string;
  /** Pièce indispensable au démarrage des travaux financés. */
  blocksWorks?: boolean;
  /** Pièce indispensable à la livraison / à l'encaissement final. */
  blocksDelivery?: boolean;
}

/**
 * Chaîne d'autorisations d'un programme immobilier au Maroc, dans l'ordre
 * chronologique usuel. Chaque pièce est rattachée au jalon qu'elle verrouille
 * (diagnostic F15 : distinguer condition d'étude, d'octroi, de signature et de
 * tirage) plutôt qu'à un unique critère « autorisations » agrégé.
 */
export const AUTHORIZATION_CHAIN: readonly AuthorizationDef[] = [
  {
    code: "note_renseignement",
    label: "Note de renseignements urbanistiques",
    stage: "ETUDE",
    appliesTo: ["LOTISSEMENT", "CONSTRUCTION", "MIXTE"],
    regRef: "Urbanisme — agence urbaine",
  },
  {
    code: "titre_foncier_purge",
    label: "Titre foncier purgé (sans inscription contraignante)",
    stage: "OCTROI",
    appliesTo: ["LOTISSEMENT", "CONSTRUCTION", "MIXTE"],
    regRef: "ANCFCC — conservation foncière",
    blocksWorks: true,
  },
  {
    code: "autorisation_lotir",
    label: "Autorisation de lotir",
    stage: "TIRAGE",
    appliesTo: ["LOTISSEMENT", "MIXTE"],
    regRef: "Loi 25-90 relative aux lotissements",
    blocksWorks: true,
  },
  {
    code: "permis_construire",
    label: "Permis de construire",
    stage: "TIRAGE",
    appliesTo: ["CONSTRUCTION", "MIXTE"],
    regRef: "Loi 12-90 relative à l'urbanisme",
    blocksWorks: true,
  },
  {
    code: "autorisation_morcellement",
    label: "Autorisation de morcellement / éclatement du titre",
    stage: "TIRAGE",
    appliesTo: ["LOTISSEMENT", "MIXTE"],
    regRef: "ANCFCC — morcellement du titre mère",
  },
  {
    code: "reception_provisoire",
    label: "Réception provisoire des travaux",
    stage: "TIRAGE",
    appliesTo: ["LOTISSEMENT", "CONSTRUCTION", "MIXTE"],
    blocksDelivery: true,
  },
  {
    code: "permis_habiter",
    label: "Permis d'habiter",
    stage: "TIRAGE",
    appliesTo: ["CONSTRUCTION", "MIXTE"],
    regRef: "Loi 12-90",
    blocksDelivery: true,
  },
  {
    code: "certificat_conformite",
    label: "Certificat de conformité",
    stage: "TIRAGE",
    appliesTo: ["LOTISSEMENT", "CONSTRUCTION", "MIXTE"],
    blocksDelivery: true,
  },
  {
    code: "reception_definitive",
    label: "Réception définitive",
    stage: "TIRAGE",
    appliesTo: ["LOTISSEMENT", "CONSTRUCTION", "MIXTE"],
  },
] as const;

export const AUTHORIZATION_DEFS = new Map(AUTHORIZATION_CHAIN.map((a) => [a.code, a]));

export interface AuthorizationStatusView {
  code: string;
  /** Pièce obtenue et valide. */
  obtained: boolean;
  /** Date d'obtention (traçabilité). */
  obtainedAt?: Date | string | null;
}

export interface AuthorizationAssessment {
  kind: ProgramKind;
  required: AuthorizationDef[];
  obtained: string[];
  missing: AuthorizationDef[];
  /** Pièces manquantes indispensables au démarrage des travaux financés. */
  blockingWorks: AuthorizationDef[];
  /** Pièces manquantes indispensables à la livraison / l'encaissement. */
  blockingDelivery: AuthorizationDef[];
  /** Taux de complétude de la chaîne (0..100). */
  completenessPct: number;
  /** Le décaissement des travaux peut-il être autorisé ? */
  worksDrawAllowed: boolean;
}

/**
 * Évalue la chaîne d'autorisations : pièces exigibles selon la nature du
 * programme, manquantes, et verrous (travaux / livraison). Un permis
 * indispensable aux travaux financés est un VERROU DE TIRAGE, pas un simple
 * point de score.
 */
export function assessAuthorizations(
  kind: ProgramKind,
  statuses: AuthorizationStatusView[],
  chain: readonly AuthorizationDef[] = AUTHORIZATION_CHAIN,
): AuthorizationAssessment {
  const required = chain.filter((a) => a.appliesTo.includes(kind));
  const obtainedSet = new Set(statuses.filter((s) => s.obtained).map((s) => s.code));
  const obtained = required.filter((a) => obtainedSet.has(a.code)).map((a) => a.code);
  const missing = required.filter((a) => !obtainedSet.has(a.code));
  const blockingWorks = missing.filter((a) => a.blocksWorks === true);
  const blockingDelivery = missing.filter((a) => a.blocksDelivery === true);
  const completenessPct = required.length
    ? Math.round((obtained.length / required.length) * 10000) / 100
    : 100;
  return {
    kind,
    required: [...required],
    obtained,
    missing,
    blockingWorks,
    blockingDelivery,
    completenessPct,
    worksDrawAllowed: blockingWorks.length === 0,
  };
}

// ---------------------------------------------------------------------
//  B. Structure du crédit promoteur marocain
// ---------------------------------------------------------------------

export interface FacilityNatureDef {
  value: string;
  label: string;
  /** Le déblocage exige une situation de travaux visée (architecte / BET). */
  requiresWorksCertificate: boolean;
  /** Quotité de financement usuelle (indicative, paramétrable). */
  typicalQuotity?: number;
  note?: string;
}

/**
 * Natures de concours du crédit promoteur au Maroc. L'avance sur foncier est
 * décaissée en une fois contre inscription hypothécaire ; le crédit
 * d'accompagnement est décaissé PAR TRANCHES contre situation de travaux visée
 * par l'architecte et/ou le BET — contrôle absent jusqu'ici de l'outil.
 */
export const FACILITY_NATURES: readonly FacilityNatureDef[] = [
  {
    value: "avance_foncier",
    label: "Avance sur acquisition du foncier",
    requiresWorksCertificate: false,
    typicalQuotity: 0.6,
    note: "Décaissée contre inscription hypothécaire de 1er rang sur le terrain.",
  },
  {
    value: "credit_accompagnement",
    label: "Crédit d'accompagnement / de construction",
    requiresWorksCertificate: true,
    typicalQuotity: 0.7,
    note: "Décaissé par tranches contre situation de travaux visée (architecte / BET).",
  },
  {
    value: "credit_amenagement",
    label: "Crédit d'aménagement (lotissement / VRD)",
    requiresWorksCertificate: true,
    typicalQuotity: 0.7,
    note: "Décaissé contre avancement des travaux de viabilisation.",
  },
  {
    value: "credit_in_fine",
    label: "Crédit in fine (remboursement du principal au terme)",
    requiresWorksCertificate: false,
    note: "Suivi spécifique du non-remboursement au terme (1/W art.10-12).",
  },
  {
    value: "caution_marche",
    label: "Caution / engagement par signature",
    requiresWorksCertificate: false,
    note: "Hors bilan ; converti en exposition via le CCF.",
  },
] as const;

export const FACILITY_NATURE_DEFS = new Map(FACILITY_NATURES.map((f) => [f.value, f]));

export interface DrawRequestView {
  /** Nature du concours tiré. */
  facilityNature: string;
  amount: number;
  /** Une situation de travaux visée par l'architecte/BET est-elle produite ? */
  worksCertificateProvided?: boolean;
  /** Avancement physique certifié couvert par la situation (0..100). */
  certifiedProgressPct?: number;
}

export interface DrawControlResult {
  allowed: boolean;
  reasons: string[];
}

/**
 * Contrôle d'un déblocage au regard de la pratique marocaine : un tirage sur
 * crédit d'accompagnement/aménagement exige une situation de travaux visée, et
 * la chaîne d'autorisations ne doit pas présenter de verrou de travaux ouvert.
 */
export function controlDraw(
  draw: DrawRequestView,
  auth: AuthorizationAssessment,
  natures: ReadonlyMap<string, FacilityNatureDef> = FACILITY_NATURE_DEFS,
): DrawControlResult {
  const reasons: string[] = [];
  const def = natures.get(draw.facilityNature);

  if (!auth.worksDrawAllowed) {
    reasons.push(
      `Autorisation(s) manquante(s) indispensable(s) aux travaux : ${auth.blockingWorks.map((a) => a.label).join(", ")}.`,
    );
  }
  if (def?.requiresWorksCertificate && draw.worksCertificateProvided !== true) {
    reasons.push(
      `Situation de travaux visée (architecte / BET) requise pour un tirage « ${def.label} ».`,
    );
  }
  if (draw.amount <= 0) reasons.push("Montant de tirage invalide.");

  return { allowed: reasons.length === 0, reasons };
}

// ---------------------------------------------------------------------
//  C. Financement de l'acquéreur (liquidité des ventes)
// ---------------------------------------------------------------------

export interface BuyerFinancingDef {
  value: string;
  label: string;
  /** Degré de sécurisation de l'encaissement (0..1) — pondère les préventes. */
  securityFactor: number;
  note?: string;
}

/**
 * Statuts de financement de l'acquéreur. Le diagnostic rappelle qu'« une
 * réservation avec demande de crédit non instruite ne doit pas avoir la même
 * valeur de liquidité qu'un acte dont le financement est disponible ».
 * Les facteurs sont des points de départ à calibrer.
 */
export const BUYER_FINANCING_STATUSES: readonly BuyerFinancingDef[] = [
  { value: "fonds_propres", label: "Autofinancement (fonds propres acquéreur)", securityFactor: 1.0 },
  { value: "credit_debloque", label: "Crédit acquéreur débloqué", securityFactor: 1.0 },
  { value: "credit_accorde", label: "Crédit accordé (accord de principe / offre)", securityFactor: 0.8 },
  { value: "credit_en_cours", label: "Demande de crédit en cours d'instruction", securityFactor: 0.4 },
  { value: "credit_refuse", label: "Crédit refusé", securityFactor: 0.0 },
  { value: "non_instruit", label: "Financement non instruit", securityFactor: 0.2 },
] as const;

export const BUYER_FINANCING_DEFS = new Map(BUYER_FINANCING_STATUSES.map((b) => [b.value, b]));

/**
 * Dispositifs publics d'appui à l'acquisition. Les montants et conditions
 * relèvent d'un référentiel DATÉ à maintenir avec le juridique : ils ne sont
 * pas figés ici pour éviter toute péremption.
 */
export const BUYER_AID_SCHEMES: readonly { value: string; label: string; note: string }[] = [
  {
    value: "aide_directe_logement",
    label: "Aide directe au logement",
    note: "Programme d'aide à l'acquisition : éligibilité au niveau du bénéficiaire ET du bien ; montants et conditions selon le référentiel daté en vigueur.",
  },
  {
    value: "fogarim",
    label: "FOGARIM (garantie revenus irréguliers)",
    note: "Garantie de l'État couvrant le crédit des ménages à revenus irréguliers.",
  },
  {
    value: "damane_assakane",
    label: "Damane Assakane",
    note: "Dispositif de garantie de l'accession à la propriété.",
  },
  { value: "aucun", label: "Aucun dispositif", note: "" },
] as const;

export interface BuyerBackedUnitView {
  /** Prix contractuel du lot. */
  price: number;
  /** Statut de financement de l'acquéreur. */
  financingStatus: string;
  /** Le lot fait-il l'objet d'un engagement juridique (contrat préliminaire) ? */
  contractSecured?: boolean;
}

export interface SecuredSalesResult {
  /** Chiffre d'affaires brut des lots engagés. */
  grossCommitted: number;
  /** Chiffre d'affaires pondéré par la sécurisation du financement acquéreur. */
  securedRevenue: number;
  /** Taux de sécurisation (securedRevenue / grossCommitted). */
  securityRatePct: number;
  /** Nombre de lots dont le financement acquéreur n'est pas instruit/refusé. */
  atRiskUnits: number;
}

/**
 * Convertit un carnet de réservations en « ventes sécurisées » en pondérant par
 * la solidité du financement de l'acquéreur. Un lot sans engagement juridique
 * n'est jamais compté comme sécurisé.
 */
export function computeSecuredSales(
  units: BuyerBackedUnitView[],
  financing: ReadonlyMap<string, BuyerFinancingDef> = BUYER_FINANCING_DEFS,
): SecuredSalesResult {
  let grossCommitted = 0;
  let securedRevenue = 0;
  let atRiskUnits = 0;
  for (const u of units) {
    if (u.contractSecured === false) continue;
    const def = financing.get(u.financingStatus);
    const factor = def?.securityFactor ?? 0.2;
    grossCommitted += u.price;
    securedRevenue += u.price * factor;
    if (factor <= 0.4) atRiskUnits += 1;
  }
  const round2 = (v: number) => Math.round(v * 100) / 100;
  return {
    grossCommitted: round2(grossCommitted),
    securedRevenue: round2(securedRevenue),
    securityRatePct: grossCommitted > 0 ? round2((securedRevenue / grossCommitted) * 100) : 0,
    atRiskUnits,
  };
}

// ---------------------------------------------------------------------
//  D. Dérivation des entrées de scoring alignées Maroc
// ---------------------------------------------------------------------

export interface MoroccoSignalsInput {
  kind: ProgramKind;
  authorizations: AuthorizationStatusView[];
  units: (BuyerBackedUnitView & { sold?: boolean })[];
  /** Quotité de désengagement convenue (0..1), si fixée. */
  releaseQuotity?: number | null;
  /** Encours de crédit adossé au programme (MAD). */
  outstandingDebt?: number | null;
  /** Valeur commercialisable totale du programme (MAD). */
  totalSaleableValue?: number | null;
}

export interface MoroccoDerivedInputs {
  /** Complétude de la chaîne d'autorisations (%). */
  authorization_completeness_pct: number;
  /** Un verrou d'autorisation indispensable aux travaux est ouvert. */
  works_authorization_blocked: boolean;
  /** Taux de ventes sécurisées pondéré par le financement acquéreur (%). */
  secured_sales_rate?: number;
  /** Part significative d'acquéreurs sans financement instruit. */
  buyers_financing_at_risk?: boolean;
  /** Écart quotité appliquée − quotité d'équilibre, en points. */
  release_quotity_gap_pts?: number;
  /** Quotité de désengagement sous-tarifée. */
  release_underpriced?: boolean;
}

/**
 * Dérive les entrées de scoring propres à la pratique marocaine depuis les
 * données de suivi. Ne renvoie que les clés CALCULABLES : une clé absente
 * reste absente (la saisie manuelle demeure maîtresse), conformément à
 * l'invariant « une omission ne doit jamais améliorer la décision ».
 */
export interface MoroccoReferentials {
  chain?: readonly AuthorizationDef[];
  financing?: ReadonlyMap<string, BuyerFinancingDef>;
  natures?: ReadonlyMap<string, FacilityNatureDef>;
}

export function deriveMoroccoInputs(
  i: MoroccoSignalsInput,
  refs: MoroccoReferentials = {},
): MoroccoDerivedInputs {
  const round2 = (v: number) => Math.round(v * 100) / 100;
  const auth = assessAuthorizations(i.kind, i.authorizations, refs.chain ?? AUTHORIZATION_CHAIN);

  const out: MoroccoDerivedInputs = {
    authorization_completeness_pct: auth.completenessPct,
    works_authorization_blocked: !auth.worksDrawAllowed,
  };

  // Ventes sécurisées : seulement si au moins un lot porte un statut de
  // financement renseigné (sinon la mesure n'aurait aucun sens).
  const withFinancing = i.units.filter((u) => !!u.financingStatus);
  if (withFinancing.length > 0) {
    const secured = computeSecuredSales(withFinancing, refs.financing ?? BUYER_FINANCING_DEFS);
    const totalValue =
      i.totalSaleableValue && i.totalSaleableValue > 0
        ? i.totalSaleableValue
        : i.units.reduce((s, u) => s + (u.price || 0), 0);
    if (totalValue > 0) {
      out.secured_sales_rate = round2((secured.securedRevenue / totalValue) * 100);
    }
    out.buyers_financing_at_risk =
      secured.grossCommitted > 0 &&
      secured.atRiskUnits / withFinancing.length >= 0.4;
  }

  // Quotité de désengagement vs équilibre.
  const debt = i.outstandingDebt ?? 0;
  const value =
    i.totalSaleableValue && i.totalSaleableValue > 0
      ? i.totalSaleableValue
      : i.units.reduce((s, u) => s + (u.price || 0), 0);
  if (i.releaseQuotity != null && debt > 0 && value > 0) {
    const breakEven = debt / value;
    const gapPts = round2((i.releaseQuotity - breakEven) * 100);
    out.release_quotity_gap_pts = gapPts;
    out.release_underpriced = gapPts < 0;
  }

  return out;
}
