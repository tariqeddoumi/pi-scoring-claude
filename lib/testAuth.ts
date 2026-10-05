// Identité de test (tests de bout en bout, démonstration locale) : remplace la
// session Supabase UNIQUEMENT hors production et si E2E_AUTH_EMAIL est défini.
// Un build de production (Vercel, next start) l'ignore toujours : NODE_ENV y
// vaut "production". Le compte doit exister et être actif dans la table User
// (les droits restent ceux de son rôle). Un test peut changer de profil avec
// le cookie e2e_user (ex. rm@bank.ma), sous les mêmes conditions.
// Sans dépendance Node : utilisable dans le middleware (Edge).

export const TEST_USER_COOKIE = "e2e_user";

const EMAIL = /^[^@\s]+@[^@\s]+$/;

type TestAuthEnv = { NODE_ENV?: string; E2E_AUTH_EMAIL?: string };

// Lecture littérale de process.env.NODE_ENV : remplacée par "production" à la
// compilation d'un build de production, y compris dans le middleware.
const runtimeEnv = (): TestAuthEnv => ({ NODE_ENV: process.env.NODE_ENV, E2E_AUTH_EMAIL: process.env.E2E_AUTH_EMAIL });

export function testAuthEmail(cookieValue?: string | null, env: TestAuthEnv = runtimeEnv()): string | null {
  if (env.NODE_ENV === "production") return null;
  const configured = env.E2E_AUTH_EMAIL?.trim();
  if (!configured || !EMAIL.test(configured)) return null;
  const override = cookieValue?.trim();
  return override && EMAIL.test(override) ? override : configured;
}
