/**
 * Разовый диагностический скрипт для раздела "Следующий шаг" из ТЗ:
 * прототип запроса к GraphQL Uzum — реальный запрос поиска товаров с ценой,
 * фото и сигналом "заказы/отзывы".
 *
 * История (см. README):
 * - graphql.umarket.uz из ТЗ не резолвится. Живой домен: graphql.uzum.uz.
 * - Нужен Authorization: Bearer <анонимный JWT от "Uzum ID"> + apollographql-client-*,
 *   city-id/latitude/longitude, X-Iid — иначе шлюз (Apollo Federation, судя по
 *   ошибкам subrequest от отдельных сервисов вроде "ad-market") отвечает 401
 *   с пустым телом.
 * - Реальный поиск — makeSearch(query: MakeSearchQueryInput!): MakeSearchResult,
 *   товары — MakeSearchResult.items: [Item!], подтверждено рабочим прогоном
 *   (HTTP 200, total: 7449 по "женское платье").
 * - Item.catalogCard — union-тип CatalogCard (ProductCard | SkuCard | SkuGroupCard).
 *   Автоматический интроспектор в предыдущей версии скрипта не разворачивал
 *   union-поля (только __typename), поэтому карточка товара приходила пустой.
 *   Вместо доразработки автогенератора unions — используем РЕАЛЬНУЮ структуру
 *   фрагмента ProductCardFragment, пойманную в самом первом DevTools-дампе
 *   (Suggestions → recommendationBlock → card): она уже подтверждена рабочей
 *   на их фронтенде и должна работать один в один для item.catalogCard.
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

async function post(query: string, variables: Record<string, unknown> = {}) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({ query, variables }),
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

// ---- Интроспекция enum'ов/inputFields (уже подтверждено рабочим) ---------

interface TypeRefNode {
  kind: string;
  name: string | null;
  ofType: TypeRefNode | null;
}
interface FieldNode {
  name: string;
  type: TypeRefNode;
}
interface EnumValueNode {
  name: string;
}
interface TypeInfo {
  name: string;
  kind: string;
  fields: FieldNode[] | null;
  inputFields: FieldNode[] | null;
  enumValues: EnumValueNode[] | null;
}

function typeIntrospectionQuery(typeName: string): string {
  return `
    query TypeInfo {
      __type(name: "${typeName}") {
        name
        kind
        enumValues { name }
        inputFields { name type { ...TypeRef } }
        fields { name type { ...TypeRef } }
      }
    }
    fragment TypeRef on __Type {
      kind
      name
      ofType { kind name ofType { kind name } }
    }
  `;
}

async function fetchType(name: string): Promise<TypeInfo | null> {
  const { json } = await post(typeIntrospectionQuery(name));
  return ((json as any)?.data?.__type ?? null) as TypeInfo | null;
}

function pickEnumValue(type: TypeInfo | null, preferSubstrings: string[]): string | null {
  const values = type?.enumValues?.map((v) => v.name) ?? [];
  if (values.length === 0) return null;
  for (const pref of preferSubstrings) {
    const hit = values.find((v) => v.toUpperCase().includes(pref));
    if (hit) return hit;
  }
  return values[0];
}

function graphqlStringLiteral(s: string): string {
  return JSON.stringify(s);
}

// Реальный, подтверждённый DevTools-дампом фрагмент карточки товара.
// title/adult — общие поля discovery; id/productId различаются по конкретному
// типу (DiscoveryProductCard/DiscoverySkuCard/DiscoverySkuGroupCard).
// feedback.quantity — похоже на число отзывов (не гарантированно = числу
// заказов, но ближайший доступный в этой карточке сигнал; есть отдельный
// sort BY_ORDERS_NUMBER_DESC на верхнем уровне поиска — значит точное число
// заказов Uzum хранит, но не факт что отдаёт в этой карточке напрямую).
const CATALOG_CARD_SELECTION = `
  ... on ProductCard { carrierCode cpoId cpoVersion }
  ... on SkuGroupCard { carrierCode }
  discovery {
    ... on DiscoveryProductCard { id }
    ... on DiscoverySkuCard { id productId }
    ... on DiscoverySkuGroupCard { id productId }
    title
    adult
    priceBlock {
      sellPrice { amount description }
      finalPrice { amount description }
      fullPrice { amount description }
    }
    photos { key link(trans: SIZE_540) { high } }
    feedback { quantity rating }
    singleSku
    defaultSkuId
  }
`;

async function main() {
  console.log(`Эндпоинт: ${ENDPOINT}`);
  console.log(`Поисковый запрос: "${SEARCH_TEXT}"\n`);

  console.log("=== Изучаем ShowAdultContent, Sort, PaginationInput ===");
  const [showAdultContentType, sortType, paginationType] = await Promise.all([
    fetchType("ShowAdultContent"),
    fetchType("Sort"),
    fetchType("PaginationInput"),
  ]);

  const showAdultContentValue = pickEnumValue(showAdultContentType, ["HIDE", "DISALLOW", "NOT_SHOW", "FALSE", "NO"]);
  const sortValue = pickEnumValue(sortType, ["POPULAR", "RELEVANCE", "RATING", "DEFAULT"]);
  console.log(`showAdultContent=${showAdultContentValue}, sort=${sortValue}`);

  const pagination: Record<string, number> = {};
  for (const f of paginationType?.inputFields ?? []) {
    const n = f.name.toLowerCase();
    if (n.includes("size") || n.includes("limit") || n.includes("take") || n.includes("count")) {
      pagination[f.name] = 10;
    } else if (n.includes("page") || n.includes("offset") || n.includes("skip")) {
      pagination[f.name] = 0;
    }
  }

  // Ищем явное поле про число заказов на конкретных типах карточки — sort
  // BY_ORDERS_NUMBER_DESC подтверждает, что Uzum это где-то считает.
  console.log("\n=== Ищем поля про заказы на ProductCard/SkuCard/SkuGroupCard ===");
  for (const typeName of ["ProductCard", "SkuCard", "SkuGroupCard", "DiscoveryProductCard", "DiscoverySkuCard", "DiscoverySkuGroupCard"]) {
    const t = await fetchType(typeName);
    const names = t?.fields?.map((f) => f.name) ?? [];
    const orderish = names.filter((n) => /order|sold|sale/i.test(n));
    console.log(`${typeName}: все поля = [${names.join(", ")}]`);
    if (orderish.length) console.log(`  ⭐ похоже на заказы: [${orderish.join(", ")}]`);
  }

  if (!showAdultContentValue || !sortValue) {
    console.log("\n⚠️  Не удалось определить enum'ы автоматически — пришлите вывод целиком.");
    return;
  }

  const paginationLiteral = "{ " + Object.entries(pagination).map(([k, v]) => `${k}: ${v}`).join(", ") + " }";
  const queryLiteral =
    `{ text: ${graphqlStringLiteral(SEARCH_TEXT)}, showAdultContent: ${showAdultContentValue}, ` +
    `filters: [], sort: ${sortValue}, pagination: ${paginationLiteral} }`;

  const searchQuery = `
    query Search {
      makeSearch(query: ${queryLiteral}) {
        total
        items {
          bidId
          catalogCard { ${CATALOG_CARD_SELECTION} }
        }
      }
    }
  `;

  console.log("\n=== Отправляем реальный makeSearch с настоящей карточкой товара ===");
  console.log(searchQuery);
  try {
    const { status, json } = await post(searchQuery);
    console.log(`HTTP ${status}`);
    console.log(JSON.stringify(json, null, 2));
  } catch (err) {
    console.log("Ошибка запроса:", err);
  }

  console.log("\nГотово. Пришлите вывод целиком.");
}

main();
