// =====================================================================
//  appConfig.ts — Identité visuelle PARAMÉTRABLE (nom + logo + slogan).
//  Réglable sans toucher au code, via variables d'environnement (à définir
//  dans Vercel → Settings → Environment Variables, puis redéployer) :
//    - NEXT_PUBLIC_APP_NAME        : nom complet affiché (titre, connexion)
//    - NEXT_PUBLIC_APP_NAME_SHORT  : nom court (barre latérale) — optionnel
//    - NEXT_PUBLIC_APP_TAGLINE     : sous-titre / slogan — optionnel
//    - NEXT_PUBLIC_APP_LOGO_URL    : URL/chemin du logo (défaut : /logo.svg)
//  Le logo doit être servi en same-origin (ex. fichier dans /public) pour
//  respecter la CSP `img-src 'self'`; un logo externe nécessiterait d'élargir
//  la CSP dans next.config.mjs.
// =====================================================================

const env = (v: string | undefined) => (v && v.trim() ? v.trim() : undefined);

export const APP_NAME =
  env(process.env.NEXT_PUBLIC_APP_NAME) ?? "Scoring des projets de promotion immobilière";

export const APP_NAME_SHORT =
  env(process.env.NEXT_PUBLIC_APP_NAME_SHORT) ?? APP_NAME;

export const APP_TAGLINE =
  env(process.env.NEXT_PUBLIC_APP_TAGLINE) ?? "BKAM 19/G · 1/W/2025";

export const APP_LOGO_URL =
  env(process.env.NEXT_PUBLIC_APP_LOGO_URL) ?? "/logo.svg";
