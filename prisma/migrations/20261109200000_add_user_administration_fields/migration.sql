ALTER TABLE "User"
ADD COLUMN "firstName" TEXT,
ADD COLUMN "lastName" TEXT,
ADD COLUMN "disabledAt" TIMESTAMP(3);

CREATE INDEX "User_disabledAt_idx" ON "User"("disabledAt");
