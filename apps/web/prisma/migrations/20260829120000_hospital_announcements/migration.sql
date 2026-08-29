-- CreateTable
CREATE TABLE "HospitalAnnouncement" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HospitalAnnouncement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HospitalAnnouncementReply" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HospitalAnnouncementReply_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HospitalAnnouncement_hospitalId_createdAt_idx" ON "HospitalAnnouncement"("hospitalId", "createdAt");

-- CreateIndex
CREATE INDEX "HospitalAnnouncement_hospitalId_pinned_idx" ON "HospitalAnnouncement"("hospitalId", "pinned");

-- CreateIndex
CREATE INDEX "HospitalAnnouncementReply_announcementId_createdAt_idx" ON "HospitalAnnouncementReply"("announcementId", "createdAt");

-- AddForeignKey
ALTER TABLE "HospitalAnnouncement" ADD CONSTRAINT "HospitalAnnouncement_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalAnnouncement" ADD CONSTRAINT "HospitalAnnouncement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalAnnouncementReply" ADD CONSTRAINT "HospitalAnnouncementReply_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "HospitalAnnouncement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalAnnouncementReply" ADD CONSTRAINT "HospitalAnnouncementReply_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
