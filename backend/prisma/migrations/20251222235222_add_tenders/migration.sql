-- CreateTable
CREATE TABLE "Tender" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "blockIds" TEXT NOT NULL,
    "sectionIds" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "deadline" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Tender_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TenderInvite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenderId" TEXT NOT NULL,
    "subcontractorId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TenderInvite_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TenderInvite_subcontractorId_fkey" FOREIGN KEY ("subcontractorId") REFERENCES "Subcontractor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TenderBid" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inviteId" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "subcontractorId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'parsed',
    "priceTotal" REAL NOT NULL,
    "completionDate" TEXT,
    "score" INTEGER,
    "items" TEXT NOT NULL,
    "files" TEXT NOT NULL,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "blockReason" TEXT,
    "blockDate" DATETIME,
    "contractNumber" TEXT,
    "contractDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TenderBid_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "TenderInvite" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TenderBid_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TenderBid_subcontractorId_fkey" FOREIGN KEY ("subcontractorId") REFERENCES "Subcontractor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Tender_projectId_idx" ON "Tender"("projectId");

-- CreateIndex
CREATE INDEX "Tender_status_idx" ON "Tender"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TenderInvite_token_key" ON "TenderInvite"("token");

-- CreateIndex
CREATE INDEX "TenderInvite_tenderId_idx" ON "TenderInvite"("tenderId");

-- CreateIndex
CREATE INDEX "TenderInvite_subcontractorId_idx" ON "TenderInvite"("subcontractorId");

-- CreateIndex
CREATE INDEX "TenderInvite_token_idx" ON "TenderInvite"("token");

-- CreateIndex
CREATE UNIQUE INDEX "TenderBid_inviteId_key" ON "TenderBid"("inviteId");

-- CreateIndex
CREATE INDEX "TenderBid_tenderId_idx" ON "TenderBid"("tenderId");

-- CreateIndex
CREATE INDEX "TenderBid_subcontractorId_idx" ON "TenderBid"("subcontractorId");

-- CreateIndex
CREATE INDEX "TenderBid_status_idx" ON "TenderBid"("status");
