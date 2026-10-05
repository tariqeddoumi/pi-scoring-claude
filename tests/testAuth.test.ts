import { describe, it, expect } from "vitest";
import { testAuthEmail } from "@/lib/testAuth";

describe("Identité de test (tests de bout en bout)", () => {
  it("n'est jamais active en production", () => {
    expect(testAuthEmail(null, { NODE_ENV: "production", E2E_AUTH_EMAIL: "analyst@bank.ma" })).toBeNull();
    expect(testAuthEmail("rm@bank.ma", { NODE_ENV: "production", E2E_AUTH_EMAIL: "analyst@bank.ma" })).toBeNull();
  });
  it("exige E2E_AUTH_EMAIL (adresse valide)", () => {
    expect(testAuthEmail(null, { NODE_ENV: "development" })).toBeNull();
    expect(testAuthEmail("rm@bank.ma", { NODE_ENV: "development", E2E_AUTH_EMAIL: "" })).toBeNull();
    expect(testAuthEmail(null, { NODE_ENV: "development", E2E_AUTH_EMAIL: "pas-une-adresse" })).toBeNull();
    expect(testAuthEmail(null, { NODE_ENV: "development", E2E_AUTH_EMAIL: " analyst@bank.ma " })).toBe("analyst@bank.ma");
  });
  it("permet de changer de profil par cookie, sous les mêmes conditions", () => {
    const env = { NODE_ENV: "test", E2E_AUTH_EMAIL: "analyst@bank.ma" };
    expect(testAuthEmail("rm@bank.ma", env)).toBe("rm@bank.ma");
    expect(testAuthEmail("n'importe quoi", env)).toBe("analyst@bank.ma");
  });
});
