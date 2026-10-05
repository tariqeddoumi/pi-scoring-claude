import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Garde-fous des conventions d'interface (diagnostic design, priorité 2).
const ROOT = path.resolve(__dirname, "..");
function tsxFiles(dir: string): string[] {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) return tsxFiles(rel);
    return e.name.endsWith(".tsx") ? [rel] : [];
  });
}
const files = [...tsxFiles("app"), ...tsxFiles("components")].map((f) => ({ f, src: fs.readFileSync(path.join(ROOT, f), "utf8") }));

describe("Conventions d'interface", () => {
  it("aucune confirmation native du navigateur (utiliser ConfirmButton)", () => {
    const bad = files.filter(({ src }) => /(^|[^\w.])(window\.)?confirm\(/m.test(src)).map(({ f }) => f);
    expect(bad).toEqual([]);
  });
  it("aucun style de champ recopié (utiliser lib/formStyles ou components/form)", () => {
    // Un champ (input/select/textarea) qui porte directement la classe historique.
    const re = /<(input|select|textarea)[^>]*className="[^"]*rounded-md border border-border bg-background px-/;
    const bad = files.filter(({ src }) => re.test(src)).map(({ f }) => f);
    expect(bad).toEqual([]);
  });
});
