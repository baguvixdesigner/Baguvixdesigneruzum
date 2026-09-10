import { t } from "../../i18n";
import { languageKeyboard, mainMenuKeyboard } from "../keyboards";
import { setUserLanguage } from "../../services/wallet";
import type { BotContext } from "../types";

export async function handleStart(ctx: BotContext) {
  if (!ctx.session.lang) {
    await ctx.reply(t("ru", "chooseLanguage"), languageKeyboard());
    return;
  }
  await sendMainMenu(ctx);
}

export async function handleLanguagePick(ctx: BotContext, lang: "ru" | "uz") {
  ctx.session.lang = lang;
  ctx.lang = lang;
  await setUserLanguage(ctx.dbUser.id, lang);
  ctx.dbUser.language = lang;
  await ctx.answerCbQuery?.();
  await ctx.reply(t(lang, "languageSet"));
  await sendMainMenu(ctx);
}

export async function sendMainMenu(ctx: BotContext) {
  await ctx.reply(t(ctx.lang, "mainMenuTitle"), mainMenuKeyboard(ctx));
}
