-- CreateEnum
CREATE TYPE "SaleMode" AS ENUM ('CLASSIC', 'VEFA');

-- AlterTable
ALTER TABLE "RealEstateProject" ADD COLUMN     "gfaAmount" DOUBLE PRECISION,
ADD COLUMN     "gfaProvider" TEXT,
ADD COLUMN     "hasGFA" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "saleMode" "SaleMode" NOT NULL DEFAULT 'CLASSIC';

