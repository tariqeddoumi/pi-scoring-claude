import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";
import { tailwindColors, themeBaseStyles } from "./lib/themePalette";

const config: Config = {
  // Thème sombre : choix explicite (data-theme="dark" sur <html>) ou préférence
  // du système quand l'utilisateur n'a pas choisi « Clair » (cf. lib/themePalette.ts).
  darkMode: ["variant", [
    "@media (prefers-color-scheme: dark) { &:not([data-theme=light] *) }",
    "&:is([data-theme=dark] *)",
  ]],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Jetons (fond, texte, bordure, primaire, danger) et palette des tons :
        // variables CSS redéfinies par le thème sombre.
        ...tailwindColors(),
        // Couleurs métier classification BKAM
        bkam: {
          sain: "hsl(142 71% 45%)",
          sensible: "hsl(48 96% 53%)",
          predouteux: "hsl(32 95% 44%)",
          douteux: "hsl(25 95% 53%)",
          compromis: "hsl(0 84% 60%)",
          ctx: "hsl(0 72% 35%)",
        },
      },
      borderRadius: {
        lg: "0.5rem",
        md: "0.375rem",
        sm: "0.25rem",
      },
    },
  },
  plugins: [plugin(({ addBase }) => addBase(themeBaseStyles()))],
};

export default config;
