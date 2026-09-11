/**
 * Разовая проверка пробного доступа Oxylabs (раздел "Следующий шаг" ТЗ):
 * убедиться, что source: "universal" реально отдаёт данные с Taobao/1688 по
 * прямой ссылке на страницу поиска, и понять формат ответа (сырой HTML или
 * распарсенный JSON) — чтобы понять, нужен ли свой html-парсер.
 *
 * В личном кабинете Oxylabs (Scraping solutions → Other) показан пример именно
 * с source: "universal" + прямой URL — это отличается от изначального
 * предположения в src/services/oxylabs.ts (там был жёстко зашит несуществующий
 * именной source "taobao_search"/"1688_search" — нужно поправить по итогам
 * этого прогона).
 *
 * Запуск (расходует лимит пробного доступа — по умолчанию 1 запрос):
 *   OXYLABS_USERNAME=... OXYLABS_PASSWORD=... npx tsx scripts/prototype-oxylabs.ts
 *
 * Опционально: SITE=taobao|1688 (по умолчанию taobao), QUERY="женское платье"
 */

import axios from "axios";

const USERNAME = process.env.OXYLABS_USERNAME;
const PASSWORD = process.env.OXYLABS_PASSWORD;
const SITE = process.env.SITE ?? "taobao";
const QUERY = process.env.QUERY ?? "连衣裙"; // "платье" по-китайски

if (!USERNAME || !PASSWORD) {
  console.log("⚠️  Задайте OXYLABS_USERNAME и OXYLABS_PASSWORD (из личного кабинета Oxylabs).");
  process.exit(1);
}

function buildSearchUrl(site: string, query: string): string {
  const encoded = encodeURIComponent(query);
  if (site === "1688") {
    return `https://s.1688.com/selloffer/offer_search.htm?keywords=${encoded}`;
  }
  return `https://s.taobao.com/search?q=${encoded}`;
}

async function main() {
  const url = buildSearchUrl(SITE, QUERY);
  console.log(`Сайт: ${SITE}`);
  console.log(`URL: ${url}\n`);

  const payload = {
    source: "universal",
    url,
    parse: true,
    render: "html", // Taobao/1688 сильно на JS, без рендера может прийти пустая оболочка
    geo_location: "China",
  };

  console.log("Запрос к Oxylabs:", JSON.stringify(payload, null, 2));

  try {
    const { status, data } = await axios.post("https://realtime.oxylabs.io/v1/queries", payload, {
      auth: { username: USERNAME!, password: PASSWORD! },
      timeout: 60_000,
      validateStatus: () => true,
    });

    console.log(`\nHTTP ${status}`);

    const result = data?.results?.[0];
    if (!result) {
      console.log("Полный ответ (нет ожидаемой структуры results[0]):");
      console.log(JSON.stringify(data, null, 2).slice(0, 3000));
      return;
    }

    console.log("Ключи results[0]:", Object.keys(result));
    console.log("Тип content:", typeof result.content);

    if (typeof result.content === "string") {
      console.log("\ncontent — строка (сырой HTML/markdown), первые 2000 символов:");
      console.log(result.content.slice(0, 2000));
      console.log(`\n... (всего ${result.content.length} символов)`);
    } else {
      console.log("\ncontent — объект (распарсенный JSON):");
      console.log(JSON.stringify(result.content, null, 2).slice(0, 4000));
    }
  } catch (err) {
    console.log("Ошибка запроса:", err);
  }

  console.log("\nГотово. Пришлите вывод целиком — по нему решим, нужен ли свой HTML-парсер.");
}

main();
