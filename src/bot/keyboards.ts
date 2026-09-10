import { Markup } from "telegraf";
import { t } from "../i18n";
import { formatSum } from "../utils/money";
import { env } from "../config/env";
import type { BotContext, GroupOption, CategoryOption } from "./types";

export function languageKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("Русский 🇷🇺", "lang:ru"), Markup.button.callback("O'zbekcha 🇺🇿", "lang:uz")],
  ]);
}

export function mainMenuKeyboard(ctx: BotContext) {
  const balance = formatSum(ctx.dbUser.walletBalanceSum);
  return Markup.keyboard([
    [t(ctx.lang, "btnFindProducts")],
    [t(ctx.lang, "btnWallet", { balance })],
    [t(ctx.lang, "btnSupport"), t(ctx.lang, "btnLanguage")],
  ]).resize();
}

export function groupsKeyboard(ctx: BotContext, groups: GroupOption[]) {
  const buttons = groups.map((g, i) => [
    Markup.button.callback(ctx.lang === "uz" ? g.nameUz : g.name, `grp:${i}`),
  ]);
  return Markup.inlineKeyboard(buttons);
}

export function subcategoriesKeyboard(ctx: BotContext, cats: CategoryOption[]) {
  const buttons = cats.map((c, i) => [
    Markup.button.callback(ctx.lang === "uz" ? c.nameUz : c.name, `cat:${i}`),
  ]);
  return Markup.inlineKeyboard(buttons);
}

export function sourceKeyboard(ctx: BotContext) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(t(ctx.lang, "sourceTaobao"), "src:TAOBAO")],
    [Markup.button.callback(t(ctx.lang, "source1688"), "src:ALIBABA_1688")],
    [Markup.button.callback(t(ctx.lang, "sourceBoth"), "src:BOTH")],
  ]);
}

export function topUpBalanceKeyboard(ctx: BotContext) {
  return Markup.inlineKeyboard([[Markup.button.callback(t(ctx.lang, "btnTopUp"), "topup:start")]]);
}

export function moreAndSuggestKeyboard(ctx: BotContext) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(t(ctx.lang, "btnMore10", { price: formatSum(env.queryPriceSum) }), "more10")],
    [Markup.button.callback(t(ctx.lang, "btnSuggestCategory"), "suggest_category")],
  ]);
}

export function walletKeyboard(ctx: BotContext) {
  return Markup.inlineKeyboard([[Markup.button.callback(t(ctx.lang, "btnTopUpCard"), "topup:start")]]);
}

export function confirmPaymentKeyboard(ctx: BotContext) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(t(ctx.lang, "btnConfirmPayment"), "topup:confirm_intent")],
  ]);
}

export function adminTopUpKeyboard(ctx: BotContext, topUpId: string) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(t(ctx.lang, "btnAdminApprove"), `admin_topup_ok:${topUpId}`),
      Markup.button.callback(t(ctx.lang, "btnAdminReject"), `admin_topup_no:${topUpId}`),
    ],
  ]);
}

export function adminSuggestionKeyboard(ctx: BotContext, suggestionId: string) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(t(ctx.lang, "btnAdminAddCategory"), `admin_sugg_ok:${suggestionId}`),
      Markup.button.callback(t(ctx.lang, "btnAdminRejectSuggestion"), `admin_sugg_no:${suggestionId}`),
    ],
  ]);
}

export function supportKeyboard(ctx: BotContext) {
  return Markup.inlineKeyboard([[Markup.button.url(t(ctx.lang, "btnSupport"), `https://t.me/${env.supportUsername}`)]]);
}
