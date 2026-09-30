import { describe, it, expect } from "vitest";
import { loadMoroccoReferentials } from "@/server/services/referentialLoader";
import { assessAuthorizations, computeSecuredSales } from "@/lib/domain/morocco";

/** Faux client Prisma : seule `referentialItem.findMany` est utilisée. */
const fakeDb = (rows: unknown[] | Error) =>
  ({
    referentialItem: {
      findMany: async () => {
        if (rows instanceof Error) throw rows;
        return rows;
      },
    },
  }) as never;

describe("Référentiels administrables (paramétrage sans redéploiement)", () => {
  it("retombe sur les valeurs par défaut du code quand la base est vide", async () => {
    const r = await loadMoroccoReferentials(fakeDb([]));
    expect(r.fromDatabase).toBe(false);
    expect(r.chain.length).toBeGreaterThan(0);
    expect(r.financing.get("credit_debloque")?.securityFactor).toBe(1);
    expect(r.natures.get("credit_accompagnement")?.requiresWorksCertificate).toBe(true);
  });

  it("reste fonctionnel si la table est inaccessible", async () => {
    const r = await loadMoroccoReferentials(fakeDb(new Error("table absente")));
    expect(r.fromDatabase).toBe(false);
    expect(r.chain.length).toBeGreaterThan(0);
  });

  it("la base prend le pas sur les défauts du code", async () => {
    const r = await loadMoroccoReferentials(
      fakeDb([
        {
          kind: "AUTHORIZATION", code: "autorisation_speciale", label: "Autorisation spéciale",
          orderIndex: 0, note: null,
          config: { stage: "TIRAGE", appliesTo: ["CONSTRUCTION"], blocksWorks: true },
        },
        {
          kind: "BUYER_FINANCING", code: "credit_debloque", label: "Crédit débloqué",
          orderIndex: 0, note: null, config: { securityFactor: 0.5 },
        },
      ]),
    );
    expect(r.fromDatabase).toBe(true);
    // La chaîne ne contient plus que la pièce paramétrée.
    expect(r.chain.map((a) => a.code)).toEqual(["autorisation_speciale"]);
    // Le facteur recalibré remplace celui du code.
    expect(r.financing.get("credit_debloque")?.securityFactor).toBe(0.5);
  });

  it("un facteur de sécurisation recalibré change le calcul des ventes sécurisées", async () => {
    const r = await loadMoroccoReferentials(
      fakeDb([{ kind: "BUYER_FINANCING", code: "credit_accorde", label: "Crédit accordé", orderIndex: 0, note: null, config: { securityFactor: 0.5 } }]),
    );
    const out = computeSecuredSales([{ price: 1000, financingStatus: "credit_accorde" }], r.financing);
    expect(out.securedRevenue).toBe(500); // 0,5 au lieu de 0,8 par défaut
  });

  it("une chaîne paramétrée pilote les verrous de tirage", async () => {
    const r = await loadMoroccoReferentials(
      fakeDb([{ kind: "AUTHORIZATION", code: "piece_locale", label: "Pièce locale", orderIndex: 0, note: null,
        config: { stage: "TIRAGE", appliesTo: ["CONSTRUCTION"], blocksWorks: true } }]),
    );
    const a = assessAuthorizations("CONSTRUCTION", [], r.chain);
    expect(a.worksDrawAllowed).toBe(false);
    expect(a.blockingWorks.map((x) => x.code)).toEqual(["piece_locale"]);
    const b = assessAuthorizations("CONSTRUCTION", [{ code: "piece_locale", obtained: true }], r.chain);
    expect(b.worksDrawAllowed).toBe(true);
    expect(b.completenessPct).toBe(100);
  });

  it("ignore un paramétrage invalide sans planter", async () => {
    const r = await loadMoroccoReferentials(
      fakeDb([{ kind: "BUYER_FINANCING", code: "bizarre", label: "Bizarre", orderIndex: 0, note: null, config: "pas-un-objet" }]),
    );
    expect(r.financing.get("bizarre")?.securityFactor).toBe(0.2); // repli prudent
  });
});

describe("Politique de division des risques (référentiel PRUDENTIAL_LIMIT)", () => {
  it("n'invente aucun défaut : sans fonds propres, pas de contrôle", async () => {
    const { parseDivisionPolicy } = await import("@/server/services/referentialLoader");
    expect(parseDivisionPolicy({})).toBeNull();
    expect(parseDivisionPolicy({ ownFunds: 0 })).toBeNull();
    expect(parseDivisionPolicy({ ownFunds: "15e9" })).toBeNull();
  });

  it("lit les fonds propres et les taux, en ignorant les taux hors [0 ; 1]", async () => {
    const { parseDivisionPolicy } = await import("@/server/services/referentialLoader");
    expect(parseDivisionPolicy({ ownFunds: 15e9, limitPct: 0.2, largeExposurePct: 5, netOfGuarantees: true })).toEqual({
      ownFunds: 15e9, limitPct: 0.2, largeExposurePct: undefined, netOfGuarantees: true,
    });
  });
});
