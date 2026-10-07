-- Pièces du dossier de crédit (écran « Documents »). Additive, idempotente.
CREATE TABLE IF NOT EXISTS "DossierPiece" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECU',
    "fileName" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manuel',
    "title" TEXT,
    "issuer" TEXT,
    "documentDate" TEXT,
    "summary" TEXT,
    "attention" JSONB,
    "extracted" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DossierPiece_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DossierPiece_projectId_idx" ON "DossierPiece"("projectId");
DO $$ BEGIN
  ALTER TABLE "DossierPiece" ADD CONSTRAINT "DossierPiece_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "RealEstateProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
