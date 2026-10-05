"use client";

// Choix du thème d'affichage : Système (par défaut), Clair ou Sombre. Appliqué
// immédiatement (attribut data-theme de <html>) et conservé dans un cookie,
// relu par le serveur au chargement suivant.

import * as React from "react";
import { cn } from "@/lib/utils";
import { THEME_COOKIE, themeAttribute, type ThemePreference } from "@/lib/theme";

const OPTIONS: { value: ThemePreference; label: string; icon: string }[] = [
  { value: "system", label: "Système", icon: "M4 5h16v11H4zM8 20h8M12 16v4" },
  { value: "light", label: "Clair", icon: "M12 4V2m0 20v-2m8-8h2M2 12h2m13.66-5.66 1.41-1.41M4.93 19.07l1.41-1.41m0-11.32L4.93 4.93m14.14 14.14-1.41-1.41M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" },
  { value: "dark", label: "Sombre", icon: "M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" },
];

export function ThemeToggle({ initial }: { initial: ThemePreference }) {
  const [pref, setPref] = React.useState(initial);
  const name = React.useId();

  const choose = (value: ThemePreference) => {
    setPref(value);
    const attr = themeAttribute(value);
    if (attr) document.documentElement.dataset.theme = attr;
    else delete document.documentElement.dataset.theme;
    document.cookie = attr
      ? `${THEME_COOKIE}=${attr}; path=/; max-age=31536000; samesite=lax`
      : `${THEME_COOKIE}=; path=/; max-age=0; samesite=lax`;
  };

  return (
    <fieldset>
      <legend className="sr-only">Thème d&apos;affichage</legend>
      <div className="grid grid-cols-3 gap-0.5 rounded-md border border-border bg-muted p-0.5">
        {OPTIONS.map((o) => (
          <label key={o.value} className="relative">
            <input type="radio" name={name} value={o.value} checked={pref === o.value} onChange={() => choose(o.value)} className="peer sr-only" />
            <span className={cn(
              "flex cursor-pointer items-center justify-center gap-1 rounded px-1.5 py-1 text-xs text-muted-foreground transition",
              "hover:text-foreground peer-checked:bg-background peer-checked:font-medium peer-checked:text-foreground peer-checked:shadow-sm",
              "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-primary",
            )}>
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={o.icon} /></svg>
              {o.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
