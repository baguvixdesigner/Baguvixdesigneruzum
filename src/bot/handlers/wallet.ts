import { t } from "../../i18n";
import { env } from "../../config/env";
import { formatSum } from "../../utils/money";
import { attachScreenshotToTopUp, createTopUpRequest } from "../../services/wallet";
import { confirmPaymentKeyboard } from "../keyboards";
import type { BotContext } from "../types";

export async function handleTopUpStart(ctx: BotContext) {
  await ctx.answerCbQuery?.();
  ctx.session.awaiting = "topup_amount";
  await ctx.reply(t(ctx.lang, "askTopUpAmount", { min: formatSum(env.minTopupSum) }));
}

export async function handleTopUpAmountText(ctx: BotContext, text: string) {
  const amount = Number.parseInt(text.replace(/\s|сум|so'm/gi, ""), 10);

  if (!Number.isFinite(amount)) {
    await ctx.reply(t(ctx.lang, "amountNotNumber"));
    return;
  }
  if (amount < env.minTopupSum) {
    await ctx.reply(t(ctx.lang, "amountTooSmall", { min: formatSum(env.minTopupSum) }));
    return;
  }

  ctx.session.pendingTopUpAmount = amount;
  ctx.session.awaiting = undefined;

  await ctx.reply(
    t(ctx.lang, "topUpCardDetails", {
      amount: formatSum(amount),
      card: env.topupCardNumber,
      holder: env.topupCardHolder,
    }),
    confirmPaymentKeyboard(ctx)
  );
}

export async function handleConfirmPaymentIntent(ctx: BotContext) {
  await ctx.answerCbQuery?.();
  const amount = ctx.session.pendingTopUpAmount;
  if (!amount) return;

  const request = await createTopUpRequest(ctx.dbUser.id, amount);
  ctx.session.pendingTopUpId = request.id;
  ctx.session.awaiting = "topup_screenshot";

  await ctx.reply(t(ctx.lang, "askScreenshot"));
}

export async function handleTopUpScreenshot(ctx: BotContext, fileId: string) {
  const topUpId = ctx.session.pendingTopUpId;
  if (!topUpId) return;

  await attachScreenshotToTopUp(topUpId, fileId);
  ctx.session.awaiting = undefined;
  await ctx.reply(t(ctx.lang, "topUpPending"));

  const { notifyAdminNewTopUp } = await import("./admin");
  await notifyAdminNewTopUp(ctx, topUpId, ctx.session.pendingTopUpAmount ?? 0, fileId);
}

export async function handleScreenshotRequired(ctx: BotContext) {
  await ctx.reply(t(ctx.lang, "screenshotRequired"));
}
