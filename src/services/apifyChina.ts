import axios from "axios";
import { env } from "../config/env";
import { logger } from "../utils/logger";

export type ChinaSourceKey = "TAOBAO" | "ALIBABA_1688";

export interface ChinaCandidate {
  source: ChinaSourceKey;
  sourceProductId: string;
  title: string;
  imageUrl?: string;
  priceCny: number;
  sourceUrl: string;
  salesSignal: number;
}

/**
 * Сбор кандидатов с Taobao/1688 через готовые Apify-акторы, а не Oxylabs.
 *
 * Почему не Oxylabs (как задумывалось в ТЗ изначально): в их официальном списке
 * "именных" источников с авто-парсингом для e-commerce нет ни Taobao, ни 1688 —
 * только generic `source: "universal"` (сырой HTML, без структуры). На практике
 * это ещё и ненадёжно для Taobao — даже с рендером и явным ожиданием (browser_
 * instructions) в тестах не удалось получить страницу с реальными товарами:
 * данные подгружаются асинхронным JS-запросом, который просто не срабатывал.
 * Apify — наоборот, специализированные акторы под конкретно эти два сайта, уже
 * умеющие обходить их защиту и отдающие готовый структурированный JSON по
 * ключевому слову. Подробности решения — см. README.
 *
 * Актуальные акторы (проверить/сменить при необходимости через .env):
 *  - Taobao: zen-studio/taobao-search-scraper — подтверждённый параметр
 *    "keyword", опционально maxItems/sort/enrichWithDetails.
 *  - 1688: zen-studio/1688-wholesale-scraper — точное имя параметра поиска
 *    по ключевому слову ЕЩЁ НЕ подтверждено живым прогоном, см.
 *    scripts/prototype-apify-china.ts.
 */
const ACTOR_ID: Record<ChinaSourceKey, string> = {
  TAOBAO: env.apifyTaobaoActorId,
  ALIBABA_1688: env.apify1688ActorId,
};

function isConfigured(): boolean {
  return Boolean(env.apifyToken);
}

export async function searchChinaSource(
  source: ChinaSourceKey,
  searchTerm: string,
  limit = 20
): Promise<ChinaCandidate[]> {
  if (!isConfigured()) {
    logger.warn("APIFY_TOKEN не задан — пропускаем сбор с китайских площадок");
    return [];
  }

  const actorId = ACTOR_ID[source];
  const input = { keyword: searchTerm, maxItems: limit };

  try {
    const { data } = await axios.post(
      `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items`,
      input,
      {
        params: { token: env.apifyToken },
        timeout: 120_000,
      }
    );

    return parseApifyResults(source, Array.isArray(data) ? data : []);
  } catch (err) {
    logger.error(`Ошибка запроса к Apify (${source}, актор ${actorId}, "${searchTerm}")`, err);
    return [];
  }
}

function parseApifyResults(source: ChinaSourceKey, items: any[]): ChinaCandidate[] {
  const out: ChinaCandidate[] = [];

  for (const item of items) {
    const productId = String(item.itemId ?? item.id ?? item.offerId ?? item.productId ?? "");
    const title = String(item.title ?? item.titleOriginal ?? item.name ?? "").trim();
    const url = String(item.url ?? item.itemUrl ?? item.detailUrl ?? item.link ?? "");
    if (!productId || !title || !url) continue;

    const price = Number.parseFloat(
      item.price ?? item.priceCny ?? item.currentPrice ?? item.minPrice ?? item.priceRange?.min ?? "0"
    );

    out.push({
      source,
      sourceProductId: productId,
      title,
      imageUrl: item.image ?? item.imageUrl ?? item.mainImage ?? item.gallery?.[0] ?? undefined,
      priceCny: Number.isFinite(price) ? price : 0,
      sourceUrl: url,
      salesSignal:
        Number.parseFloat(item.sales ?? item.salesCount ?? item.soldCount ?? item.monthSold ?? "0") || 0,
    });
  }

  return out;
}
