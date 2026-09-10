import { prisma } from "../../db/prisma";
import { t } from "../../i18n";
import { env } from "../../config/env";
import { formatSum } from "../../utils/money";
import { confirmTopUp, rejectTopUp } from "../../services/wallet";
import { adminSuggestionKeyboard, adminTopUpKeyboard } from "../keyboards";
import type { BotContext } from "../types";

function userLabel(telegramId: bigint, username?: string | null): string {
  return username ? `@${username}` : `id:${telegramId.toString()}`;
}

function isAdmin(ctx: BotContext): boolean {
  return BigInt(ctx.from?.id ?? 0) === env.adminTelegramId;
}

export async function notifyAdminNewTopUp(ctx: BotContext, topUpId: string, amount: number, screenshotFileId: string) {
  if (env.adminTelegramId === 0n) return;
  const caption = t("ru", "adminTopUpNotification", {
    userLabel: userLabel(ctx.dbUser.telegramId, ctx.dbUser.username),
    amount: formatSum(amount),
  });
  await ctx.telegram.sendPhoto(env.adminTelegramId.toString(), screenshotFileId, {
    caption,
    reply_markup: adminTopUpKeyboard({ ...ctx, lang: "ru" } as BotContext, topUpId).reply_markup,
  });
}

export async function notifyAdminNewSuggestion(ctx: BotContext, text: string) {
  if (env.adminTelegramId === 0n) return;
  const suggestion = await prisma.categorySuggestion.findFirst({
    where: { telegramUserId: ctx.dbUser.telegramId, suggestedText: text },
    orderBy: { createdAt: "desc" },
  });
  if (!suggestion) return;

  const message = t("ru", "adminNewSuggestion", {
    userLabel: userLabel(ctx.dbUser.telegramId, ctx.dbUser.username),
    text,
  });
  await ctx.telegram.sendMessage(env.adminTelegramId.toString(), message, {
    reply_markup: adminSuggestionKeyboard({ ...ctx, lang: "ru" } as BotContext, suggestion.id).reply_markup,
  });
}

export async function handleAdminTopUpApprove(ctx: BotContext, topUpId: string) {
  if (!isAdmin(ctx)) {
    await ctx.answerCbQuery?.(t(ctx.lang, "notAdmin"));
    return;
  }

  const request = await prisma.topUpRequest.findUnique({ where: { id: topUpId }, include: { user: true } });
  if (!request) return;

  await confirmTopUp(topUpId);
  const updatedUser = await prisma.telegramUser.findUniqueOrThrow({ where: { id: request.userId } });

  await ctx.answerCbQuery?.();
  await ctx.editMessageCaption?.(t("ru", "adminApproved"));

  await ctx.telegram.sendMessage(
    updatedUser.telegramId.toString(),
    t(updatedUser.language, "topUpConfirmed", {
      amount: formatSum(request.requestedAmountSum),
      balance: formatSum(updatedUser.walletBalanceSum),
    })
  );
}

export async function handleAdminTopUpReject(ctx: BotContext, topUpId: string) {
  if (!isAdmin(ctx)) {
    await ctx.answerCbQuery?.(t(ctx.lang, "notAdmin"));
    return;
  }

  const request = await prisma.topUpRequest.findUnique({ where: { id: topUpId }, include: { user: true } });
  if (!request) return;

  await rejectTopUp(topUpId);

  await ctx.answerCbQuery?.();
  await ctx.editMessageCaption?.(t("ru", "adminRejected"));

  await ctx.telegram.sendMessage(
    request.user.telegramId.toString(),
    t(request.user.language, "topUpRejected")
  );
}

export async function handleAdminSuggestionAdd(ctx: BotContext, suggestionId: string) {
  if (!isAdmin(ctx)) {
    await ctx.answerCbQuery?.(t(ctx.lang, "notAdmin"));
    return;
  }
  await prisma.categorySuggestion.update({ where: { id: suggestionId }, data: { status: "ADDED" } });
  await ctx.answerCbQuery?.();
  await ctx.editMessageText?.(t("ru", "adminSuggestionAdded"));
}

export async function handleAdminSuggestionReject(ctx: BotContext, suggestionId: string) {
  if (!isAdmin(ctx)) {
    await ctx.answerCbQuery?.(t(ctx.lang, "notAdmin"));
    return;
  }
  await prisma.categorySuggestion.update({ where: { id: suggestionId }, data: { status: "REJECTED" } });
  await ctx.answerCbQuery?.();
  await ctx.editMessageText?.(t("ru", "adminSuggestionRejected"));
}
