-- =====================================================================
--  Variante SQL du provisioning des comptes Supabase Auth de démonstration.
--  À exécuter dans Supabase Studio → SQL Editor (droits élevés requis).
--  Idempotent : ignore les comptes déjà existants.
--
--  ⚠️ Méthode de secours / démo. En production, préférer l'Admin API
--  (scripts/provisionAuthUsers.ts) ou le SSO (Azure AD / OIDC, V2).
--  Remplacez le mot de passe ci-dessous avant exécution.
-- =====================================================================

DO $$
DECLARE
  rec RECORD;
  uid uuid;
  pwd text := 'BkamScoring2026!';  -- À CHANGER
BEGIN
  FOR rec IN SELECT * FROM (VALUES
    ('admin@bank.ma'),
    ('analyst@bank.ma'),
    ('rm@bank.ma'),
    ('manager@bank.ma'),
    ('auditor@bank.ma')
  ) AS t(email)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = rec.email) THEN
      uid := gen_random_uuid();
      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data,
        is_super_admin, is_sso_user, is_anonymous
      ) VALUES (
        '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
        rec.email, extensions.crypt(pwd, extensions.gen_salt('bf')),
        now(), now(), now(),
        '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
        false, false, false
      );
      INSERT INTO auth.identities (
        provider_id, user_id, identity_data, provider,
        last_sign_in_at, created_at, updated_at
      ) VALUES (
        uid::text, uid,
        jsonb_build_object('sub', uid::text, 'email', rec.email,
                           'email_verified', true, 'phone_verified', false),
        'email', now(), now(), now()
      );
    END IF;
  END LOOP;
END $$;
