// =====================================================================
//  referentiels.ts — SOURCE UNIQUE des listes de valeurs métier (référentiels)
//  utilisées par les formulaires (listes déroulantes), les libellés d'affichage
//  et la validation. Centralise ce qui était dispersé (clés d'ajustement du
//  modèle, maps de libellés dans les pages de suivi, énumérations Prisma) pour
//  rendre l'outil plus simple et plus paramétrable : un seul endroit à éditer.
//
//  Logique PURE (aucune dépendance) — importable côté client comme serveur.
// =====================================================================

export interface RefItem {
  value: string;
  label: string;
}

/** Construit une map code→libellé et un util `labelOf` à partir d'une liste. */
function indexed<T extends RefItem>(items: readonly T[]) {
  const map = new Map(items.map((i) => [i.value, i.label]));
  return {
    items,
    options: items.map((i) => ({ value: i.value, label: i.label })),
    labelOf: (code: string | null | undefined) => (code ? map.get(code) ?? code : "—"),
    has: (code: string) => map.has(code),
  };
}

// --- Segments commerciaux (alignés sur segmentAdjustments du modèle) --------
export const SEGMENTS = indexed([
  { value: "social", label: "Logement social" },
  { value: "intermediaire", label: "Logement intermédiaire" },
  { value: "moyen_haut", label: "Moyen-haut standing" },
  { value: "touristique", label: "Touristique / hôtelier" },
  { value: "bureaux", label: "Bureaux" },
  { value: "commerces", label: "Commerces" },
  { value: "villas", label: "Villas" },
] as const);

// --- Zones géographiques (alignées sur zoneAdjustments du modèle) -----------
export const ZONES = indexed([
  { value: "casa_centre", label: "Casablanca — centre" },
  { value: "casa_peripherie", label: "Casablanca — périphérie" },
  { value: "rabat_centre", label: "Rabat — centre" },
  { value: "rabat_peripherie", label: "Rabat — périphérie" },
  { value: "tanger", label: "Tanger" },
  { value: "marrakech", label: "Marrakech" },
  { value: "agadir", label: "Agadir" },
  { value: "fes_oriental", label: "Fès / Oriental" },
  { value: "regions_interieures", label: "Régions intérieures" },
] as const);

// --- Nature de l'actif (enum Prisma AssetType) ------------------------------
export const ASSET_TYPES = indexed([
  { value: "PROMOTION", label: "Promotion (vente)" },
  { value: "EXPLOITATION", label: "Exploitation / rapport (hôtel, bureaux loués…)" },
] as const);

// --- Type de projet (texte libre historiquement → liste normalisée) ---------
export const PROJECT_TYPES = indexed([
  { value: "residentiel", label: "Résidentiel" },
  { value: "mixte", label: "Mixte" },
  { value: "bureaux", label: "Bureaux" },
  { value: "commercial", label: "Commercial" },
  { value: "touristique", label: "Touristique" },
  { value: "lotissement", label: "Lotissement" },
  { value: "autre", label: "Autre" },
] as const);

// --- Statut du dossier projet -----------------------------------------------
export const PROJECT_STATUSES = indexed([
  { value: "PROSPECT", label: "Prospect" },
  { value: "MONTAGE", label: "En montage" },
  { value: "EN_COURS", label: "En cours" },
  { value: "LIVRE", label: "Livré" },
  { value: "CLOTURE", label: "Clôturé" },
  { value: "ABANDONNE", label: "Abandonné" },
] as const);

// --- Mode de vente (enum Prisma SaleMode) -----------------------------------
export const SALE_MODES = indexed([
  { value: "CLASSIC", label: "Vente classique" },
  { value: "VEFA", label: "VEFA (vente sur plan)" },
] as const);

// --- Standings (enum Prisma Standing) — sévérité croissante par rang --------
export const STANDINGS = indexed([
  { value: "TRES_HAUT", label: "Très haut standing" },
  { value: "HAUT", label: "Haut standing" },
  { value: "MOYEN_HAUT", label: "Moyen-haut standing" },
  { value: "MOYEN", label: "Moyen standing" },
  { value: "ECONOMIQUE", label: "Économique" },
  { value: "SOCIAL", label: "Social" },
] as const);

// --- Types de lot (enum Prisma UnitType) ------------------------------------
export const UNIT_TYPES = indexed([
  { value: "APPARTEMENT", label: "Appartement" },
  { value: "VILLA", label: "Villa" },
  { value: "COMMERCE", label: "Commerce" },
  { value: "BUREAU", label: "Bureau" },
  { value: "TERRAIN", label: "Terrain" },
  { value: "AUTRE", label: "Autre" },
] as const);

// --- Statuts de lot (enum Prisma UnitStatus) --------------------------------
export const UNIT_STATUSES = indexed([
  { value: "DISPONIBLE", label: "Disponible" },
  { value: "RESERVE", label: "Réservé" },
  { value: "COMPROMIS", label: "Compromis" },
  { value: "VENDU", label: "Vendu" },
  { value: "LIVRE", label: "Livré" },
  { value: "DESISTE", label: "Désisté" },
] as const);

// --- Statuts de tranche (enum Prisma TrancheStatus) -------------------------
export const TRANCHE_STATUSES = indexed([
  { value: "PLANIFIEE", label: "Planifiée" },
  { value: "EN_TRAVAUX", label: "En travaux" },
  { value: "LIVREE", label: "Livrée" },
  { value: "CLOTUREE", label: "Clôturée" },
] as const);

// --- Formes juridiques (signalétique promoteur) ------------------------------
export const LEGAL_FORMS = indexed([
  { value: "SARL", label: "SARL" },
  { value: "SARL_AU", label: "SARL AU" },
  { value: "SA", label: "SA" },
  { value: "SAS", label: "SAS" },
  { value: "SNC", label: "SNC" },
  { value: "SCI", label: "SCI" },
  { value: "GIE", label: "GIE" },
  { value: "PERSONNE_PHYSIQUE", label: "Personne physique" },
  { value: "AUTRE", label: "Autre" },
] as const);

// --- Statut foncier de l'assiette du projet ----------------------------------
export const LAND_STATUSES = indexed([
  { value: "titre_foncier", label: "Titré (titre foncier)" },
  { value: "en_cours_immatriculation", label: "En cours d'immatriculation" },
  { value: "melk", label: "Melk (non immatriculé)" },
  { value: "domanial", label: "Domanial / cession État" },
  { value: "collectif", label: "Terres collectives" },
  { value: "habous", label: "Habous" },
  { value: "autre", label: "Autre" },
] as const);

// --- Liens entre promoteurs (parties liées / effet groupe) --------------------
export const PROMOTER_LINK_TYPES = indexed([
  { value: "maison_mere", label: "Maison mère de" },
  { value: "filiale", label: "Filiale de" },
  { value: "actionnaire_commun", label: "Actionnaire commun" },
  { value: "dirigeant_commun", label: "Dirigeant commun" },
  { value: "caution_croisee", label: "Caution croisée" },
  { value: "partenaire_projet", label: "Partenaire de projet (co-promotion)" },
  { value: "lien_familial", label: "Lien familial entre dirigeants" },
  { value: "autre", label: "Autre lien" },
] as const);

// --- Journal d'événements projet ---------------------------------------------
// Chaque type porte une sévérité par défaut et un indicateur « matériel pour le
// scoring » (affectsScoring). Les événements matériels OUVERTS alimentent la
// classification 1/W/2025 (cf. lib/domain/eventSignals.ts) et rendent le score
// « à rafraîchir » (cf. lib/domain/reviewPolicy.ts).
export interface EventTypeDef extends RefItem {
  severity: "INFO" | "WARNING" | "CRITICAL";
  affectsScoring: boolean;
}

export const EVENT_TYPES_LIST: readonly EventTypeDef[] = [
  // Cycle financier
  { value: "deblocage", label: "Déblocage / tirage", severity: "INFO", affectsScoring: false },
  { value: "remboursement", label: "Remboursement", severity: "INFO", affectsScoring: false },
  { value: "incident_paiement", label: "Incident de paiement (impayé)", severity: "CRITICAL", affectsScoring: true },
  { value: "regularisation", label: "Régularisation d'impayé", severity: "INFO", affectsScoring: true },
  { value: "avenant_credit", label: "Avenant au crédit", severity: "WARNING", affectsScoring: true },
  { value: "restructuration", label: "Restructuration de la créance", severity: "CRITICAL", affectsScoring: true },
  // Chantier & autorisations
  { value: "arret_chantier", label: "Arrêt de chantier", severity: "CRITICAL", affectsScoring: true },
  { value: "reprise_chantier", label: "Reprise de chantier", severity: "INFO", affectsScoring: true },
  { value: "probleme_administratif", label: "Problème administratif / blocage autorisation", severity: "WARNING", affectsScoring: true },
  { value: "obtention_autorisation", label: "Obtention d'autorisation / permis", severity: "INFO", affectsScoring: false },
  { value: "reception_travaux", label: "Réception des travaux (tranche/projet)", severity: "INFO", affectsScoring: false },
  // Commercialisation
  { value: "lancement_commercialisation", label: "Lancement de la commercialisation", severity: "INFO", affectsScoring: false },
  { value: "evenement_commercial", label: "Événement commercial notable", severity: "INFO", affectsScoring: false },
  // Garanties & sûretés
  { value: "changement_garantie", label: "Constitution / changement de garantie", severity: "WARNING", affectsScoring: true },
  { value: "mainlevee", label: "Mainlevée (totale/partielle)", severity: "INFO", affectsScoring: false },
  // Juridique & signaux externes
  { value: "litige", label: "Litige / action en justice", severity: "CRITICAL", affectsScoring: true },
  { value: "saisie_atd", label: "Saisie-arrêt / ATD", severity: "CRITICAL", affectsScoring: true },
  { value: "redressement_judiciaire", label: "Redressement / liquidation judiciaire", severity: "CRITICAL", affectsScoring: true },
  { value: "info_negative_bureau", label: "Information négative Crédit Bureau / SCIP", severity: "WARNING", affectsScoring: true },
  { value: "changement_actionnariat", label: "Changement d'actionnariat / gouvernance", severity: "WARNING", affectsScoring: true },
  { value: "autre", label: "Autre événement", severity: "INFO", affectsScoring: false },
] as const;

export const EVENT_TYPES = indexed(EVENT_TYPES_LIST);
export const EVENT_TYPE_DEFS = new Map(EVENT_TYPES_LIST.map((e) => [e.value, e]));

export const EVENT_SEVERITIES = indexed([
  { value: "INFO", label: "Information" },
  { value: "WARNING", label: "Vigilance" },
  { value: "CRITICAL", label: "Critique" },
] as const);

/** Tous les référentiels exposés (utile pour un futur écran d'administration). */
export const REFERENTIELS = {
  SEGMENTS, ZONES, ASSET_TYPES, PROJECT_TYPES, PROJECT_STATUSES,
  SALE_MODES, STANDINGS, UNIT_TYPES, UNIT_STATUSES, TRANCHE_STATUSES,
  LEGAL_FORMS, LAND_STATUSES, PROMOTER_LINK_TYPES, EVENT_TYPES, EVENT_SEVERITIES,
} as const;
