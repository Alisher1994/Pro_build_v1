/*
  Warnings:

  - You are about to drop the column `projectId` on the `Subcontractor` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[company]` on the table `Subcontractor` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[inn]` on the table `Subcontractor` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Subcontractor" DROP CONSTRAINT "Subcontractor_projectId_fkey";

-- DropIndex
DROP INDEX "Subcontractor_projectId_idx";

-- AlterTable
ALTER TABLE "Block" ALTER COLUMN "area" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Estimate" ALTER COLUMN "totalCost" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "EstimateSection" ALTER COLUMN "totalCost" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "EstimateStage" ALTER COLUMN "quantity" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "unitCost" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "totalCost" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Finance" ALTER COLUMN "amount" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "GanttTask" ALTER COLUMN "progress" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "quantity" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "isDeletable" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "latitude" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "longitude" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Resource" ALTER COLUMN "quantity" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "unitPrice" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "totalCost" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "ScheduleTask" ALTER COLUMN "quantity" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "actualQuantity" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "progress" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Subcontractor" DROP COLUMN "projectId",
ADD COLUMN     "certificatePhoto" TEXT,
ADD COLUMN     "licensePhoto" TEXT,
ADD COLUMN     "mtbPhoto" TEXT,
ADD COLUMN     "rating" TEXT,
ADD COLUMN     "trPhoto" TEXT,
ADD COLUMN     "workTypes" TEXT;

-- AlterTable
ALTER TABLE "SupplyItem" ALTER COLUMN "requiredQuantity" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "orderedQuantity" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "deliveredQuantity" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "purchasePrice" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Tender" ADD COLUMN     "items" TEXT;

-- AlterTable
ALTER TABLE "TenderBid" ADD COLUMN     "certificatePhoto" TEXT,
ADD COLUMN     "licensePhoto" TEXT,
ADD COLUMN     "mtbPhoto" TEXT,
ADD COLUMN     "trPhoto" TEXT,
ALTER COLUMN "priceTotal" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "TenderInvite" ADD COLUMN     "inviteCode" TEXT;

-- AlterTable
ALTER TABLE "WorkType" ALTER COLUMN "quantity" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "unitCost" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "totalCost" SET DATA TYPE DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT,
    "name" TEXT NOT NULL,
    "isHead" BOOLEAN NOT NULL DEFAULT false,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "privileges" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "photo" TEXT,
    "phone" TEXT NOT NULL,
    "corporatePhone" TEXT,
    "password" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "hireDate" TIMESTAMP(3),
    "terminationDate" TIMESTAMP(3),
    "score" INTEGER NOT NULL DEFAULT 0,
    "projectId" TEXT,
    "education" TEXT,
    "departmentId" TEXT,
    "isHead" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "gender" TEXT,
    "pinfl" TEXT,
    "passportSeries" TEXT,
    "passportNumber" TEXT,
    "passportIssuedBy" TEXT,
    "passportIssueDate" TIMESTAMP(3),
    "passportExpiryDate" TIMESTAMP(3),
    "nationality" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Position_name_key" ON "Position"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_email_key" ON "Employee"("email");

-- CreateIndex
CREATE INDEX "Employee_positionId_idx" ON "Employee"("positionId");

-- CreateIndex
CREATE INDEX "Employee_departmentId_idx" ON "Employee"("departmentId");

-- CreateIndex
CREATE INDEX "Employee_projectId_idx" ON "Employee"("projectId");

-- CreateIndex
CREATE INDEX "Employee_projectId_createdAt_idx" ON "Employee"("projectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Schedule_projectId_createdAt_idx" ON "Schedule"("projectId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Subcontractor_company_key" ON "Subcontractor"("company");

-- CreateIndex
CREATE UNIQUE INDEX "Subcontractor_inn_key" ON "Subcontractor"("inn");

-- CreateIndex
CREATE INDEX "Supply_projectId_status_idx" ON "Supply"("projectId", "status");

-- CreateIndex
CREATE INDEX "Supply_projectId_createdAt_idx" ON "Supply"("projectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Tender_projectId_createdAt_idx" ON "Tender"("projectId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
