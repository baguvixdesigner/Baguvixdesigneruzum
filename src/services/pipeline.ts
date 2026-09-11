import { prisma } from "../db/prisma";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import { getCnyToUzsRate } from "./exchangeRate";
import { searchChinaSource, ChinaCandidate } from "./apifyChina";
import { searchUzumMatches } from "./uzum";
import { translateToRussian } from "./translate";
import type { Category, ChinaSource, NoveltyLabel } from "@prisma/client";

const SNAPSHOT_POOL_SIZE = 40;
const CANDIDATES_PER_TERM = 20;

/**
 * Пороги "занятости" ниши на Uzum. Подбираются на реальных данных при разработке
 * (см. раздел 5, п.3 ТЗ) — сейчас это рабочая первая гипотеза.
 */
const NOVELTY_THRESHOLDS = {
  greenMaxOrders: 50, // <= почти нет на Uzum
  yellowMaxOrders: 500, // <= есть немного
  // выше — уже активно продают (RED)
};

function isCacheFresh(fetchedAt: Date): boolean {
  const ttlMs = env.cacheTtlHours * 60 * 60 * 1000;
  return Date.now() - fetchedAt.getTime() < ttlMs;
}

export async function getCategoryCacheStatus(categoryId: string): Promise<{ fresh: boolean; fetchedAt: Date | null }> {
  const latest = await prisma.productSnapshot.findFirst({
    where: { categoryId },
    orderBy: { fetchedAt: "desc" },
  });
  if (!latest) return { fresh: false, fetchedAt: null };
  return { fresh: isCacheFresh(latest.fetchedAt), fetchedAt: latest.fetchedAt };
}

function noveltyLabelFor(ordersSum: number): NoveltyLabel {
  if (ordersSum < 0) return "YELLOW"; // Uzum-поиск недоступен — считаем нейтральным, не занижаем и не завышаем
  if (ordersSum <= NOVELTY_THRESHOLDS.greenMaxOrders) return "GREEN";
  if (ordersSum <= NOVELTY_THRESHOLDS.yellowMaxOrders) return "YELLOW";
  return "RED";
}

const noveltyRank: Record<NoveltyLabel, number> = { GREEN: 0, YELLOW: 1, RED: 2 };

/**
 * Полный сбор по категории (раздел 5 ТЗ). Всегда собирает Taobao + 1688 разом —
 * фильтрация по источнику происходит на этапе выдачи пользователю, не сбора.
 * Результат — до SNAPSHOT_POOL_SIZE свежих ProductSnapshot по категории.
 */
export async function collectCategory(category: Category): Promise<void> {
  logger.info(`Пайплайн: сбор категории "${category.name}" начат`);

  const rate = await getCnyToUzsRate();

  const rawCandidates: ChinaCandidate[] = [];
  for (const term of category.chinaSearchTerms) {
    const [taobao, alibaba1688] = await Promise.all([
      searchChinaSource("TAOBAO", term, CANDIDATES_PER_TERM),
      searchChinaSource("ALIBABA_1688", term, CANDIDATES_PER_TERM),
    ]);
    rawCandidates.push(...taobao, ...alibaba1688);
  }

  const deduped = dedupeCandidates(rawCandidates);
  logger.info(`Пайплайн: найдено ${deduped.length} уникальных кандидатов для "${category.name}"`);

  const enriched = await Promise.all(
    deduped.map(async (candidate) => {
      const titleTranslatedRu = await translateToRussian(candidate.title);
      const uzumMatch = await searchUzumMatches(titleTranslatedRu);
      return {
        candidate,
        titleTranslatedRu,
        uzumMatchCount: Math.max(uzumMatch.matchCount, 0),
        uzumOrdersSum: uzumMatch.ordersSum,
        noveltyLabel: noveltyLabelFor(uzumMatch.ordersSum),
      };
    })
  );

  enriched.sort((a, b) => {
    const noveltyDiff = noveltyRank[a.noveltyLabel] - noveltyRank[b.noveltyLabel];
    if (noveltyDiff !== 0) return noveltyDiff;
    return b.candidate.salesSignal - a.candidate.salesSignal;
  });

  const top = enriched.slice(0, SNAPSHOT_POOL_SIZE);
  const fetchedAt = new Date();

  await prisma.$transaction([
    prisma.productSnapshot.deleteMany({ where: { categoryId: category.id } }),
    prisma.productSnapshot.createMany({
      data: top.map((item, index) => ({
        categoryId: category.id,
        source: item.candidate.source as ChinaSource,
        sourceProductId: item.candidate.sourceProductId,
        title: item.candidate.title,
        titleTranslatedRu: item.titleTranslatedRu,
        imageUrl: item.candidate.imageUrl,
        priceCny: item.candidate.priceCny,
        priceUzsAtFetch: item.candidate.priceCny * rate,
        salesSignal: item.candidate.salesSignal,
        sourceUrl: item.candidate.sourceUrl,
        uzumMatchCount: item.uzumMatchCount,
        uzumOrdersSum: Math.max(item.uzumOrdersSum, 0),
        noveltyLabel: item.noveltyLabel,
        rank: index,
        fetchedAt,
      })),
    }),
  ]);

  logger.info(`Пайплайн: сохранено ${top.length} товаров по категории "${category.name}"`);
}

function dedupeCandidates(candidates: ChinaCandidate[]): ChinaCandidate[] {
  const seen = new Map<string, ChinaCandidate>();
  for (const c of candidates) {
    const key = `${c.source}:${c.sourceProductId}`;
    if (!seen.has(key)) seen.set(key, c);
  }
  return [...seen.values()];
}

export { NOVELTY_THRESHOLDS };
