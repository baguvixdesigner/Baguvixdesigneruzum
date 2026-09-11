/**
 * Финальная проверка интеграции с Uzum (раздел "Следующий шаг" ТЗ): полностью
 * автоматический прогон — получает анонимный Bearer-токен сам (без ручного
 * копирования из DevTools) и делает реальный поиск товаров.
 *
 * Зеркалит src/services/uzumAuth.ts + src/services/uzum.ts на axios (не на
 * fetch() — у fetch() в Node при redirect: "manual" ответ "непрозрачный" и не
 * даёт читать заголовки/куки, это ломает получение _yasc; axios такого
 * ограничения не имеет).
 *
 * История (см. README):
 * - graphql.umarket.uz из ТЗ не резолвится — устарел. Живой домен: graphql.uzum.uz.
 * - GraphQL Uzum (Apollo Federation-шлюз) требует Authorization: Bearer <JWT> —
 *   без него 401 с пустым телом.
 * - Токен добывается воспроизведением флоу их сайта (снято через DevTools):
 *     1) GET https://uzum.uz/ → 307 → Set-Cookie: _yasc=... (кука привязки к
 *        серверу их балансировщика Yandex Cloud, НЕ HttpOnly, ставится чистым
 *        HTTP-редиректом без JS/капчи — server: ycalb).
 *     2) POST https://id.uzum.uz/api/auth/token с этой кукой, пустое тело →
 *        Set-Cookie: access_token=<JWT> (HttpOnly — недоступно JS в браузере,
 *        но обычный HTTP-клиент читает Set-Cookie напрямую).
 * - Реальный поиск — makeSearch(query: MakeSearchQueryInput!): MakeSearchResult,
 *   товары в MakeSearchResult.items, карточка — union CatalogCard (ProductCard |
 *   SkuCard | SkuGroupCard), у каждого варианта есть ordersQuantity (число заказов).
 *   Подтверждено живым прогоном: HTTP 200, total: 7449 по "женское платье".
 *
 * Запуск (без переменных окружения — токен получается сам):
 *   npx tsx scripts/prototype-uzum.ts ["поисковый запрос"]
 *
 * Ничего не пишет в БД, не требует .env/Prisma — только сетевые запросы (axios
 * уже есть в зависимостях проекта).
 */

import axios from "axios";
import { randomUUID } from "node:crypto";

const GRAPHQL_ENDPOINT = "https://graphql.uzum.uz/";
const SEARCH_TEXT = process.argv[2] ?? "женское платье";

const COMMON_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
};

function extractSetCookieValue(setCookieHeaders: unknown, name: string): string | null {
  const headers = Array.isArray(setCookieHeaders) ? (setCookieHeaders as string[]) : [];
  for (const header of headers) {
    const match = header.match(new RegExp(`^${name}=([^;]+)`));
    if (match) return match[1];
  }
  return null;
}

async function fetchStickySessionCookie(): Promise<string> {
  const res = await axios.get("https://uzum.uz/", {
    headers: COMMON_HEADERS,
    maxRedirects: 0,
    validateStatus: (status) => status < 400,
    timeout: 15_000,
  });
  const yasc = extractSetCookieValue(res.headers["set-cookie"], "_yasc");
  if (!yasc) throw new Error(`Не удалось получить _yasc, статус ответа: ${res.status}`);
  return yasc;
}

async function mintAnonymousToken(yasc: string): Promise<string> {
  const res = await axios.post("https://id.uzum.uz/api/auth/token", undefined, {
    headers: {
      ...COMMON_HEADERS,
      Accept: "*/*",
      "Accept-Language": "ru",
      "Content-Type": "application/json",
      Origin: "https://uzum.uz",
      Referer: "https://uzum.uz/",
      Cookie: `_yasc=${yasc}`,
    },
    timeout: 15_000,
  });
  const token = extractSetCookieValue(res.headers["set-cookie"], "access_token");
  if (!token) throw new Error(`Не удалось получить access_token, статус ответа: ${res.status}`);
  return token;
}

async function getFreshToken(): Promise<string> {
  console.log("Шаг 1: получаем _yasc от uzum.uz...");
  const yasc = await fetchStickySessionCookie();
  console.log(`_yasc получен (${yasc.slice(0, 20)}...)`);

  console.log("Шаг 2: получаем access_token от id.uzum.uz...");
  const token = await mintAnonymousToken(yasc);
  console.log(`access_token получен (${token.slice(0, 20)}...)\n`);
  return token;
}

function buildHeaders(token: string): Record<string, string> {
  return {
    ...COMMON_HEADERS,
    "Content-Type": "application/json",
    Accept: "*/*",
    "Accept-Language": "ru-RU",
    "apollographql-client-name": "web-customers",
    "apollographql-client-version": "1.63.2",
    "city-id": "1",
    "city-latitude": "41.379112",
    "city-longitude": "69.29944",
    latitude: "41.379112",
    longitude: "69.29944",
    Origin: "https://uzum.uz",
    Referer: "https://uzum.uz/",
    "X-Iid": randomUUID(),
    Authorization: `Bearer ${token}`,
  };
}

function graphqlStringLiteral(s: string): string {
  return JSON.stringify(s);
}

function searchQuery(keyword: string, take: number, sort: string): string {
  return `
    query Search {
      makeSearch(query: {
        text: ${graphqlStringLiteral(keyword)},
        showAdultContent: FALSE,
        filters: [],
        sort: ${sort},
        pagination: { offset: 0, limit: ${take} }
      }) {
        total
        items {
          catalogCard {
            ... on ProductCard { ordersQuantity }
            ... on SkuCard { ordersQuantity }
            ... on SkuGroupCard { ordersQuantity }
            discovery {
              title
              priceBlock { sellPrice { amount } }
              feedback { quantity rating }
            }
          }
        }
      }
    }
  `;
}

async function runSearch(token: string, sort: string) {
  console.log(`\n=== makeSearch, sort: ${sort} ===`);
  const { data, status } = await axios.post(
    GRAPHQL_ENDPOINT,
    { query: searchQuery(SEARCH_TEXT, 10, sort), variables: {} },
    { headers: buildHeaders(token), timeout: 15_000, validateStatus: () => true }
  );
  console.log(`HTTP ${status}`);

  const total = data?.data?.makeSearch?.total;
  const items = data?.data?.makeSearch?.items ?? [];
  console.log(`total=${total}`);
  for (const item of items) {
    const c = item?.catalogCard;
    console.log(
      `  orders=${c?.ordersQuantity ?? "?"}  отзывы=${c?.discovery?.feedback?.quantity ?? "?"}  ` +
        `рейтинг=${c?.discovery?.feedback?.rating ?? "?"}  цена=${c?.discovery?.priceBlock?.sellPrice?.amount ?? "?"}  ` +
        `"${c?.discovery?.title ?? "?"}"`
    );
  }
  if (status !== 200) console.log(JSON.stringify(data, null, 2));
  return { total, items };
}

async function main() {
  console.log(`Поисковый запрос: "${SEARCH_TEXT}"\n`);

  const token = await getFreshToken();

  // Сортировка по релевантности — то, что реально увидит обычный пользователь
  // (и что мы используем в пайплайне).
  await runSearch(token, "BY_RELEVANCE_DESC");

  // Сортировка по числу заказов — если ordersQuantity рабочее поле, топ здесь
  // должен показать ненулевые (и большие) значения. Если снова везде 0 —
  // значит поле для этого запроса не заполняется вообще, и нужно переключиться
  // на feedback.quantity (число отзывов) как прокси-сигнал вместо заказов.
  await runSearch(token, "BY_ORDERS_NUMBER_DESC");

  console.log(
    "\nГотово. Пришлите вывод целиком — особенно второй блок (BY_ORDERS_NUMBER_DESC): " +
      "если там тоже везде orders=0, переключаем сигнал на число отзывов."
  );
}

main().catch((err) => {
  console.error("Ошибка:", err);
  process.exit(1);
});
