ALTER TYPE "MatchStatus" RENAME TO "MatchStatus_old";
CREATE TYPE "MatchStatus" AS ENUM ('UPCOMING', 'FINISHED', 'CANCELLED');

ALTER TABLE "Match" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Match"
ALTER COLUMN "status" TYPE "MatchStatus"
USING (
    CASE
        WHEN "status"::TEXT = 'IN_PROGRESS' THEN 'UPCOMING'
        ELSE "status"::TEXT
    END
)::"MatchStatus";
ALTER TABLE "Match" ALTER COLUMN "status" SET DEFAULT 'UPCOMING';
DROP TYPE "MatchStatus_old";

ALTER TABLE "Match"
ALTER COLUMN "scheduledAt" TYPE TIMESTAMPTZ(3)
USING "scheduledAt" AT TIME ZONE 'UTC';

ALTER TABLE "Match"
ADD COLUMN "clubScore" INTEGER,
ADD COLUMN "opponentScore" INTEGER;

ALTER TABLE "Match"
ADD CONSTRAINT "Match_clubScore_check" CHECK ("clubScore" IS NULL OR ("clubScore" >= 0 AND "clubScore" <= 999));

ALTER TABLE "Match"
ADD CONSTRAINT "Match_opponentScore_check" CHECK ("opponentScore" IS NULL OR ("opponentScore" >= 0 AND "opponentScore" <= 999));
