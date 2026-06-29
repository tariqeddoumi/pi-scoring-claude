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

/** Tous les référentiels exposés (utile pour un futur écran d'administration). */
export const REFERENTIELS = {
  SEGMENTS, ZONES, ASSET_TYPES, PROJECT_TYPES, PROJECT_STATUSES,
  SALE_MODES, STANDINGS, UNIT_TYPES, UNIT_STATUSES, TRANCHE_STATUSES,
} as const;
