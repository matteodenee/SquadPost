CREATE TYPE "MatchLocation" AS ENUM ('HOME', 'AWAY', 'NEUTRAL');
CREATE TYPE "MatchStatus" AS ENUM ('UPCOMING', 'IN_PROGRESS', 'FINISHED');

CREATE TABLE "Opponent" (
    "id" UUID NOT NULL,
    "clubId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "inactiveAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Opponent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Match" (
    "id" UUID NOT NULL,
    "clubId" UUID NOT NULL,
    "seasonId" UUID NOT NULL,
    "opponentId" UUID NOT NULL,
    "round" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "venue" TEXT,
    "location" "MatchLocation",
    "status" "MatchStatus" NOT NULL DEFAULT 'UPCOMING',
    "snapshotStarterCount" INTEGER NOT NULL,
    "snapshotFinisherCount" INTEGER NOT NULL,
    "snapshotSportName" TEXT NOT NULL,
    "snapshotFormatName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Opponent_clubId_inactiveAt_idx" ON "Opponent"("clubId", "inactiveAt");
CREATE INDEX "Match_clubId_scheduledAt_idx" ON "Match"("clubId", "scheduledAt");
CREATE INDEX "Match_seasonId_idx" ON "Match"("seasonId");
CREATE INDEX "Match_opponentId_idx" ON "Match"("opponentId");

ALTER TABLE "Opponent"
ADD CONSTRAINT "Opponent_clubId_fkey"
FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Match"
ADD CONSTRAINT "Match_clubId_fkey"
FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Match"
ADD CONSTRAINT "Match_seasonId_fkey"
FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Match"
ADD CONSTRAINT "Match_opponentId_fkey"
FOREIGN KEY ("opponentId") REFERENCES "Opponent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Match"
ADD CONSTRAINT "Match_snapshotStarterCount_check" CHECK ("snapshotStarterCount" > 0);

ALTER TABLE "Match"
ADD CONSTRAINT "Match_snapshotFinisherCount_check" CHECK ("snapshotFinisherCount" >= 0);
