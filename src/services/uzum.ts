import axios from "axios";
import { randomUUID } from "node:crypto";
import { env } from "../config/env";
import { logger } from "../utils/logger";

export interface UzumMatchResult {
  matchCount: number;
  ordersSum: number;
}

/**
 * Поиск по ключевым словам через внутренний GraphQL Uzum (graphql.uzum.uz).
 * Это неофициальный эндпоинт (см. раздел 5.1 ТЗ) — запрос ниже основан на схеме,
 * которой пользуются открытые community-проекты для поиска товаров. При смене
 * фронтенда Uzum схема может измениться — тогда правится только этот файл.
 *
 * Домен из исходного ТЗ (graphql.umarket.uz) больше не резолвится — заменён на
 * актуальный graphql.uzum.uz. Перед GraphQL стоит шлюз, который без корректных
 * заголовков отвечает 401 с пустым телом (не ошибка GraphQL-сервера). Реальный
 * набор заголовков подтверждён через DevTools (Network → Copy as cURL на uzum.uz):
 * нужен Authorization: Bearer <анонимный JWT от "Uzum ID">, apollographql-client-*,
 * city-id/latitude/longitude, X-Iid. Токен живёт ~3 часа и пока подставляется вручную
 * через UZUM_BEARER_TOKEN — программный способ его получать ещё предстоит найти
 * (см. README, раздел про открытые вопросы). Без него запросы будут падать в 401,
 * и пайплайн уйдёт в резерв (Apify) или в нейтральный noveltyLabel.
 *
 * Точное имя запроса/полей для поиска товаров (не автодополнения) — тоже ещё не
 * подтверждено, см. scripts/prototype-uzum.ts.
 *
 * Резерв при нестабильности: переключение на платный Apify Uzum Scraper (см. searchUzumViaApify).
 */
const DEVICE_IID = randomUUID();
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

function uzumHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "*/*",
    "Accept-Language": "ru-RU",
    "apollographql-client-name": "web-customers",
    "apollographql-client-version": env.uzumClientVersion,
    "city-id": env.uzumCityId,
    "city-latitude": env.uzumCityLat,
    "city-longitude": env.uzumCityLon,
    latitude: env.uzumCityLat,
    longitude: env.uzumCityLon,
    Origin: "https://uzum.uz",
    Referer: "https://uzum.uz/",
    "X-Iid": DEVICE_IID,
  };
  if (env.uzumBearerToken) headers.Authorization = `Bearer ${env.uzumBearerToken}`;
  return headers;
}

export async function searchUzumMatches(keyword: string, take = 40): Promise<UzumMatchResult> {
  if (!env.uzumBearerToken) {
    logger.warn("UZUM_BEARER_TOKEN не задан — GraphQL Uzum вернёт 401, уходим в резерв");
    return await searchUzumViaApify(keyword);
  }

  try {
    const { data } = await axios.post(
      env.uzumGraphqlUrl,
      { query: SEARCH_QUERY, variables: { text: keyword, take } },
      { timeout: 15_000, headers: uzumHeaders() }
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
