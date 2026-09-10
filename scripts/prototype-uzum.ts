/**
 * Разовый диагностический скрипт для раздела "Следующий шаг" из ТЗ:
 * быстрый прототип запроса к graphql.umarket.uz — проверить, что поиск по
 * ключевым словам действительно отдаёт нужные поля (цена, число заказов).
 *
 * Запуск: npx tsx scripts/prototype-uzum.ts ["поисковый запрос"]
 *
 * Ничего не пишет в БД, не требует .env/Prisma — только сетевой запрос.
 * Печатает сырые ответы по каждому варианту схемы, чтобы можно было свериться
 * с реальной структурой и поправить src/services/uzum.ts.
 */

const ENDPOINT = process.env.UZUM_GRAPHQL_URL ?? "https://graphql.umarket.uz/";
const SEARCH_TEXT = process.argv[2] ?? "женское платье";

async function post(query: string, variables: Record<string, unknown>) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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

  console.log("=== Интроспекция схемы Query (может быть отключена в проде) ===");
  try {
    const { status, json } = await post(INTROSPECTION_QUERY, {});
    console.log(`HTTP ${status}`);
    console.log(JSON.stringify(json, null, 2));
  } catch (err) {
    console.log("Ошибка запроса интроспекции:", err);
  }

  for (const attempt of ATTEMPTS) {
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
    "\nГотово. Пришлите вывод целиком — по нему поправим src/services/uzum.ts под реальную схему."
  );
}

main();
