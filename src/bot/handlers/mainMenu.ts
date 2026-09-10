import { t } from "../../i18n";
import { languageKeyboard, supportKeyboard, walletKeyboard } from "../keyboards";
import { formatSum } from "../../utils/money";
import type { BotContext } from "../types";
import { showGroups } from "./search";

export async function handleFindProducts(ctx: BotContext) {
  await showGroups(ctx);
}

export async function handleWalletButton(ctx: BotContext) {
  await ctx.reply(
    t(ctx.lang, "walletTitle", { balance: formatSum(ctx.dbUser.walletBalanceSum) }),
    walletKeyboard(ctx)
  );
}

export async function handleSupportButton(ctx: BotContext) {
  await ctx.reply(t(ctx.lang, "supportText"), supportKeyboard(ctx));
}

export async function handleLanguageButton(ctx: BotContext) {
  await ctx.reply(t(ctx.lang, "chooseLanguage"), languageKeyboard());
}
