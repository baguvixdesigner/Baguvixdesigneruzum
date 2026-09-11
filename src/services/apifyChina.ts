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
 * Акторы и формат ответа подтверждены живыми прогонами обоих (см.
 * scripts/prototype-apify-china.ts):
 *  - Taobao: zen-studio/taobao-search-scraper — { keyword, maxItems (>= 10) }.
 *    Реальные поля: itemId/title/url/mainPictureUrl, price — строка ("139.00"),
 *    salesSignal — человекочитаемая строка вида "1万+" (sales/totalSold часто 0
 *    даже на обогащённых товарах).
 *  - 1688: zen-studio/1688-wholesale-scraper — { keyword, maxItems }. Реальные
 *    поля: offerId/title/detailUrl/images[], price — объект {min, max, currency}
 *    (диапазон оптовых цен), saledCount/orderCount/recentSoldCount — уже готовые
 *    числа, парсинг иероглифов не нужен.
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

/**
 * Taobao: price — строка ("139.00"). 1688: price — объект {min, max, currency}
 * (диапазон оптовых цен). Подтверждено живыми прогонами обоих акторов.
 */
function extractPrice(item: any): number {
  if (typeof item.price === "number") return item.price;
  if (typeof item.price === "string") return Number.parseFloat(item.price) || 0;
  if (item.price && typeof item.price === "object") {
    const v = item.price.min ?? item.price.max;
    return Number.parseFloat(v) || 0;
  }
  return Number.parseFloat(item.priceCny ?? item.currentPrice ?? item.minPrice ?? "0") || 0;
}

function parseTaobaoItem(item: any): ChinaCandidate | null {
  const productId = String(item.itemId ?? "");
  const title = String(item.title ?? "").trim();
  const url = String(item.url ?? "");
  if (!productId || !title || !url) return null;

  // sales/totalSold часто приходят 0 даже на обогащённых товарах — реальный
  // сигнал лежит в salesSignal как человекочитаемая строка вида "1万+".
  const salesSignal =
    parseChineseCount(item.salesSignal) ||
    parseChineseCount(item.search?.orderPayUV) ||
    parseChineseCount(item.totalSold) ||
    parseChineseCount(item.sales) ||
    0;

  return {
    source: "TAOBAO",
    sourceProductId: productId,
    title,
    imageUrl: item.mainPictureUrl ?? undefined,
    priceCny: extractPrice(item),
    sourceUrl: url,
    salesSignal,
  };
}

function parse1688Item(item: any): ChinaCandidate | null {
  const productId = String(item.offerId ?? "");
  const title = String(item.title ?? "").trim();
  const url = String(item.detailUrl ?? "");
  if (!productId || !title || !url) return null;

  // В отличие от Taobao, тут почти везде уже готовые числа.
  const salesSignal =
    item.saledCount ??
    item.orderCount ??
    item.recentSoldCount ??
    parseChineseCount(item.soldDisplay) ??
    parseChineseCount(item.saledCountStr) ??
    0;

  return {
    source: "ALIBABA_1688",
    sourceProductId: productId,
    title,
    imageUrl: Array.isArray(item.images) ? item.images[0] : undefined,
    priceCny: extractPrice(item),
    sourceUrl: url,
    salesSignal: Number(salesSignal) || 0,
  };
}

function parseApifyResults(source: ChinaSourceKey, items: any[]): ChinaCandidate[] {
  const parse = source === "TAOBAO" ? parseTaobaoItem : parse1688Item;
  const out: ChinaCandidate[] = [];
  for (const item of items) {
    const candidate = parse(item);
    if (candidate) out.push(candidate);
  }
  return out;
}
