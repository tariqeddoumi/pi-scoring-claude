// Thèmes clair et sombre (utilisé par tailwind.config.ts et les tests ; pas par
// l'application à l'exécution). Toutes les couleurs passent par des variables
// CSS : le thème sombre redéfinit les variables, sans modifier les composants.
//  - Jetons de l'interface (fond, texte, bordure, primaire, danger) : valeurs
//    HSL choisies pour chaque thème.
//  - Palette Tailwind des tons sémantiques, badges et graphiques (red-100,
//    emerald-700…) : en sombre, l'échelle de chaque teinte est inversée — les
//    fonds clairs (50-300) deviennent foncés (950-700), les textes foncés
//    (700-950) deviennent clairs (300-50) ; les tons moyens (400-500) sont
//    conservés et le 600, trop sombre sur fond sombre, devient 400.

import colors from "tailwindcss/colors";

export const PALETTE_FAMILIES = [
  "slate", "gray", "red", "orange", "amber", "yellow", "lime", "green", "emerald",
  "teal", "cyan", "sky", "blue", "indigo", "violet", "purple", "pink", "rose",
] as const;
export type PaletteFamily = (typeof PALETTE_FAMILIES)[number];

export const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
export type Shade = (typeof SHADES)[number];

export const DARK_SHADE: Record<Shade, Shade> = {
  50: 950, 100: 900, 200: 800, 300: 700, 400: 400, 500: 500, 600: 400, 700: 300, 800: 200, 900: 100, 950: 50,
};

export type Theme = "light" | "dark";

/** Jetons de l'interface : canaux HSL (« h s% l% »). */
export const THEME_TOKENS: Record<Theme, Record<"background" | "foreground" | "muted" | "muted-foreground" | "border" | "primary" | "primary-foreground" | "danger" | "danger-foreground", string>> = {
  light: {
    background: "0 0% 100%",
    foreground: "222 47% 11%",
    muted: "210 40% 96%",
    "muted-foreground": "215 19% 40%",
    border: "214 32% 91%",
    primary: "221 83% 53%",
    "primary-foreground": "210 40% 98%",
    danger: "0 72% 51%",
    "danger-foreground": "0 0% 100%",
  },
  dark: {
    background: "222 40% 11%",
    foreground: "210 40% 96%",
    muted: "223 44% 7%",
    "muted-foreground": "215 20% 70%",
    border: "217 24% 22%",
    primary: "213 94% 68%",
    "primary-foreground": "222 47% 11%",
    danger: "0 91% 71%",
    "danger-foreground": "0 63% 15%",
  },
};

/** Code hexadécimal → canaux « r g b » (format des variables de palette). */
export function hexToChannels(hex: string): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => Number.parseInt(full.slice(i, i + 2), 16)).join(" ");
}

const paletteHex = (family: PaletteFamily, shade: Shade): string =>
  (colors as unknown as Record<PaletteFamily, Record<Shade, string>>)[family][shade];

/** Couleur effective d'une teinte de palette dans un thème (hexadécimal). */
export function paletteColor(theme: Theme, family: PaletteFamily, shade: Shade): string {
  return paletteHex(family, theme === "dark" ? DARK_SHADE[shade] : shade);
}

/** Variables CSS d'un thème : jetons et palette. */
export function themeVariables(theme: Theme): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(THEME_TOKENS[theme])) vars[`--${k}`] = v;
  for (const f of PALETTE_FAMILIES) for (const s of SHADES) vars[`--c-${f}-${s}`] = hexToChannels(paletteColor(theme, f, s));
  return vars;
}

/**
 * Styles de base : thème clair par défaut ; sombre si choisi (data-theme="dark"
 * sur <html>) ou si le système le demande et qu'aucun choix contraire n'est fait.
 */
type CssRules = { [selectorOrProperty: string]: string | CssRules };

export function themeBaseStyles(): CssRules {
  const dark = { ...themeVariables("dark"), colorScheme: "dark" };
  return {
    ":root": { ...themeVariables("light"), colorScheme: "light" },
    ":root[data-theme=dark]": dark,
    "@media (prefers-color-scheme: dark)": { ":root:not([data-theme=light])": dark },
  };
}

/** Couleurs Tailwind : jetons et palette lus dans les variables (opacité /xx prise en charge). */
export function tailwindColors(): Record<string, string | Record<string, string>> {
  const out: Record<string, string | Record<string, string>> = {};
  for (const k of Object.keys(THEME_TOKENS.light)) out[k] = `hsl(var(--${k}) / <alpha-value>)`;
  for (const f of PALETTE_FAMILIES) {
    out[f] = Object.fromEntries(SHADES.map((s) => [String(s), `rgb(var(--c-${f}-${s}) / <alpha-value>)`]));
  }
  return out;
}
