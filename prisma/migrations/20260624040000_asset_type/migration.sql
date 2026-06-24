-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('PROMOTION', 'EXPLOITATION');

-- AlterTable
ALTER TABLE "RealEstateProject" ADD COLUMN     "assetType" "AssetType" NOT NULL DEFAULT 'PROMOTION';

