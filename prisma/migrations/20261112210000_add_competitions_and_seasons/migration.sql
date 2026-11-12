CREATE TABLE "SportFormat" (
    "id" UUID NOT NULL,
    "sportId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultStarterCount" INTEGER NOT NULL,
    "defaultFinisherCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SportFormat_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Competition" (
    "id" UUID NOT NULL,
    "clubId" UUID NOT NULL,
    "sportFormatId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "starterCount" INTEGER NOT NULL,
    "finisherCount" INTEGER NOT NULL,
    "inactiveAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Competition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Season" (
    "id" UUID NOT NULL,
    "competitionId" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "startDate" DATE,
    "endDate" DATE,
    "inactiveAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SportFormat_sportId_code_key" ON "SportFormat"("sportId", "code");
CREATE INDEX "SportFormat_sportId_idx" ON "SportFormat"("sportId");
CREATE INDEX "Competition_clubId_inactiveAt_idx" ON "Competition"("clubId", "inactiveAt");
CREATE INDEX "Competition_sportFormatId_idx" ON "Competition"("sportFormatId");
CREATE UNIQUE INDEX "Season_competitionId_label_key" ON "Season"("competitionId", "label");
CREATE INDEX "Season_competitionId_inactiveAt_idx" ON "Season"("competitionId", "inactiveAt");

ALTER TABLE "SportFormat"
ADD CONSTRAINT "SportFormat_sportId_fkey"
FOREIGN KEY ("sportId") REFERENCES "Sport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Competition"
ADD CONSTRAINT "Competition_clubId_fkey"
FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Competition"
ADD CONSTRAINT "Competition_sportFormatId_fkey"
FOREIGN KEY ("sportFormatId") REFERENCES "SportFormat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Season"
ADD CONSTRAINT "Season_competitionId_fkey"
FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "SportFormat" (
    "id", "sportId", "code", "name", "defaultStarterCount", "defaultFinisherCount", "updatedAt"
)
VALUES
    ('00000000-0000-4000-8000-000000000071', '00000000-0000-4000-8000-000000000001', 'RUGBY_7', 'Rugby à 7', 7, 5, CURRENT_TIMESTAMP),
    ('00000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000001', 'RUGBY_10', 'Rugby à 10', 10, 5, CURRENT_TIMESTAMP),
    ('00000000-0000-4000-8000-000000000015', '00000000-0000-4000-8000-000000000001', 'RUGBY_15', 'Rugby à 15', 15, 8, CURRENT_TIMESTAMP);
