/**
 * Разовый диагностический скрипт для раздела "Следующий шаг" из ТЗ:
 * прототип запроса к GraphQL Uzum — найти реальный запрос поиска товаров и
 * проверить, что он отдаёт нужные поля (цена, отзывы/заказы).
 *
 * История (см. README):
 * - graphql.umarket.uz из ТЗ не резолвится. Живой домен: graphql.uzum.uz.
 * - Нужен Authorization: Bearer <анонимный JWT от "Uzum ID"> + apollographql-client-*,
 *   city-id/latitude/longitude, X-Iid — иначе шлюз отвечает 401 с пустым телом.
 * - Интроспекция схемы не отключена. Реальный поиск — `makeSearch(query:
 *   MakeSearchQueryInput!): MakeSearchResult`, товары — в `MakeSearchResult.items: [Item!]`.
 *   Обязательные поля запроса: showAdultContent (enum), filters ([FilterInput!]!),
 *   sort (enum), pagination (PaginationInput!).
 *
 * Этот скрипт вместо дальнейших ручных догадок САМ:
 *  1) вытаскивает значения enum'ов ShowAdultContent/Sort и поля PaginationInput;
 *  2) рекурсивно (с мемоизацией и защитой от циклов) строит selection set для Item,
 *     пропуская поля, требующие обязательных аргументов, которые мы не можем угадать;
 *  3) собирает и отправляет реальный makeSearch-запрос, печатает результат.
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

// ---- Интроспекция типов --------------------------------------------------

interface TypeRefNode {
  kind: string;
  name: string | null;
  ofType: TypeRefNode | null;
}
interface FieldArgNode {
  name: string;
  type: TypeRefNode;
}
interface FieldNode {
  name: string;
  type: TypeRefNode;
  args?: FieldArgNode[];
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

// Имя типа подставляется прямо в текст запроса (не через $variables) — их бэкенд
// (судя по формулировке ошибок — graphql-java, не Apollo Server) почему-то не
// принимал переменные именно в запросах интроспекции, хотя в обычных запросах
// переменные работают нормально.
function typeIntrospectionQuery(typeName: string): string {
  return `
    query TypeInfo {
      __type(name: "${typeName}") {
        name
        kind
        enumValues { name }
        inputFields { name type { ...TypeRef } }
        fields {
          name
          args { name type { ...TypeRef } }
          type { ...TypeRef }
        }
      }
    }
    fragment TypeRef on __Type {
      kind
      name
      ofType {
        kind
        name
        ofType {
          kind
          name
          ofType {
            kind
            name
            ofType { kind name }
          }
        }
      }
    }
  `;
}

const typeCache = new Map<string, TypeInfo | null>();

async function fetchType(name: string): Promise<TypeInfo | null> {
  if (typeCache.has(name)) return typeCache.get(name) ?? null;
  const { json } = await post(typeIntrospectionQuery(name));
  const type = ((json as any)?.data?.__type ?? null) as TypeInfo | null;
  typeCache.set(name, type);
  return type;
}

// Разворачивает NON_NULL/LIST-обёртки до именованного типа.
function resolveNamed(node: TypeRefNode): { kind: string; name: string | null; isList: boolean } {
  let isList = false;
  let cur: TypeRefNode | null = node;
  while (cur) {
    if (cur.kind === "LIST") isList = true;
    if (cur.name) return { kind: cur.kind, name: cur.name, isList };
    cur = cur.ofType;
  }
  return { kind: "UNKNOWN", name: null, isList };
}

const SCALAR_KINDS = new Set(["SCALAR", "ENUM"]);

// Рекурсивно строит selection set для объектного типа: скаляры/энумы — напрямую,
// вложенные объекты — рекурсивно (с ограничением глубины и защитой от циклов),
// поля с обязательными аргументами — пропускаются (мы не можем их угадать).
async function buildSelectionSet(typeName: string, depth: number, visited: Set<string>): Promise<string> {
  if (depth < 0 || visited.has(typeName)) return "";
  const type = await fetchType(typeName);
  if (!type?.fields) return "";

  const nextVisited = new Set(visited);
  nextVisited.add(typeName);

  const parts: string[] = [];
  for (const field of type.fields) {
    const hasRequiredArg = (field.args ?? []).some((a) => a.type.kind === "NON_NULL");
    if (hasRequiredArg) continue;

    const resolved = resolveNamed(field.type);
    if (!resolved.name) continue;

    if (SCALAR_KINDS.has(resolved.kind)) {
      parts.push(field.name);
    } else if (resolved.kind === "OBJECT" && depth > 0) {
      const sub = await buildSelectionSet(resolved.name, depth - 1, nextVisited);
      if (sub) parts.push(`${field.name} { ${sub} }`);
    } else if ((resolved.kind === "INTERFACE" || resolved.kind === "UNION") && depth > 0) {
      parts.push(`${field.name} { __typename }`);
    }
  }
  return parts.join(" ");
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

async function main() {
  console.log(`Эндпоинт: ${ENDPOINT}`);
  console.log(`Поисковый запрос: "${SEARCH_TEXT}"\n`);

  console.log("=== Изучаем ShowAdultContent, Sort, PaginationInput ===");
  const [showAdultContentType, sortType, paginationType] = await Promise.all([
    fetchType("ShowAdultContent"),
    fetchType("Sort"),
    fetchType("PaginationInput"),
  ]);

  console.log("ShowAdultContent enumValues:", showAdultContentType?.enumValues?.map((v) => v.name));
  console.log("Sort enumValues:", sortType?.enumValues?.map((v) => v.name));
  console.log("PaginationInput inputFields:", paginationType?.inputFields?.map((f) => f.name));

  const showAdultContentValue = pickEnumValue(showAdultContentType, ["HIDE", "DISALLOW", "NOT_SHOW", "FALSE", "NO"]);
  const sortValue = pickEnumValue(sortType, ["POPULAR", "RELEVANCE", "RATING", "DEFAULT"]);

  const pagination: Record<string, number> = {};
  for (const f of paginationType?.inputFields ?? []) {
    const n = f.name.toLowerCase();
    if (n.includes("size") || n.includes("limit") || n.includes("take") || n.includes("count")) {
      pagination[f.name] = 10;
    } else if (n.includes("page") || n.includes("offset") || n.includes("skip")) {
      pagination[f.name] = 0;
    }
  }

  console.log(`\nВыбрано: showAdultContent=${showAdultContentValue}, sort=${sortValue}, pagination=`, pagination);

  console.log("\n=== Строим selection set для Item (рекурсивно, может занять до минуты) ===");
  const itemSelection = await buildSelectionSet("Item", 4, new Set());
  console.log("Item selection set:\n" + itemSelection);

  if (!showAdultContentValue || !sortValue || !itemSelection) {
    console.log(
      "\n⚠️  Не удалось собрать все части запроса автоматически (см. значения выше). " +
        "Пришлите весь вывод — доберём вручную."
    );
    return;
  }

  const paginationLiteral =
    "{ " + Object.entries(pagination).map(([k, v]) => `${k}: ${v}`).join(", ") + " }";
  const queryLiteral =
    `{ text: ${graphqlStringLiteral(SEARCH_TEXT)}, showAdultContent: ${showAdultContentValue}, ` +
    `filters: [], sort: ${sortValue}, pagination: ${paginationLiteral} }`;

  const searchQuery = `
    query Search {
      makeSearch(query: ${queryLiteral}) {
        total
        items { ${itemSelection} }
      }
    }
  `;

  console.log("\n=== Отправляем реальный makeSearch ===");
  console.log(searchQuery);
  try {
    const { status, json } = await post(searchQuery);
    console.log(`HTTP ${status}`);
    console.log(JSON.stringify(json, null, 2));
  } catch (err) {
    console.log("Ошибка запроса:", err);
  }

  console.log("\nГотово. Пришлите вывод целиком — особенно блок 'Отправляем реальный makeSearch'.");
}

main();
