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
  // Taobao-актор требует maxItems >= 10 (проверено живым прогоном) — подстраховка
  // на случай, если когда-нибудь вызовут с меньшим лимитом.
  const input = { keyword: searchTerm, maxItems: Math.max(limit, 10) };

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

/**
 * Продажи в китайских карточках часто приходят человекочитаемой строкой с
 * иероглифом-множителем, а не числом — например "1万+" (10 000+), "3.5万"
 * (35 000). Подтверждено живым прогоном Taobao-актора: "sales"/"totalSold"
 * там были 0, а реальный сигнал лежал именно в "salesSignal" в таком формате.
 */
function parseChineseCount(raw: unknown): number {
  if (typeof raw === "number") return raw;
  if (typeof raw !== "string") return 0;
  const match = raw.replace(/\+/g, "").trim().match(/^([\d.]+)\s*(万|亿)?/);
  if (!match) return 0;
  const num = Number.parseFloat(match[1]);
  if (!Number.isFinite(num)) return 0;
  if (match[2] === "万") return Math.round(num * 10_000);
  if (match[2] === "亿") return Math.round(num * 100_000_000);
  return Math.round(num);
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

    const salesSignal =
      parseChineseCount(item.salesSignal) ||
      parseChineseCount(item.search?.orderPayUV) ||
      parseChineseCount(item.totalSold) ||
      parseChineseCount(item.sales) ||
      0;

    out.push({
      source,
      sourceProductId: productId,
      title,
      imageUrl: item.mainPictureUrl ?? item.image ?? item.imageUrl ?? item.gallery?.[0] ?? undefined,
      priceCny: Number.isFinite(price) ? price : 0,
      sourceUrl: url,
      salesSignal,
    });
  }

  return out;
}
