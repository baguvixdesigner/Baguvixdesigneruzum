import type { ProductSnapshot, SourceScope } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { t } from "../../i18n";
import { env } from "../../config/env";
import { formatSum } from "../../utils/money";
import { getCategoryCacheStatus } from "../../services/pipeline";
import { getResultsPage } from "../../services/search";
import { chargeForQuery } from "../../services/wallet";
import {
  groupsKeyboard,
  moreAndSuggestKeyboard,
  sourceKeyboard,
  subcategoriesKeyboard,
  topUpBalanceKeyboard,
} from "../keyboards";
import type { BotContext, CategoryOption, GroupOption } from "../types";

export async function showGroups(ctx: BotContext) {
  const categories = await prisma.category.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  });

  const seen = new Set<string>();
  const groups: GroupOption[] = [];
  for (const c of categories) {
    if (seen.has(c.parentGroup)) continue;
    seen.add(c.parentGroup);
    groups.push({ name: c.parentGroup, nameUz: c.parentGroupUz ?? c.parentGroup });
  }

  ctx.session.groups = groups;
  await ctx.reply(t(ctx.lang, "chooseGroup"), groupsKeyboard(ctx, groups));
}

export async function handleGroupPick(ctx: BotContext, index: number) {
  const group = ctx.session.groups?.[index];
  if (!group) return;

  ctx.session.selectedGroup = group.name;
  const categories = await prisma.category.findMany({
    where: { active: true, parentGroup: group.name },
    orderBy: { sortOrder: "asc" },
  });

  const options: CategoryOption[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
    nameUz: c.nameUz ?? c.name,
  }));
  ctx.session.subcategories = options;

  await ctx.answerCbQuery?.();
  await ctx.reply(t(ctx.lang, "chooseSubcategory"), subcategoriesKeyboard(ctx, options));
}

export async function handleCategoryPick(ctx: BotContext, index: number) {
  const category = ctx.session.subcategories?.[index];
  if (!category) return;

  ctx.session.selectedCategoryId = category.id;
  ctx.session.selectedCategoryName = category.name;
  ctx.session.selectedCategoryNameUz = category.nameUz;

  await ctx.answerCbQuery?.();
  await ctx.reply(t(ctx.lang, "chooseSource"), sourceKeyboard(ctx));
}

export async function handleSourcePick(ctx: BotContext, scope: SourceScope) {
  ctx.session.selectedSourceScope = scope;
  await ctx.answerCbQuery?.();
  await runSearch(ctx, 1);
}

export async function handleMore10(ctx: BotContext) {
  await ctx.answerCbQuery?.();
  const nextBatch = (ctx.session.currentBatch ?? 1) + 1;
  await runSearch(ctx, nextBatch);
}

async function runSearch(ctx: BotContext, batchNumber: number) {
  const categoryId = ctx.session.selectedCategoryId;
  const scope = ctx.session.selectedSourceScope;
  if (!categoryId || !scope) return;

  if (ctx.dbUser.walletBalanceSum < env.queryPriceSum) {
    await ctx.reply(
      t(ctx.lang, "insufficientBalance", {
        price: formatSum(env.queryPriceSum),
        balance: formatSum(ctx.dbUser.walletBalanceSum),
      }),
      topUpBalanceKeyboard(ctx)
    );
    return;
  }

  const cacheStatus = await getCategoryCacheStatus(categoryId);
  let servedFromCache = true;
  if (!cacheStatus.fresh) {
    await ctx.reply(t(ctx.lang, "collectingData"));
    servedFromCache = false;
    const { collectCategory } = await import("../../services/pipeline");
    const category = await prisma.category.findUniqueOrThrow({ where: { id: categoryId } });
    await collectCategory(category);
  }

  const results = await getResultsPage(categoryId, scope, batchNumber);
  if (results.length === 0) {
    await ctx.reply(t(ctx.lang, "noMoreProducts"));
    return;
  }

  const updatedUser = await chargeForQuery(ctx.dbUser.id, env.queryPriceSum);
  ctx.dbUser = updatedUser;

  await prisma.requestLog.create({
    data: {
      userId: ctx.dbUser.id,
      categoryId,
      sourceScope: scope,
      batchNumber,
      servedFromCache,
    },
  });
  ctx.session.currentBatch = batchNumber;

  const text = renderResults(ctx, results, scope);
  await ctx.reply(text, moreAndSuggestKeyboard(ctx));
}

function sourceLabel(ctx: BotContext, scope: SourceScope): string {
  if (scope === "TAOBAO") return t(ctx.lang, "sourceTaobao");
  if (scope === "ALIBABA_1688") return t(ctx.lang, "source1688");
  return t(ctx.lang, "sourceBoth");
}

function noveltyEmoji(label: ProductSnapshot["noveltyLabel"]): string {
  return label === "GREEN" ? "🟢" : label === "YELLOW" ? "🟡" : "🔴";
}

function noveltyText(ctx: BotContext, label: ProductSnapshot["noveltyLabel"]): string {
  if (label === "GREEN") return t(ctx.lang, "noveltyGreen");
  if (label === "YELLOW") return t(ctx.lang, "noveltyYellow");
  return t(ctx.lang, "noveltyRed");
}

function renderResults(ctx: BotContext, results: ProductSnapshot[], scope: SourceScope): string {
  const categoryName = ctx.lang === "uz" ? ctx.session.selectedCategoryNameUz : ctx.session.selectedCategoryName;
  const date = results[0]?.fetchedAt ?? new Date();
  const dateStr = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);

  const header = t(ctx.lang, "resultHeader", {
    count: results.length,
    category: categoryName ?? "",
    source: sourceLabel(ctx, scope),
    date: dateStr,
  });

  const items = results.map((r, i) =>
    t(ctx.lang, "resultItem", {
      index: i + 1,
      title: r.titleTranslatedRu ?? r.title,
      priceCny: r.priceCny,
      priceUzs: formatSum(r.priceUzsAtFetch),
      noveltyEmoji: noveltyEmoji(r.noveltyLabel),
      noveltyText: noveltyText(ctx, r.noveltyLabel),
      url: r.sourceUrl,
    })
  );

  return [header, ...items].join("\n\n");
}

export async function handleSuggestCategoryStart(ctx: BotContext) {
  await ctx.answerCbQuery?.();
  ctx.session.awaiting = "suggest_category";
  await ctx.reply(t(ctx.lang, "suggestCategoryPrompt"));
}

export async function handleSuggestCategoryText(ctx: BotContext, text: string) {
  ctx.session.awaiting = undefined;
  await prisma.categorySuggestion.create({
    data: { telegramUserId: ctx.dbUser.telegramId, suggestedText: text.trim() },
  });
  await ctx.reply(t(ctx.lang, "suggestCategoryThanks"));

  const { notifyAdminNewSuggestion } = await import("./admin");
  await notifyAdminNewSuggestion(ctx, text.trim());
}
