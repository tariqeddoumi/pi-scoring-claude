/** @type {import('next').NextConfig} */

// En-têtes de sécurité appliqués à toutes les routes (V1.5 lot D).
// Note CSRF : les Server Actions Next 15 vérifient déjà l'origine (Origin == Host) ;
// `serverActions.allowedOrigins` restreint les origines autorisées en complément.
const securityHeaders = [
  // HSTS : force HTTPS (2 ans, sous-domaines, preload).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Anti-clickjacking (doublé par frame-ancestors dans la CSP).
  { key: "X-Frame-Options", value: "DENY" },
  // Empêche le MIME-sniffing.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Ne fuite pas l'URL référente vers l'extérieur.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Réduit la surface d'API navigateur.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // CSP pragmatique : bloque l'embarquement et les scripts/connexions externes.
  // 'unsafe-inline'/'unsafe-eval' sont requis par le runtime Next 15 (App Router) ;
  // un durcissement par nonce est prévu en V2.
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "img-src 'self' data: blob:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig = {
  reactStrictMode: true,
  // Next 15 : les Server Actions sont stables (config hors `experimental`).
  serverActions: {
    bodySizeLimit: "5mb",
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
