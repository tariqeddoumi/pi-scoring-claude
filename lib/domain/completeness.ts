// =====================================================================
//  completeness.ts — Complétude de la saisie du dossier de scoring.
//  Mesure, à partir des étapes du wizard et des inputs présents, le taux de
//  remplissage global et par étape, et signale les champs CRITIQUES manquants
//  (ceux sans lesquels la classification n'est pas fiable — cf. 1/W §6.2).
//  Sert de jauge « dossier complet à X % » pour guider le chargé d'affaires
//  avant soumission. Logique PURE et testable.
// =====================================================================

export interface StepDef {
  id: string;
  title: string;
  fields: { key: string }[];
}

/** Champs critiques par défaut (absence bloquante pour la classification). */
export const DEFAULT_CRITICAL_KEYS = ["dpd_days"];

export interface StepCompleteness {
  id: string;
  title: string;
  filled: number;
  total: number;
  missingKeys: string[];
}

export interface Completeness {
  filled: number;
  total: number;
  pct: number; // 0..100, arrondi
  steps: StepCompleteness[];
  missingCritical: string[];
  complete: boolean;
}

function isFilled(v: unknown): boolean {
  return v !== null && v !== undefined && v !== "";
}

/** Complétude de la saisie : global, par étape, et champs critiques manquants. */
export function computeCompleteness(
  steps: StepDef[],
  inputs: Record<string, unknown>,
  criticalKeys: string[] = DEFAULT_CRITICAL_KEYS,
): Completeness {
  const stepResults: StepCompleteness[] = steps.map((s) => {
    const missingKeys = s.fields.filter((f) => !isFilled(inputs[f.key])).map((f) => f.key);
    return {
      id: s.id,
      title: s.title,
      filled: s.fields.length - missingKeys.length,
      total: s.fields.length,
      missingKeys,
    };
  });

  const total = stepResults.reduce((n, s) => n + s.total, 0);
  const filled = stepResults.reduce((n, s) => n + s.filled, 0);
  const missingCritical = criticalKeys.filter((k) => !isFilled(inputs[k]));

  return {
    filled,
    total,
    pct: total > 0 ? Math.round((filled / total) * 100) : 100,
    steps: stepResults,
    missingCritical,
    complete: total > 0 && filled === total,
  };
}
