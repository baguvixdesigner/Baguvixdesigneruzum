/**
 * Разовый диагностический скрипт для раздела "Следующий шаг" из ТЗ:
 * быстрый прототип запроса к GraphQL Uzum — проверить, что поиск по
 * ключевым словам отдаёт нужные поля (цена, число заказов).
 *
 * Домен из ТЗ (graphql.umarket.uz) не резолвится — устарел. Реальный,
 * резолвящийся и отвечающий (HTTP 401, не таймаут) домен — graphql.uzum.uz
 * (обнаружено через scripts/discover-uzum-api.ts). 401 означает, что эндпоинт
 * жив, но чего-то не хватает в запросе — скорее всего заголовков, которые
 * упоминают open-source проекты (X-Iid и т.п.). Этот скрипт пробует несколько
 * комбинаций заголовков и вариантов схемы.
 *
 * Запуск: npx tsx scripts/prototype-uzum.ts ["поисковый запрос"]
 *
 * Ничего не пишет в БД, не требует .env/Prisma — только сетевые запросы.
 */

import { randomUUID } from "node:crypto";

const ENDPOINT = process.env.UZUM_GRAPHQL_URL ?? "https://graphql.uzum.uz/";
const SEARCH_TEXT = process.argv[2] ?? "женское платье";

const HEADER_SETS: Array<{ label: string; headers: Record<string, string> }> = [
  {
    label: "только Content-Type",
    headers: { "Content-Type": "application/json" },
  },
  {
    label: "+ Accept-Language, Accept, X-Iid (случайный UUID), браузерный User-Agent",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Accept-Language": "ru-RU",
      "X-Iid": randomUUID(),
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    },
  },
];

async function post(headers: Record<string, string>, query: string, variables: Record<string, unknown>) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });
  const status = res.status;
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    json = await res.text();
  }
  return { status, json };
}

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

const ATTEMPTS: Array<{ label: string; query: string; variables: Record<string, unknown> }> = [
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
    label: "Вариант B: makeSearch(text) { total, products { id title orderAmount ordersAmount price } }",
    query: `
      query SearchProducts($text: String!) {
        makeSearch(text: $text) {
          total
          products { id title orderAmount ordersAmount price { total } }
        }
      }
    `,
    variables: { text: SEARCH_TEXT },
  },
  {
    label: "Вариант C: search(query) { total, items { id title ordersQuantity } }",
    query: `
      query Search($q: String!) {
        search(query: $q) {
          total
          items { id title ordersQuantity }
        }
      }
    `,
    variables: { q: SEARCH_TEXT },
  },
];

async function main() {
  console.log(`Эндпоинт: ${ENDPOINT}`);
  console.log(`Поисковый запрос: "${SEARCH_TEXT}"\n`);

  for (const headerSet of HEADER_SETS) {
    console.log(`\n########## Заголовки: ${headerSet.label} ##########`);

    console.log("\n=== Интроспекция схемы Query (может быть отключена в проде) ===");
    try {
      const { status, json } = await post(headerSet.headers, INTROSPECTION_QUERY, {});
      console.log(`HTTP ${status}`);
      console.log(JSON.stringify(json, null, 2));
    } catch (err) {
      console.log("Ошибка запроса интроспекции:", err);
    }

    for (const attempt of ATTEMPTS) {
      console.log(`\n=== ${attempt.label} ===`);
      try {
        const { status, json } = await post(headerSet.headers, attempt.query, attempt.variables);
        console.log(`HTTP ${status}`);
        console.log(JSON.stringify(json, null, 2));
      } catch (err) {
        console.log("Ошибка запроса:", err);
      }
    }
  }

  console.log(
    "\nГотово. Пришлите вывод целиком — по нему поправим src/services/uzum.ts под реальную схему.\n" +
      "Если везде 401/403 с телом ошибки вида 'missing header X' — пришлите текст ошибки, " +
      "добавим нужный заголовок. Если структура полей отличается (GraphQL обычно отвечает " +
      "списком 'Did you mean...' при опечатке в имени поля) — это тоже подскажет реальную схему."
  );
}

main();
