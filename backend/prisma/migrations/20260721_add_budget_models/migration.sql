-- CreateTable: ProjectBudget
-- Quarterly budget allocation for a project (backend / frontend / contracts)
CREATE TABLE "ProjectBudget" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "spent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectBudget_pkey" PRIMARY KEY ("id")
);

-- CreateTable: BudgetOverride
-- Approved override allowing spend beyond the hard cap (max +20% above amount)
CREATE TABLE "BudgetOverride" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "approvedBy" TEXT NOT NULL,
    "amountApproved" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "bountyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BudgetOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable: BudgetAlert
-- Alert events recorded when budget crosses utilisation thresholds
CREATE TABLE "BudgetAlert" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "utilization" DOUBLE PRECISION NOT NULL,
    "message" TEXT NOT NULL,
    "notified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BudgetAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectBudget_projectId_idx" ON "ProjectBudget"("projectId");

-- CreateIndex
CREATE INDEX "ProjectBudget_period_idx" ON "ProjectBudget"("period");

-- CreateIndex: unique constraint enforces one budget per project per quarter
CREATE UNIQUE INDEX "ProjectBudget_projectId_period_key" ON "ProjectBudget"("projectId", "period");

-- CreateIndex
CREATE INDEX "BudgetOverride_budgetId_idx" ON "BudgetOverride"("budgetId");

-- CreateIndex
CREATE INDEX "BudgetAlert_budgetId_idx" ON "BudgetAlert"("budgetId");

-- CreateIndex
CREATE INDEX "BudgetAlert_alertType_idx" ON "BudgetAlert"("alertType");

-- CreateIndex
CREATE INDEX "BudgetAlert_createdAt_idx" ON "BudgetAlert"("createdAt");

-- AddForeignKey
ALTER TABLE "BudgetOverride" ADD CONSTRAINT "BudgetOverride_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "ProjectBudget"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetAlert" ADD CONSTRAINT "BudgetAlert_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "ProjectBudget"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
