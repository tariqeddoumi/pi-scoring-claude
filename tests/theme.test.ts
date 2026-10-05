import { describe, it, expect } from "vitest";
import { DARK_SHADE, PALETTE_FAMILIES, SHADES, THEME_TOKENS, paletteColor, hexToChannels, themeVariables, type PaletteFamily, type Shade, type Theme } from "@/lib/themePalette";
import { parseThemePreference, themeAttribute } from "@/lib/theme";
import { TONE } from "@/lib/tones";

// Contraste WCAG 2.1 entre deux couleurs « r g b ».
const rgbOfHex = (hex: string) => hexToChannels(hex).split(" ").map(Number) as [number, number, number];
function rgbOfHsl(hsl: string): [number, number, number] {
  const [h, s, l] = hsl.replace(/%/g, "").split(" ").map(Number) as [number, number, number];
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => { const k = (n + h / 30) % 12; return Math.round(255 * (l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
  return [f(0), f(8), f(4)];
}
const luminance = ([r, g, b]: number[]) => {
  const c = [r!, g!, b!].map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
};
const contrast = (a: number[], b: number[]) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m) as [number, number];
  return (x + 0.05) / (y + 0.05);
};
const token = (t: Theme, k: keyof (typeof THEME_TOKENS)["light"]) => rgbOfHsl(THEME_TOKENS[t][k]);
const shade = (t: Theme, f: PaletteFamily, s: Shade) => rgbOfHex(paletteColor(t, f, s));
const THEMES: Theme[] = ["light", "dark"];

describe("Thèmes clair et sombre", () => {
  it("définit les mêmes variables dans les deux thèmes", () => {
    expect(Object.keys(themeVariables("dark")).sort()).toEqual(Object.keys(themeVariables("light")).sort());
    expect(Object.keys(themeVariables("light"))).toHaveLength(Object.keys(THEME_TOKENS.light).length + PALETTE_FAMILIES.length * SHADES.length);
  });

  it("inverse l'échelle des teintes en sombre (fonds clairs → foncés, textes foncés → clairs)", () => {
    for (const s of SHADES) expect(SHADES).toContain(DARK_SHADE[s]);
    for (const f of PALETTE_FAMILIES) {
      expect(luminance(shade("dark", f, 100))).toBeLessThan(luminance(shade("dark", f, 800)));
      expect(luminance(shade("light", f, 100))).toBeGreaterThan(luminance(shade("light", f, 800)));
    }
  });

  it.each(THEMES)("jetons lisibles en thème %s (contraste ≥ 4,5:1)", (t) => {
    for (const bg of ["background", "muted"] as const) {
      expect(contrast(token(t, "foreground"), token(t, bg))).toBeGreaterThanOrEqual(7);
      expect(contrast(token(t, "muted-foreground"), token(t, bg))).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(token(t, "primary"), token(t, "background"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token(t, "primary-foreground"), token(t, "primary"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token(t, "danger-foreground"), token(t, "danger"))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(THEMES)("tons sémantiques (badges, bandeaux) lisibles en thème %s", (t) => {
    for (const [name, cls] of Object.entries(TONE)) {
      const bg = /bg-([a-z]+)-(\d+)/.exec(cls)!;
      const fg = /text-([a-z]+)-(\d+)/.exec(cls)!;
      const ratio = contrast(shade(t, fg[1] as PaletteFamily, Number(fg[2]) as Shade), shade(t, bg[1] as PaletteFamily, Number(bg[2]) as Shade));
      expect(ratio, `${name} (${t})`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("textes d'erreur et de mise en garde lisibles sur fond de carte dans les deux thèmes", () => {
    for (const t of THEMES) {
      for (const f of ["red", "amber", "emerald", "orange"] as const) {
        expect(contrast(shade(t, f, 800), shade(t, f, 50)), `${f}-800/50 ${t}`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(shade(t, f, 700), token(t, "background")), `${f}-700 ${t}`).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrast(shade(t, "red", 600), token(t, "background")), `red-600 ${t}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("préférence : système par défaut, choix explicite conservé", () => {
    expect(parseThemePreference(undefined)).toBe("system");
    expect(parseThemePreference("violet")).toBe("system");
    expect(parseThemePreference("dark")).toBe("dark");
    expect(themeAttribute("system")).toBeUndefined();
    expect(themeAttribute("light")).toBe("light");
  });
});
