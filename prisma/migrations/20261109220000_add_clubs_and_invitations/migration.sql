CREATE TABLE "Sport" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Sport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Sport_code_key" ON "Sport"("code");

INSERT INTO "Sport" ("id", "code", "name")
VALUES ('00000000-0000-4000-8000-000000000001', 'RUGBY', 'Rugby');

ALTER TABLE "Club"
ADD COLUMN "primaryColor" TEXT NOT NULL DEFAULT '#A91234',
ADD COLUMN "secondaryColor" TEXT NOT NULL DEFAULT '#FFFFFF',
ADD COLUMN "primarySportId" UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';

ALTER TABLE "Club" ALTER COLUMN "primaryColor" DROP DEFAULT;
ALTER TABLE "Club" ALTER COLUMN "secondaryColor" DROP DEFAULT;
ALTER TABLE "Club" ALTER COLUMN "primarySportId" DROP DEFAULT;

CREATE INDEX "Club_primarySportId_idx" ON "Club"("primarySportId");

ALTER TABLE "Club"
ADD CONSTRAINT "Club_primarySportId_fkey"
FOREIGN KEY ("primarySportId") REFERENCES "Sport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ClubInvitation" (
    "id" UUID NOT NULL,
    "clubId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "invitedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClubInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClubInvitation_tokenHash_key" ON "ClubInvitation"("tokenHash");
CREATE INDEX "ClubInvitation_clubId_email_idx" ON "ClubInvitation"("clubId", "email");
CREATE INDEX "ClubInvitation_expiresAt_idx" ON "ClubInvitation"("expiresAt");

ALTER TABLE "ClubInvitation"
ADD CONSTRAINT "ClubInvitation_clubId_fkey"
FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClubInvitation"
ADD CONSTRAINT "ClubInvitation_invitedById_fkey"
FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
