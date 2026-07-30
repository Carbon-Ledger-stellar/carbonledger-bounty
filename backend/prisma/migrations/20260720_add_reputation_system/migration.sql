-- CreateTable: Contributor
CREATE TABLE "Contributor" (
    "id"                      TEXT NOT NULL,
    "walletAddress"           TEXT NOT NULL,
    "displayName"             TEXT,
    "reputationScore"         DOUBLE PRECISION NOT NULL DEFAULT 50,
    "codeQualityScore"        DOUBLE PRECISION NOT NULL DEFAULT 50,
    "timelinessScore"         DOUBLE PRECISION NOT NULL DEFAULT 50,
    "communicationScore"      DOUBLE PRECISION NOT NULL DEFAULT 50,
    "peerFeedbackScore"       DOUBLE PRECISION NOT NULL DEFAULT 50,
    "totalBountiesCompleted"  INTEGER NOT NULL DEFAULT 0,
    "totalBountiesOnTime"     INTEGER NOT NULL DEFAULT 0,
    "totalBountiesLate"       INTEGER NOT NULL DEFAULT 0,
    "totalBountiesVeryLate"   INTEGER NOT NULL DEFAULT 0,
    "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"               TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contributor_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ReputationHistory
CREATE TABLE "ReputationHistory" (
    "id"                  TEXT NOT NULL,
    "contributorId"       TEXT NOT NULL,
    "scoreBefore"         DOUBLE PRECISION NOT NULL,
    "scoreAfter"          DOUBLE PRECISION NOT NULL,
    "codeQualityBefore"   DOUBLE PRECISION NOT NULL,
    "codeQualityAfter"    DOUBLE PRECISION NOT NULL,
    "timelinessBefore"    DOUBLE PRECISION NOT NULL,
    "timelinessAfter"     DOUBLE PRECISION NOT NULL,
    "communicationBefore" DOUBLE PRECISION NOT NULL,
    "communicationAfter"  DOUBLE PRECISION NOT NULL,
    "peerFeedbackBefore"  DOUBLE PRECISION NOT NULL,
    "peerFeedbackAfter"   DOUBLE PRECISION NOT NULL,
    "bountyId"            TEXT,
    "reviewerScore"       DOUBLE PRECISION,
    "submittedAt"         TIMESTAMP(3),
    "deadlineAt"          TIMESTAMP(3),
    "avgResponseHours"    DOUBLE PRECISION,
    "peerRating"          DOUBLE PRECISION,
    "changeReason"        TEXT,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReputationHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Contributor_walletAddress_key" ON "Contributor"("walletAddress");
CREATE INDEX "Contributor_reputationScore_idx" ON "Contributor"("reputationScore");
CREATE INDEX "Contributor_walletAddress_idx" ON "Contributor"("walletAddress");

CREATE INDEX "ReputationHistory_contributorId_idx" ON "ReputationHistory"("contributorId");
CREATE INDEX "ReputationHistory_createdAt_idx" ON "ReputationHistory"("createdAt");
CREATE INDEX "ReputationHistory_bountyId_idx" ON "ReputationHistory"("bountyId");

-- AddForeignKey
ALTER TABLE "ReputationHistory"
    ADD CONSTRAINT "ReputationHistory_contributorId_fkey"
    FOREIGN KEY ("contributorId") REFERENCES "Contributor"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
