import axios from "axios";
import { env } from "../config/env";
import { logger } from "../utils/logger";

export interface UzumMatchResult {
  matchCount: number;
  ordersSum: number;
}

/**
 * Поиск по ключевым словам через внутренний GraphQL Uzum (graphql.umarket.uz).
 * Это неофициальный эндпоинт (см. раздел 5.1 ТЗ) — запрос ниже основан на схеме,
 * которой пользуются открытые community-проекты для поиска товаров. При смене
 * фронтенда Uzum схема может измениться — тогда правится только этот файл.
 *
 * Резерв при нестабильности: переключение на платный Apify Uzum Scraper (см. searchUzumViaApify).
 */
const SEARCH_QUERY = `
  query SearchProducts($text: String!, $take: Int!) {
    makeSearch(text: $text, options: { pagination: { take: $take, skip: 0 } }) {
      total
      products {
        id
        orders
      }
    }
  }
`;

export async function searchUzumMatches(keyword: string, take = 40): Promise<UzumMatchResult> {
  try {
    const { data } = await axios.post(
      env.uzumGraphqlUrl,
      { query: SEARCH_QUERY, variables: { text: keyword, take } },
      {
        timeout: 15_000,
        headers: { "Content-Type": "application/json" },
      }
    );

    const search = data?.data?.makeSearch;
    if (!search) {
      logger.warn(`Uzum GraphQL: неожиданный формат ответа для "${keyword}"`);
      return await searchUzumViaApify(keyword);
    }

    const products: Array<{ orders?: number }> = search.products ?? [];
    const ordersSum = products.reduce((sum, p) => sum + (p.orders ?? 0), 0);

    return {
      matchCount: Number(search.total ?? products.length ?? 0),
      ordersSum,
    };
  } catch (err) {
    logger.error(`Ошибка запроса к Uzum GraphQL для "${keyword}"`, err);
    return await searchUzumViaApify(keyword);
  }
}

/**
 * Резервный путь через Apify Uzum Scraper — используется только если прямой эндпоинт
 * недоступен и заданы APIFY_TOKEN/APIFY_UZUM_ACTOR_ID. Иначе — нейтральный результат
 * (считаем нишу неопределённой, а не свободной, чтобы не завысить noveltyLabel).
 */
async function searchUzumViaApify(keyword: string): Promise<UzumMatchResult> {
  if (!env.apifyToken || !env.apifyUzumActorId) {
    return { matchCount: -1, ordersSum: -1 };
  }

  try {
    const { data } = await axios.post(
      `https://api.apify.com/v2/acts/${env.apifyUzumActorId}/run-sync-get-dataset-items`,
      { keyword },
      {
        params: { token: env.apifyToken },
        timeout: 60_000,
      }
    );

    const items: Array<{ orders?: number }> = Array.isArray(data) ? data : [];
    const ordersSum = items.reduce((sum, p) => sum + (p.orders ?? 0), 0);
    return { matchCount: items.length, ordersSum };
  } catch (err) {
    logger.error(`Ошибка резервного запроса к Apify Uzum Scraper для "${keyword}"`, err);
    return { matchCount: -1, ordersSum: -1 };
  }
}
