-- CreateTable
CREATE TABLE "seats" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "seatNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'available',
    "reservedBy" INTEGER,
    "reservedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "seats_ticketId_seatNumber_key" ON "seats"("ticketId", "seatNumber");
