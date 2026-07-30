-- Migration: 20260724_add_milestone_escrow_system
-- Adds EscrowAccount, BountyMilestone, and EscrowAuditLog tables
-- to support milestone-based escrow payment system.

-- ── EscrowAccount ────────────────────────────────────────────────────────────

CREATE TABLE "EscrowAccount" (
    "id"             TEXT NOT NULL PRIMARY KEY,
    "bountyId"       TEXT NOT NULL,
    "totalAmount"    REAL NOT NULL,
    "releasedAmount" REAL NOT NULL DEFAULT 0,
    "status"         TEXT NOT NULL DEFAULT 'active',
    "createdAt"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      DATETIME NOT NULL
);

CREATE UNIQUE INDEX "EscrowAccount_bountyId_key"
    ON "EscrowAccount"("bountyId");

CREATE INDEX "EscrowAccount_bountyId_idx"
    ON "EscrowAccount"("bountyId");

CREATE INDEX "EscrowAccount_status_idx"
    ON "EscrowAccount"("status");

-- ── BountyMilestone ──────────────────────────────────────────────────────────

CREATE TABLE "BountyMilestone" (
    "id"                TEXT     NOT NULL PRIMARY KEY,
    "escrowId"          TEXT     NOT NULL,
    "bountyId"          TEXT     NOT NULL,
    "description"       TEXT     NOT NULL,
    "dueDate"           DATETIME NOT NULL,
    "reviewerAddress"   TEXT     NOT NULL,
    "paymentAmount"     REAL     NOT NULL,
    "status"            TEXT     NOT NULL DEFAULT 'planned',
    "rejectionFeedback" TEXT,
    "submittedAt"       DATETIME,
    "fundsReleasedAt"   DATETIME,
    "autoReleased"      BOOLEAN  NOT NULL DEFAULT 0,
    "createdAt"         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         DATETIME NOT NULL,

    CONSTRAINT "BountyMilestone_escrowId_fkey"
        FOREIGN KEY ("escrowId") REFERENCES "EscrowAccount"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "BountyMilestone_escrowId_idx"
    ON "BountyMilestone"("escrowId");

CREATE INDEX "BountyMilestone_bountyId_idx"
    ON "BountyMilestone"("bountyId");

CREATE INDEX "BountyMilestone_status_idx"
    ON "BountyMilestone"("status");

CREATE INDEX "BountyMilestone_reviewerAddress_idx"
    ON "BountyMilestone"("reviewerAddress");

CREATE INDEX "BountyMilestone_submittedAt_idx"
    ON "BountyMilestone"("submittedAt");

-- ── EscrowAuditLog ───────────────────────────────────────────────────────────

CREATE TABLE "EscrowAuditLog" (
    "id"          TEXT     NOT NULL PRIMARY KEY,
    "escrowId"    TEXT     NOT NULL,
    "milestoneId" TEXT,
    "actorId"     TEXT     NOT NULL,
    "action"      TEXT     NOT NULL,
    "payload"     TEXT,
    "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EscrowAuditLog_escrowId_fkey"
        FOREIGN KEY ("escrowId") REFERENCES "EscrowAccount"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,

    CONSTRAINT "EscrowAuditLog_milestoneId_fkey"
        FOREIGN KEY ("milestoneId") REFERENCES "BountyMilestone"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "EscrowAuditLog_escrowId_idx"
    ON "EscrowAuditLog"("escrowId");

CREATE INDEX "EscrowAuditLog_milestoneId_idx"
    ON "EscrowAuditLog"("milestoneId");

CREATE INDEX "EscrowAuditLog_actorId_idx"
    ON "EscrowAuditLog"("actorId");

CREATE INDEX "EscrowAuditLog_action_idx"
    ON "EscrowAuditLog"("action");

CREATE INDEX "EscrowAuditLog_createdAt_idx"
    ON "EscrowAuditLog"("createdAt");
