/**
 * Разовый диагностический скрипт для раздела "Следующий шаг" из ТЗ:
 * быстрый прототип запроса к GraphQL Uzum — проверить, что поиск по
 * ключевым словам отдаёт нужные поля (цена, число заказов/отзывов).
 *
 * История (см. README для деталей):
 * - graphql.umarket.uz из ТЗ не резолвится — устарел. Живой домен: graphql.uzum.uz.
 * - Нужен Authorization: Bearer <анонимный JWT от "Uzum ID"> + apollographql-client-*,
 *   city-id/latitude/longitude, X-Iid — иначе шлюз отвечает 401 с пустым телом.
 * - Интроспекция схемы НЕ отключена — реальный поиск: `makeSearch(query:
 *   MakeSearchQueryInput!): MakeSearchResult` (не то, что было угадано изначально).
 *   Этот скрипт сам вытаскивает поля MakeSearchQueryInput/MakeSearchResult через
 *   интроспекцию, вместо угадывания вслепую.
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
    "⚠️  UZUM_BEARER_TOKEN не задан — graphql.uzum.uz ответит 401. Возьмите токен из\n" +
      "   DevTools → Network → запрос к graphql.uzum.uz → Headers → authorization.\n"
  );
}

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

// Достаёт поля типа/input-типа с разворачиванием NON_NULL/LIST на 3 уровня —
// этого обычно хватает, чтобы увидеть реальную "форму" поля.
const TYPE_INTROSPECTION_QUERY = `
  query TypeInfo($name: String!) {
    __type(name: $name) {
      name
      kind
      fields { name type { ...TypeRef } }
      inputFields { name type { ...TypeRef } }
    }
  }
  fragment TypeRef on __Type {
    name
    kind
    ofType {
      name
      kind
      ofType {
        name
        kind
        ofType { name kind }
      }
    }
  }
`;

async function introspectType(name: string) {
  console.log(`\n=== Схема типа: ${name} ===`);
  try {
    const { status, json } = await post(TYPE_INTROSPECTION_QUERY, { name });
    console.log(`HTTP ${status}`);
    console.log(JSON.stringify(json, null, 2));
  } catch (err) {
    console.log("Ошибка запроса:", err);
  }
}

async function main() {
  console.log(`Эндпоинт: ${ENDPOINT}`);
  console.log(`Поисковый запрос: "${SEARCH_TEXT}"\n`);

  // Уже подтверждено рабочим предыдущим прогоном (200 + реальные данные) — держим
  // как sanity-check на случай, если токен вдруг протух.
  console.log("=== Sanity-check: getSuggestions ===");
  try {
    const { status, json } = await post(
      `query Suggestions($q: GetSuggestionsInput!) { getSuggestions(query: $q) { blocks { __typename } } }`,
      { q: { text: SEARCH_TEXT, textSuggestionsLimit: 1, popularSuggestionsLimit: 1, catalogCardSuggestionsLimit: 0, categorySuggestionsLimit: 1, shopSuggestionsLimit: 1, textInOfferCategorySuggestionsLimit: 1 } }
    );
    console.log(`HTTP ${status}`);
    console.log(JSON.stringify(json, null, 2));
  } catch (err) {
    console.log("Ошибка запроса:", err);
  }

  // Главное: реальная форма запроса поиска товаров.
  await introspectType("MakeSearchQueryInput");
  await introspectType("MakeSearchResult");

  console.log(
    "\nГотово. Пришлите вывод целиком (особенно два последних блока про MakeSearchQueryInput " +
      "и MakeSearchResult) — по ним соберём правильный запрос makeSearch без дальнейших догадок."
  );
}

main();
