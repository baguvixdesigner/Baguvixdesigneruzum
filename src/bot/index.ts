import { Telegraf, session } from "telegraf";
import { env } from "../config/env";
import { t } from "../i18n";
import { logger } from "../utils/logger";
import { getOrCreateUser } from "../services/wallet";
import type { BotContext, SessionData } from "./types";

import { handleStart, handleLanguagePick, sendMainMenu } from "./handlers/start";
import { handleFindProducts, handleWalletButton, handleSupportButton, handleLanguageButton } from "./handlers/mainMenu";
import {
  handleGroupPick,
  handleCategoryPick,
  handleSourcePick,
  handleMore10,
  handleSuggestCategoryStart,
  handleSuggestCategoryText,
} from "./handlers/search";
import {
  handleTopUpStart,
  handleTopUpAmountText,
  handleConfirmPaymentIntent,
  handleTopUpScreenshot,
  handleScreenshotRequired,
} from "./handlers/wallet";
import {
  handleAdminTopUpApprove,
  handleAdminTopUpReject,
  handleAdminSuggestionAdd,
  handleAdminSuggestionReject,
} from "./handlers/admin";

export function createBot(): Telegraf<BotContext> {
  const bot = new Telegraf<BotContext>(env.botToken);

  bot.use(session<SessionData, BotContext>({ defaultSession: () => ({}) }));

  bot.use(async (ctx, next) => {
    if (!ctx.from) return next();
    const { user, isNew } = await getOrCreateUser(BigInt(ctx.from.id), ctx.from.username);
    ctx.dbUser = user;
    if (!ctx.session.lang && !isNew) {
      ctx.session.lang = user.language;
    }
    ctx.lang = ctx.session.lang ?? "ru";
    return next();
  });

  bot.start(handleStart);

  bot.action("lang:ru", (ctx) => handleLanguagePick(ctx, "ru"));
  bot.action("lang:uz", (ctx) => handleLanguagePick(ctx, "uz"));

  bot.hears(/^🔍/, handleFindProducts);
  bot.hears(/^💼/, handleWalletButton);
  bot.hears(/^💬/, handleSupportButton);
  bot.hears(/^🌐/, handleLanguageButton);

  bot.action(/^grp:(\d+)$/, (ctx) => handleGroupPick(ctx, Number(ctx.match[1])));
  bot.action(/^cat:(\d+)$/, (ctx) => handleCategoryPick(ctx, Number(ctx.match[1])));
  bot.action(/^src:(TAOBAO|ALIBABA_1688|BOTH)$/, (ctx) => handleSourcePick(ctx, ctx.match[1] as never));
  bot.action("more10", handleMore10);
  bot.action("suggest_category", handleSuggestCategoryStart);

  bot.action("topup:start", handleTopUpStart);
  bot.action("topup:confirm_intent", handleConfirmPaymentIntent);

  bot.action(/^admin_topup_ok:(.+)$/, (ctx) => handleAdminTopUpApprove(ctx, ctx.match[1]));
  bot.action(/^admin_topup_no:(.+)$/, (ctx) => handleAdminTopUpReject(ctx, ctx.match[1]));
  bot.action(/^admin_sugg_ok:(.+)$/, (ctx) => handleAdminSuggestionAdd(ctx, ctx.match[1]));
  bot.action(/^admin_sugg_no:(.+)$/, (ctx) => handleAdminSuggestionReject(ctx, ctx.match[1]));

  bot.on("text", async (ctx) => {
    const text = ctx.message.text;
    if (ctx.session.awaiting === "topup_amount") return handleTopUpAmountText(ctx, text);
    if (ctx.session.awaiting === "suggest_category") return handleSuggestCategoryText(ctx, text);
    if (ctx.session.awaiting === "topup_screenshot") return handleScreenshotRequired(ctx);
    return sendMainMenu(ctx);
  });

  bot.on("photo", async (ctx) => {
    if (ctx.session.awaiting !== "topup_screenshot") return;
    const photos = ctx.message.photo;
    const fileId = photos[photos.length - 1].file_id;
    return handleTopUpScreenshot(ctx, fileId);
  });

  bot.catch((err, ctx) => {
    logger.error("Необработанная ошибка в боте", err);
    ctx.reply(t(ctx.lang ?? "ru", "genericError")).catch(() => undefined);
  });

  return bot;
}
