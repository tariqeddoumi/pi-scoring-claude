import { describe, it, expect } from "vitest";
import { readActionErrors } from "@/components/form";

describe("Erreurs renvoyées par les actions serveur", () => {
  it("succès : aucune erreur", () => {
    expect(readActionErrors({ ok: true })).toEqual({ fieldErrors: {}, message: null });
    expect(readActionErrors(undefined)).toEqual({ fieldErrors: {}, message: null });
  });
  it("erreurs de validation par champ : message global explicite", () => {
    const r = readActionErrors({ ok: false, errors: { reference: ["Requis"], name: ["Trop court"], city: undefined } });
    expect(r.fieldErrors.reference).toEqual(["Requis"]);
    expect(r.message).toBe("2 champ(s) à corriger — voir les messages sous les champs.");
  });
  it("erreur métier ou d'autorisation : message de l'action", () => {
    expect(readActionErrors({ ok: false, error: "Accès refusé." }).message).toBe("Accès refusé.");
  });
});
