-- CreateTable
CREATE TABLE "CarbonProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "methodology" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "projectType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "vintageYear" INTEGER NOT NULL,
    "totalCreditsIssued" INTEGER NOT NULL DEFAULT 0,
    "totalCreditsRetired" INTEGER NOT NULL DEFAULT 0,
    "metadataCid" TEXT NOT NULL,
    "verifierAddress" TEXT NOT NULL,
    "ownerAddress" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CreditBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "vintageYear" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "serialStart" TEXT NOT NULL,
    "serialEnd" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "metadataCid" TEXT NOT NULL,
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreditBatch_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "CarbonProject" ("projectId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RetirementRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "retirementId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "retiredBy" TEXT NOT NULL,
    "beneficiary" TEXT NOT NULL,
    "retirementReason" TEXT NOT NULL,
    "vintageYear" INTEGER NOT NULL,
    "serialNumbers" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "retiredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RetirementRecord_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "CreditBatch" ("batchId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RetirementRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "CarbonProject" ("projectId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MarketListing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listingId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "seller" TEXT NOT NULL,
    "amountAvailable" INTEGER NOT NULL,
    "pricePerCredit" TEXT NOT NULL,
    "vintageYear" INTEGER NOT NULL,
    "methodology" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MarketListing_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "CarbonProject" ("projectId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MarketListing_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "CreditBatch" ("batchId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MonitoringData" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "tonnesVerified" INTEGER NOT NULL,
    "methodologyScore" INTEGER NOT NULL,
    "satelliteCid" TEXT NOT NULL,
    "submittedBy" TEXT NOT NULL,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MonitoringData_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "CarbonProject" ("projectId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'corporation',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" TEXT NOT NULL,
    "bountyId" TEXT NOT NULL,
    "contributorId" TEXT NOT NULL,
    "maintainerId" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "attachments" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" DATETIME,
    "resolvedAt" DATETIME,
    "resolution" TEXT
);

-- CreateTable
CREATE TABLE "SupportMetrics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketType" TEXT NOT NULL,
    "frequency" INTEGER NOT NULL DEFAULT 0,
    "avgResolution" INTEGER NOT NULL DEFAULT 0,
    "lastUpdated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Bounty" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "requirements" TEXT NOT NULL,
    "acceptanceCriteria" TEXT NOT NULL,
    "rewardUsd" REAL NOT NULL,
    "difficulty" TEXT NOT NULL,
    "deadline" DATETIME NOT NULL,
    "bountyType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "reviewerAddress" TEXT NOT NULL,
    "reviewerGithub" TEXT,
    "tags" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "applicationCount" INTEGER NOT NULL DEFAULT 0,
    "priceOverride" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BountyDependency" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "prerequisiteBountyId" TEXT NOT NULL,
    "dependentBountyId" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BountyDependency_prerequisiteBountyId_fkey" FOREIGN KEY ("prerequisiteBountyId") REFERENCES "Bounty" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BountyDependency_dependentBountyId_fkey" FOREIGN KEY ("dependentBountyId") REFERENCES "Bounty" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CarbonProject_projectId_key" ON "CarbonProject"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditBatch_batchId_key" ON "CreditBatch"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "RetirementRecord_retirementId_key" ON "RetirementRecord"("retirementId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketListing_listingId_key" ON "MarketListing"("listingId");

-- CreateIndex
CREATE UNIQUE INDEX "MonitoringData_projectId_period_key" ON "MonitoringData"("projectId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "User_publicKey_key" ON "User"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "SupportTicket_ticketId_key" ON "SupportTicket"("ticketId");

-- CreateIndex
CREATE INDEX "SupportTicket_bountyId_idx" ON "SupportTicket"("bountyId");

-- CreateIndex
CREATE INDEX "SupportTicket_contributorId_idx" ON "SupportTicket"("contributorId");

-- CreateIndex
CREATE INDEX "SupportTicket_status_idx" ON "SupportTicket"("status");

-- CreateIndex
CREATE INDEX "SupportTicket_createdAt_idx" ON "SupportTicket"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SupportMetrics_ticketType_key" ON "SupportMetrics"("ticketType");

-- CreateIndex
CREATE INDEX "Bounty_status_idx" ON "Bounty"("status");

-- CreateIndex
CREATE INDEX "Bounty_featured_idx" ON "Bounty"("featured");

-- CreateIndex
CREATE INDEX "Bounty_deadline_idx" ON "Bounty"("deadline");

-- CreateIndex
CREATE INDEX "Bounty_bountyType_idx" ON "Bounty"("bountyType");

-- CreateIndex
CREATE INDEX "BountyDependency_prerequisiteBountyId_idx" ON "BountyDependency"("prerequisiteBountyId");

-- CreateIndex
CREATE INDEX "BountyDependency_dependentBountyId_idx" ON "BountyDependency"("dependentBountyId");

-- CreateIndex
CREATE UNIQUE INDEX "BountyDependency_prerequisiteBountyId_dependentBountyId_key" ON "BountyDependency"("prerequisiteBountyId", "dependentBountyId");
