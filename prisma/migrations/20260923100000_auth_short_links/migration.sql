-- AlterTable
ALTER TABLE "signing_tokens" ADD COLUMN "shortCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "signing_tokens_shortCode_key" ON "signing_tokens"("shortCode");

-- CreateEnum
CREATE TYPE "AuthCredentialPurpose" AS ENUM ('INVITE', 'PASSWORD_RESET');

-- CreateTable
CREATE TABLE "auth_credential_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" "AuthCredentialPurpose" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_credential_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "auth_credential_tokens_tokenHash_key" ON "auth_credential_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "auth_credential_tokens_userId_purpose_idx" ON "auth_credential_tokens"("userId", "purpose");

-- AddForeignKey
ALTER TABLE "auth_credential_tokens" ADD CONSTRAINT "auth_credential_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
