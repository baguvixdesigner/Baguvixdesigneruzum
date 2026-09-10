/**
 * Разовый диагностический скрипт для раздела "Следующий шаг" из ТЗ:
 * быстрый прототип запроса к GraphQL Uzum — проверить, что поиск по
 * ключевым словам отдаёт нужные поля (цена, число заказов).
 *
 * История:
 * - graphql.umarket.uz из ТЗ не резолвится — устарел. Живой домен: graphql.uzum.uz.
 * - graphql.uzum.uz без заголовков отвечал 401 с ПУСТЫМ телом — это отказ на уровне
 *   шлюза/WAF, а не GraphQL-сервера. Реальный трафик из DevTools (Network → Copy as
 *   cURL) показал: нужен `Authorization: Bearer <JWT>` (анонимный токен, выдан "Uzum ID",
 *   живёт ~3 часа), плюс `apollographql-client-name/version`, `city-id`,
 *   `city-latitude`/`city-longitude`, `x-iid`, `origin`, `referer`.
 * - Токен пока добывается вручную из браузера (DevTools → Network → любой запрос к
 *   graphql.uzum.uz → заголовок authorization) и передаётся через UZUM_BEARER_TOKEN.
 *   Программный способ получить его (найти запрос, который его выдаёт) — следующий шаг,
 *   см. README.
 *
 * Запуск:
 *   UZUM_BEARER_TOKEN="eyJ..." npx tsx scripts/prototype-uzum.ts ["поисковый запрос"]
 *
 * Ничего не пишет в БД, не требует .env/Prisma — только сетевые запросы.
 */

import { randomUUID } from "node:crypto";

const ENDPOINT = process.env.UZUM_GRAPHQL_URL ?? "https://graphql.uzum.uz/";
const SEARCH_TEXT = process.argv[2] ?? "женское платье";
const BEARER_TOKEN = process.env.UZUM_BEARER_TOKEN;

if (!BEARER_TOKEN) {
  console.log(
    "⚠️  UZUM_BEARER_TOKEN не задан. graphql.uzum.uz отвечает 401 без валидного анонимного\n" +
      "   токена (см. комментарий в начале файла). Возьмите его из DevTools → Network →\n" +
      "   любой запрос к graphql.uzum.uz → заголовок 'authorization' (значение после 'Bearer ')\n" +
      "   и запустите:\n\n" +
      '   UZUM_BEARER_TOKEN="eyJ..." npx tsx scripts/prototype-uzum.ts "женское платье"\n\n' +
      "   Продолжаем без токена — ожидаемо снова получим 401.\n"
  );
}

// Заголовки — точная копия того, что реально отправляет сайт uzum.uz (снято через
// DevTools → Copy as cURL). Geo — координаты Ташкента по умолчанию.
function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
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
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  };
  if (BEARER_TOKEN) headers.Authorization = `Bearer ${BEARER_TOKEN}`;
  return headers;
}

async function post(query: string, variables: Record<string, unknown>, operationName?: string) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({ query, variables, operationName }),
  });
  const status = res.status;
  const bodyText = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(bodyText);
  } catch {
    json = bodyText;
  }
  return { status, json };
}

// Реальный запрос автодополнения, пойманный в DevTools (operationName: Suggestions).
// Используем его как sanity-check: если он проходит (200, не 401) — токен/заголовки
// верные, и дальше остаётся только угадать/поймать имя запроса самого поиска товаров.
const SUGGESTIONS_QUERY = `
  query Suggestions($GetSuggestionsInput: GetSuggestionsInput!) {
    getSuggestions(query: $GetSuggestionsInput) {
      blocks {
        ... on TextSuggestionsBlock { values __typename }
        ... on PopularSuggestionsBlock { popularSuggestions __typename }
        __typename
      }
      __typename
    }
  }
`;

const INTROSPECTION_QUERY = `
  query IntrospectMakeSearch {
    __type(name: "Query") {
      fields {
        name
        args { name type { name kind ofType { name kind } } }
      }
    }
  }
`;

const SEARCH_ATTEMPTS: Array<{ label: string; query: string; variables: Record<string, unknown> }> = [
  {
    label: "Вариант A: makeSearch(text, options.pagination.take/skip) { total, products { id, orders } }",
    query: `
      query SearchProducts($text: String!, $take: Int!) {
        makeSearch(text: $text, options: { pagination: { take: $take, skip: 0 } }) {
          total
          products { id orders }
        }
      }
    `,
    variables: { text: SEARCH_TEXT, take: 5 },
  },
  {
    label: "Вариант B: search(text) { total, items { ...CatalogCard-подобные поля } }",
    query: `
      query Search($text: String!) {
        search(text: $text) {
          total
          items { id title }
        }
      }
    `,
    variables: { text: SEARCH_TEXT },
  },
];

async function main() {
  console.log(`Эндпоинт: ${ENDPOINT}`);
  console.log(`Поисковый запрос: "${SEARCH_TEXT}"\n`);

  console.log("=== Sanity-check: реальный запрос автодополнения (Suggestions) ===");
  try {
    const { status, json } = await post(
      SUGGESTIONS_QUERY,
      {
        GetSuggestionsInput: {
          text: SEARCH_TEXT,
          textSuggestionsLimit: 3,
          popularSuggestionsLimit: 3,
          catalogCardSuggestionsLimit: 0,
          categorySuggestionsLimit: 3,
          shopSuggestionsLimit: 3,
          textInOfferCategorySuggestionsLimit: 3,
        },
      },
      "Suggestions"
    );
    console.log(`HTTP ${status}`);
    console.log(JSON.stringify(json, null, 2));
  } catch (err) {
    console.log("Ошибка запроса:", err);
  }

  console.log("\n=== Интроспекция схемы Query (может быть отключена в проде) ===");
  try {
    const { status, json } = await post(INTROSPECTION_QUERY, {});
    console.log(`HTTP ${status}`);
    console.log(JSON.stringify(json, null, 2));
  } catch (err) {
    console.log("Ошибка запроса интроспекции:", err);
  }

  for (const attempt of SEARCH_ATTEMPTS) {
    console.log(`\n=== ${attempt.label} ===`);
    try {
      const { status, json } = await post(attempt.query, attempt.variables);
      console.log(`HTTP ${status}`);
      console.log(JSON.stringify(json, null, 2));
    } catch (err) {
      console.log("Ошибка запроса:", err);
    }
  }

  console.log(
    "\nГотово. Пришлите вывод целиком.\n" +
      "Если sanity-check (Suggestions) вернул 200 с данными — заголовки/токен верные, " +
      "и дальше нужен настоящий запрос поиска товаров из DevTools (введите текст полностью " +
      "и дождитесь сетки товаров, не просто подсказок) — пришлите его как Copy as cURL."
  );
}

main();
