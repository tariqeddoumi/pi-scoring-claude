import { describe, it, expect } from "vitest";
import {
  assessAuthorizations, controlDraw, computeSecuredSales,
  AUTHORIZATION_CHAIN, FACILITY_NATURE_DEFS, BUYER_FINANCING_DEFS, deriveMoroccoInputs,
} from "@/lib/domain/morocco";

describe("Chaîne d'autorisations marocaine", () => {
  it("exige l'autorisation de lotir pour un lotissement, le permis de construire pour une construction", () => {
    const lot = assessAuthorizations("LOTISSEMENT", []);
    expect(lot.required.map((a) => a.code)).toContain("autorisation_lotir");
    expect(lot.required.map((a) => a.code)).not.toContain("permis_construire");

    const cons = assessAuthorizations("CONSTRUCTION", []);
    expect(cons.required.map((a) => a.code)).toContain("permis_construire");
    expect(cons.required.map((a) => a.code)).not.toContain("autorisation_lotir");

    const mixte = assessAuthorizations("MIXTE", []);
    expect(mixte.required.map((a) => a.code)).toEqual(
      expect.arrayContaining(["autorisation_lotir", "permis_construire", "autorisation_morcellement"]),
    );
  });

  it("bloque le décaissement des travaux tant qu'un permis indispensable manque", () => {
    const a = assessAuthorizations("CONSTRUCTION", [
      { code: "note_renseignement", obtained: true },
      { code: "titre_foncier_purge", obtained: true },
    ]);
    expect(a.worksDrawAllowed).toBe(false);
    expect(a.blockingWorks.map((x) => x.code)).toContain("permis_construire");
  });

  it("autorise le décaissement quand les verrous de travaux sont levés", () => {
    const a = assessAuthorizations("CONSTRUCTION", [
      { code: "titre_foncier_purge", obtained: true },
      { code: "permis_construire", obtained: true },
    ]);
    expect(a.worksDrawAllowed).toBe(true);
    // La livraison reste conditionnée (permis d'habiter, conformité…).
    expect(a.blockingDelivery.length).toBeGreaterThan(0);
    expect(a.completenessPct).toBeGreaterThan(0);
    expect(a.completenessPct).toBeLessThan(100);
  });

  it("chaque pièce de la chaîne porte un jalon de levée", () => {
    for (const a of AUTHORIZATION_CHAIN) {
      expect(["ETUDE", "OCTROI", "SIGNATURE", "TIRAGE"]).toContain(a.stage);
    }
  });
});

describe("Structure du crédit promoteur (déblocages)", () => {
  const authOk = assessAuthorizations("CONSTRUCTION", [
    { code: "titre_foncier_purge", obtained: true },
    { code: "permis_construire", obtained: true },
  ]);

  it("refuse un tirage d'accompagnement sans situation de travaux visée", () => {
    const r = controlDraw({ facilityNature: "credit_accompagnement", amount: 1000 }, authOk);
    expect(r.allowed).toBe(false);
    expect(r.reasons.join(" ")).toContain("architecte");
  });

  it("accepte un tirage d'accompagnement avec situation visée", () => {
    const r = controlDraw(
      { facilityNature: "credit_accompagnement", amount: 1000, worksCertificateProvided: true },
      authOk,
    );
    expect(r.allowed).toBe(true);
  });

  it("l'avance sur foncier n'exige pas de situation de travaux", () => {
    expect(FACILITY_NATURE_DEFS.get("avance_foncier")?.requiresWorksCertificate).toBe(false);
    const r = controlDraw({ facilityNature: "avance_foncier", amount: 500 }, authOk);
    expect(r.allowed).toBe(true);
  });

  it("refuse tout tirage si un verrou d'autorisation de travaux est ouvert", () => {
    const authKo = assessAuthorizations("CONSTRUCTION", []);
    const r = controlDraw(
      { facilityNature: "credit_accompagnement", amount: 1000, worksCertificateProvided: true },
      authKo,
    );
    expect(r.allowed).toBe(false);
  });
});

describe("Solvabilité acquéreur et ventes sécurisées", () => {
  it("pondère les préventes par la solidité du financement acquéreur", () => {
    const r = computeSecuredSales([
      { price: 100, financingStatus: "credit_debloque" },   // ×1,0
      { price: 100, financingStatus: "credit_en_cours" },   // ×0,4
      { price: 100, financingStatus: "credit_refuse" },     // ×0,0
    ]);
    expect(r.grossCommitted).toBe(300);
    expect(r.securedRevenue).toBe(140);
    expect(r.securityRatePct).toBeCloseTo(46.67, 1);
    expect(r.atRiskUnits).toBe(2); // en cours + refusé
  });

  it("exclut les lots sans engagement juridique", () => {
    const r = computeSecuredSales([
      { price: 100, financingStatus: "credit_debloque", contractSecured: false },
      { price: 100, financingStatus: "credit_debloque", contractSecured: true },
    ]);
    expect(r.grossCommitted).toBe(100);
  });

  it("une réservation non instruite vaut moins qu'un acte financé", () => {
    const acte = BUYER_FINANCING_DEFS.get("credit_debloque")!.securityFactor;
    const reserv = BUYER_FINANCING_DEFS.get("non_instruit")!.securityFactor;
    expect(reserv).toBeLessThan(acte);
  });
});

describe("Dérivation des entrées de scoring alignées Maroc", () => {
  it("dérive la complétude des autorisations et le verrou de travaux", () => {
    const d = deriveMoroccoInputs({
      kind: "CONSTRUCTION",
      authorizations: [{ code: "titre_foncier_purge", obtained: true }],
      units: [],
    });
    expect(d.authorization_completeness_pct).toBeGreaterThan(0);
    expect(d.works_authorization_blocked).toBe(true); // permis de construire manquant
  });

  it("ne produit pas de taux de ventes sécurisées sans statut de financement", () => {
    const d = deriveMoroccoInputs({
      kind: "CONSTRUCTION",
      authorizations: [],
      units: [{ price: 100, financingStatus: "" }],
    });
    // Clé absente plutôt que valeur inventée : une omission ne doit pas
    // améliorer la décision, mais on n'invente pas non plus une mesure.
    expect(d.secured_sales_rate).toBeUndefined();
  });

  it("dérive le taux de ventes sécurisées quand le financement est renseigné", () => {
    const d = deriveMoroccoInputs({
      kind: "CONSTRUCTION",
      authorizations: [],
      units: [
        { price: 100, financingStatus: "credit_debloque" },
        { price: 100, financingStatus: "credit_refuse" },
      ],
      totalSaleableValue: 200,
    });
    expect(d.secured_sales_rate).toBe(50); // 100 sécurisé / 200
  });

  it("détecte une quotité de désengagement sous-tarifée", () => {
    const d = deriveMoroccoInputs({
      kind: "CONSTRUCTION",
      authorizations: [],
      units: [],
      releaseQuotity: 0.5,
      outstandingDebt: 800,
      totalSaleableValue: 1000, // équilibre = 80 %
    });
    expect(d.release_quotity_gap_pts).toBe(-30);
    expect(d.release_underpriced).toBe(true);
  });
});
