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
  salesSignal: number; // нормализованный сигнал трендовости (число продаж/заказов, что бы ни отдал источник)
}

/**
 * Oxylabs "source" для Realtime E-Commerce Scraper API. Значения по умолчанию — рабочая
 * гипотеза на момент написания ТЗ; ОБЯЗАТЕЛЬНО проверить на бесплатном пробном доступе
 * Oxylabs (см. README "Следующие шаги") и при необходимости поправить через .env.
 */
const OXYLABS_SOURCE: Record<ChinaSourceKey, string> = {
  TAOBAO: process.env.OXYLABS_SOURCE_TAOBAO ?? "taobao_search",
  ALIBABA_1688: process.env.OXYLABS_SOURCE_1688 ?? "1688_search",
};

const OXYLABS_ENDPOINT = "https://realtime.oxylabs.io/v1/queries";

interface OxylabsRawResult {
  content: unknown;
}

function isConfigured(): boolean {
  return Boolean(env.oxylabsUsername && env.oxylabsPassword);
}

/**
 * Достаёт список товаров-кандидатов для одного источника по одному поисковому запросу.
 * Парсинг content максимально терпимый: структура ответа для Taobao/1688 в Realtime API
 * — вложенный JSON, поля могут отличаться в зависимости от версии парсера Oxylabs.
 */
export async function searchChinaSource(
  source: ChinaSourceKey,
  searchTerm: string,
  limit = 20
): Promise<ChinaCandidate[]> {
  if (!isConfigured()) {
    logger.warn("OXYLABS_USERNAME/PASSWORD не заданы — пропускаем сбор с китайских площадок");
    return [];
  }

  try {
    const { data } = await axios.post<OxylabsRawResult>(
      OXYLABS_ENDPOINT,
      {
        source: OXYLABS_SOURCE[source],
        query: searchTerm,
        parse: true,
        context: [{ key: "limit", value: limit }],
      },
      {
        auth: { username: env.oxylabsUsername, password: env.oxylabsPassword },
        timeout: 30_000,
      }
    );

    return parseOxylabsResults(source, data);
  } catch (err) {
    logger.error(`Ошибка запроса к Oxylabs (${source}, "${searchTerm}")`, err);
    return [];
  }
}

function parseOxylabsResults(source: ChinaSourceKey, raw: OxylabsRawResult): ChinaCandidate[] {
  const results = (raw as any)?.results ?? [];
  const out: ChinaCandidate[] = [];

  for (const r of results) {
    const items = r?.content?.results?.organic ?? r?.content?.results ?? [];
    if (!Array.isArray(items)) continue;

    for (const item of items) {
      const productId = String(item.product_id ?? item.id ?? item.item_id ?? "");
      const title = String(item.title ?? item.name ?? "").trim();
      const price = Number.parseFloat(item.price ?? item.price_cny ?? item.currentPrice ?? "0");
      const url = String(item.url ?? item.product_url ?? "");

      if (!productId || !title || !url) continue;

      out.push({
        source,
        sourceProductId: productId,
        title,
        imageUrl: item.image ?? item.thumbnail ?? undefined,
        priceCny: Number.isFinite(price) ? price : 0,
        sourceUrl: url,
        salesSignal: Number.parseFloat(item.sales ?? item.sold ?? item.orders ?? "0") || 0,
      });
    }
  }

  return out;
}
