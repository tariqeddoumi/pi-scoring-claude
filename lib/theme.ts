// Préférence de thème de l'utilisateur : « system » (suivre le système, par
// défaut), « light » ou « dark ». Conservée dans un cookie pour que le serveur
// rende directement le bon thème (pas de flash au chargement).

export type ThemePreference = "system" | "light" | "dark";

export const THEME_COOKIE = "theme";

export function parseThemePreference(value: string | undefined | null): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}

/** Attribut data-theme de <html> : absent quand le thème suit le système. */
export function themeAttribute(pref: ThemePreference): "light" | "dark" | undefined {
  return pref === "system" ? undefined : pref;
}
