// =====================================================================
//  coreBankingProvider.ts — Connecteur SI bancaire (T24 / Evolan).
//  SERVER-ONLY. Implémentation REST générique configurée par variables
//  d'environnement (le SI expose un endpoint de situation par dossier) :
//
//    CORE_BANKING_PROVIDER = T24 | EVOLAN   (nom affiché / traçé)
//    CORE_BANKING_API_URL  = https://…      (base URL du middleware d'accès)
//    CORE_BANKING_API_KEY  = …              (jeton Bearer)
//
//  Contrat attendu : GET {API_URL}/dossiers/{coreBankingRef}/snapshot
//  → JSON conforme à CoreBankingSnapshotSchema (cf. lib/domain/coreBanking.ts
//  et docs/INTEGRATION-SI.md). Sans configuration : erreur claire — la saisie
//  manuelle et le journal d'événements restent la source.
// =====================================================================

import {
  CoreBankingSnapshotSchema,
  type CoreBankingProvider,
  type CoreBankingSnapshot,
} from "@/lib/domain/coreBanking";

const providerName = () => process.env.CORE_BANKING_PROVIDER?.trim() || "SI";
const apiUrl = () => process.env.CORE_BANKING_API_URL?.trim();
const apiKey = () => process.env.CORE_BANKING_API_KEY?.trim();

export const coreBankingProvider: CoreBankingProvider = {
  get name() {
    return providerName();
  },
  isConfigured() {
    return Boolean(apiUrl() && apiKey());
  },
  async fetchSnapshot(coreBankingRef: string): Promise<CoreBankingSnapshot> {
    const base = apiUrl();
    if (!base || !apiKey()) {
      throw new Error(
        "Connecteur SI non configuré (CORE_BANKING_API_URL / CORE_BANKING_API_KEY). " +
          "Renseignez la configuration ou continuez en saisie manuelle.",
      );
    }
    const url = `${base.replace(/\/$/, "")}/dossiers/${encodeURIComponent(coreBankingRef)}/snapshot`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey()}`, Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`SI ${providerName()} : réponse ${res.status} pour le dossier ${coreBankingRef}.`);
    }
    const parsed = CoreBankingSnapshotSchema.safeParse(await res.json());
    if (!parsed.success) {
      throw new Error(`SI ${providerName()} : réponse non conforme au contrat (voir docs/INTEGRATION-SI.md).`);
    }
    return parsed.data;
  },
};
