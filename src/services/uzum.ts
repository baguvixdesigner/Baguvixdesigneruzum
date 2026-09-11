import axios from "axios";
import { randomUUID } from "node:crypto";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import { getUzumBearerToken } from "./uzumAuth";

export interface UzumMatchResult {
  matchCount: number;
  ordersSum: number;
}

/**
 * Поиск по ключевым словам через внутренний GraphQL Uzum (graphql.uzum.uz).
 * Это неофициальный эндпоинт (см. раздел 5.1 ТЗ). Домен из исходного ТЗ
 * (graphql.umarket.uz) больше не резолвится — заменён на актуальный graphql.uzum.uz.
 *
 * Перед GraphQL стоит шлюз (Apollo Federation — видно по subrequest-ошибкам от
 * отдельных сервисов вроде "ad-market"), который без корректных заголовков отвечает
 * 401 с пустым телом (не ошибка GraphQL-сервера). Нужен Authorization: Bearer
 * <анонимный JWT от "Uzum ID">, apollographql-client-*, city-id/latitude/longitude,
 * X-Iid — подтверждено через DevTools (Network → Copy as cURL на uzum.uz) и живым
 * прогоном запроса ниже. Токен живёт ~3 часа и получается автоматически через
 * getUzumBearerToken() (см. uzumAuth.ts) — воспроизводит флоу их сайта: GET
 * uzum.uz (кука _yasc от их балансировщика) → POST id.uzum.uz/api/auth/token
 * (Set-Cookie: access_token). UZUM_BEARER_TOKEN в .env остаётся ручным оверрайдом
 * для отладки.
 *
 * Запрос и структура ответа подтверждены живым прогоном через интроспекцию схемы
 * (scripts/prototype-uzum.ts, не отключена на их стороне) — makeSearch(query:
 * MakeSearchQueryInput!): MakeSearchResult, товары в MakeSearchResult.items,
 * карточка — union CatalogCard (ProductCard | SkuCard | SkuGroupCard), у каждого
 * варианта есть ordersQuantity — то самое число заказов из раздела 4 ТЗ.
 * showAdultContent/sort — литералы enum'ов, не переменные (их бэкенд что-то
 * странное делает с $variables именно в интроспекции — вживую makeSearch
 * с инлайн-литералами отработал стабильно, поэтому оставлено так и здесь).
 *
 * Резерв при нестабильности: переключение на платный Apify Uzum Scraper (см. searchUzumViaApify).
 */
const DEVICE_IID = randomUUID();

function searchQuery(keyword: string, take: number): string {
  const text = JSON.stringify(keyword);
  return `
    query Search {
      makeSearch(query: {
        text: ${text},
        showAdultContent: FALSE,
        filters: [],
        sort: BY_RELEVANCE_DESC,
        pagination: { offset: 0, limit: ${take} }
      }) {
        total
        items {
          catalogCard {
            ... on ProductCard { ordersQuantity }
            ... on SkuCard { ordersQuantity }
            ... on SkuGroupCard { ordersQuantity }
          }
        }
      }
    }
  `;
}

function uzumHeaders(token: string): Record<string, string> {
  return {
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
    Authorization: `Bearer ${token}`,
  };
}

export async function searchUzumMatches(keyword: string, take = 40): Promise<UzumMatchResult> {
  const token = await getUzumBearerToken();
  if (!token) {
    logger.warn("Не удалось получить Bearer-токен Uzum — уходим в резерв");
    return await searchUzumViaApify(keyword);
  }

  try {
    const { data } = await axios.post(
      env.uzumGraphqlUrl,
      { query: searchQuery(keyword, take), variables: {} },
      { timeout: 15_000, headers: uzumHeaders(token) }
    );

    const search = data?.data?.makeSearch;
    if (!search) {
      logger.warn(`Uzum GraphQL: неожиданный формат ответа для "${keyword}"`);
      return await searchUzumViaApify(keyword);
    }

    const items: Array<{ catalogCard?: { ordersQuantity?: number } }> = search.items ?? [];
    const ordersSum = items.reduce((sum, item) => sum + (item.catalogCard?.ordersQuantity ?? 0), 0);

    return {
      matchCount: Number(search.total ?? items.length ?? 0),
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
