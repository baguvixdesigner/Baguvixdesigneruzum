import { prisma } from "../db/prisma";
import type { Language } from "@prisma/client";

export async function getOrCreateUser(telegramId: bigint, username?: string) {
  const existing = await prisma.telegramUser.findUnique({ where: { telegramId } });
  if (existing) {
    if (username && username !== existing.username) {
      await prisma.telegramUser.update({ where: { id: existing.id }, data: { username } });
    }
    return { user: existing, isNew: false };
  }
  const user = await prisma.telegramUser.create({ data: { telegramId, username } });
  return { user, isNew: true };
}

export async function setUserLanguage(userId: string, language: Language) {
  return prisma.telegramUser.update({ where: { id: userId }, data: { language } });
}

export async function chargeForQuery(userId: string, amountSum: number, relatedRequestId?: string) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.telegramUser.findUniqueOrThrow({ where: { id: userId } });
    if (user.walletBalanceSum < amountSum) {
      throw new Error("INSUFFICIENT_BALANCE");
    }
    const updated = await tx.telegramUser.update({
      where: { id: userId },
      data: { walletBalanceSum: { decrement: amountSum } },
    });
    await tx.walletTransaction.create({
      data: { userId, type: "QUERY_CHARGE", amountSum: -amountSum, relatedRequestId },
    });
    return updated;
  });
}

export async function createTopUpRequest(userId: string, requestedAmountSum: number) {
  return prisma.topUpRequest.create({
    data: { userId, requestedAmountSum, status: "AWAITING_SCREENSHOT" },
  });
}

export async function attachScreenshotToTopUp(topUpId: string, screenshotFileId: string) {
  return prisma.topUpRequest.update({
    where: { id: topUpId },
    data: { screenshotFileId, status: "AWAITING_ADMIN_CONFIRMATION" },
  });
}

export async function confirmTopUp(topUpId: string) {
  return prisma.$transaction(async (tx) => {
    const req = await tx.topUpRequest.findUniqueOrThrow({ where: { id: topUpId } });
    if (req.status !== "AWAITING_ADMIN_CONFIRMATION") {
      throw new Error("INVALID_STATE");
    }
    await tx.topUpRequest.update({
      where: { id: topUpId },
      data: { status: "CONFIRMED", confirmedAt: new Date() },
    });
    const user = await tx.telegramUser.update({
      where: { id: req.userId },
      data: { walletBalanceSum: { increment: req.requestedAmountSum } },
    });
    await tx.walletTransaction.create({
      data: {
        userId: req.userId,
        type: "TOPUP",
        amountSum: req.requestedAmountSum,
        relatedRequestId: topUpId,
      },
    });
    return user;
  });
}

export async function rejectTopUp(topUpId: string) {
  return prisma.topUpRequest.update({ where: { id: topUpId }, data: { status: "REJECTED" } });
}
