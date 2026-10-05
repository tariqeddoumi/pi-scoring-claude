-- Alignement de la structure : production, migrations et schema.prisma
-- décrivent désormais exactement la même base (contrôlé par comparaison des
-- colonnes, valeurs par défaut, contraintes, index et énumérations).
-- Idempotent : rejouable sans effet.

-- Valeur par défaut de updatedAt (déjà présente en production sur
-- DisbursementMilestone, ProjectAuthorization et ReferentialItem) ; Prisma
-- renseigne toujours la date, la valeur par défaut couvre les insertions SQL.
ALTER TABLE "DisbursementMilestone" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ProjectAuthorization" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ReferentialItem" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "RegulatoryOverride" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "RegulatoryOverride" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- Dérogations comité : règles de suppression conformes au schéma (la table a
-- été créée en production avec des clés étrangères sans règle explicite).
ALTER TABLE "RegulatoryOverride" DROP CONSTRAINT IF EXISTS "RegulatoryOverride_projectId_fkey";
ALTER TABLE "RegulatoryOverride" ADD CONSTRAINT "RegulatoryOverride_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "RealEstateProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RegulatoryOverride" DROP CONSTRAINT IF EXISTS "RegulatoryOverride_requestedById_fkey";
ALTER TABLE "RegulatoryOverride" ADD CONSTRAINT "RegulatoryOverride_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RegulatoryOverride" DROP CONSTRAINT IF EXISTS "RegulatoryOverride_decidedById_fkey";
ALTER TABLE "RegulatoryOverride" ADD CONSTRAINT "RegulatoryOverride_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Autorisations du projet : clé étrangère présente en production, absente de
-- la migration 20260928.
DO $$ BEGIN
  ALTER TABLE "ProjectAuthorization" ADD CONSTRAINT "ProjectAuthorization_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "RealEstateProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
