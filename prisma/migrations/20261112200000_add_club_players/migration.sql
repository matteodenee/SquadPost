CREATE TABLE "MediaAsset" (
    "id" UUID NOT NULL,
    "clubId" UUID NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "hasAlpha" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClubPlayer" (
    "id" UUID NOT NULL,
    "clubId" UUID NOT NULL,
    "userId" UUID,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "primaryPosition" TEXT,
    "usualJerseyNumber" INTEGER,
    "compositionPhotoId" UUID,
    "inactiveAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ClubPlayer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MediaAsset_storageKey_key" ON "MediaAsset"("storageKey");
CREATE INDEX "MediaAsset_clubId_idx" ON "MediaAsset"("clubId");
CREATE UNIQUE INDEX "ClubPlayer_compositionPhotoId_key" ON "ClubPlayer"("compositionPhotoId");
CREATE UNIQUE INDEX "ClubPlayer_clubId_userId_key" ON "ClubPlayer"("clubId", "userId");
CREATE INDEX "ClubPlayer_clubId_inactiveAt_idx" ON "ClubPlayer"("clubId", "inactiveAt");
CREATE INDEX "ClubPlayer_userId_idx" ON "ClubPlayer"("userId");

ALTER TABLE "MediaAsset"
ADD CONSTRAINT "MediaAsset_clubId_fkey"
FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClubPlayer"
ADD CONSTRAINT "ClubPlayer_clubId_fkey"
FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClubPlayer"
ADD CONSTRAINT "ClubPlayer_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ClubPlayer"
ADD CONSTRAINT "ClubPlayer_compositionPhotoId_fkey"
FOREIGN KEY ("compositionPhotoId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
