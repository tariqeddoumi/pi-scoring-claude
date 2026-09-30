// =====================================================================
//  Modèle PI_PROMOTION v4.0.0 — version publiée en production.
//
//  Source : instantané de la base (prisma/models/PI_PROMOTION_v4.0.0.json),
//  converti par la même fonction que le chargement en base. Sert de référence
//  aux tests, au seed d'un nouvel environnement et au contrôle d'alignement
//  de l'application (saisie, libellés, import) avec le modèle publié.
// =====================================================================

import snapshot from "../../../prisma/models/PI_PROMOTION_v4.0.0.json";
import { snapshotToConfig, type ModelSnapshot } from "../modelSnapshot";
import type { ScoringModelConfig } from "../types";

export const PROMOTION_MODEL_V4_SNAPSHOT = snapshot as ModelSnapshot;

export const PROMOTION_SCORING_MODEL_V4: ScoringModelConfig = snapshotToConfig(PROMOTION_MODEL_V4_SNAPSHOT);
