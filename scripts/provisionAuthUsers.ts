// =====================================================================
//  Provisioning des comptes Supabase Auth alignés sur la table `User`.
//  Méthode supportée : Admin API GoTrue (clé service_role, jamais exposée
//  au client). Idempotent : ignore les comptes déjà existants.
//
//  Usage :
//    SUPABASE_SERVICE_ROLE_KEY=... \
//    NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co \
//    DEMO_USER_PASSWORD='MotDePasseFort!' \
//    npx tsx scripts/provisionAuthUsers.ts
//
//  Les emails DOIVENT correspondre à ceux de la table pi_scoring.User pour
//  que getCurrentAppUser relie la session au rôle applicatif.
// =====================================================================

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.DEMO_USER_PASSWORD ?? "BkamScoring2026!";

if (!url || !serviceKey) {
  console.error("✗ NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis.");
  process.exit(1);
}

// Comptes de démonstration (un par rôle) — alignés sur prisma/seed.ts.
const DEMO_USERS = [
  { email: "admin@bank.ma", name: "Amine Admin" },
  { email: "analyst@bank.ma", name: "Rita Analyste" },
  { email: "rm@bank.ma", name: "Karim Chargé d'affaires" },
  { email: "manager@bank.ma", name: "Salma Manager" },
  { email: "auditor@bank.ma", name: "Omar Auditeur" },
];

async function main() {
  const supabase = createClient(url!, serviceKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Récupère les emails déjà présents (pagination simple, volume faible).
  const existing = new Set<string>();
  let page = 1;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    data.users.forEach((u) => u.email && existing.add(u.email.toLowerCase()));
    if (data.users.length < 1000) break;
    page += 1;
  }

  for (const u of DEMO_USERS) {
    if (existing.has(u.email.toLowerCase())) {
      console.log(`= ${u.email} (déjà présent, ignoré)`);
      continue;
    }
    const { error } = await supabase.auth.admin.createUser({
      email: u.email,
      password,
      email_confirm: true,
      user_metadata: { name: u.name },
    });
    if (error) {
      console.error(`✗ ${u.email} : ${error.message}`);
      continue;
    }
    console.log(`✓ ${u.email} créé`);
  }

  console.log(
    "\n✔ Terminé. Mot de passe initial commun : " +
      "(défini via DEMO_USER_PASSWORD). À CHANGER à la première connexion.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
