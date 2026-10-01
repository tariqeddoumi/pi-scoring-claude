// =====================================================================
//  Modèle PI_PROMOTION v5.0.0 — régionalité, tranche financée, programme
//  mixte, équipements exigés, suivi des déblocages (diagnostic du
//  1er octobre 2026).
//
//  Source : prisma/models/PI_PROMOTION_v5.0.0.json (construit depuis la v4
//  par prisma/models/derive_v5_from_v4.py, puis publié en base), converti par
//  la même fonction que le chargement en base.
// =====================================================================

import snapshot from "../../../prisma/models/PI_PROMOTION_v5.0.0.json";
import { snapshotToConfig, type ModelSnapshot } from "../modelSnapshot";
import type { ScoringModelConfig } from "../types";

export const PROMOTION_MODEL_V5_SNAPSHOT = snapshot as ModelSnapshot;

export const PROMOTION_SCORING_MODEL_V5: ScoringModelConfig = snapshotToConfig(PROMOTION_MODEL_V5_SNAPSHOT);
