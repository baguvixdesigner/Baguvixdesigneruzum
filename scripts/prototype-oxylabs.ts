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
import { writeFileSync } from "node:fs";

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
    // parse: true убран — для Taobao/1688 (не "именной" источник Oxylabs) он требует
    // ещё parser_type/parsing_instructions ("Unknown Parser url is allowed only with...").
    // Сначала смотрим на сырой HTML, чтобы понять, разумно ли парсить самим.
    render: "html", // Taobao/1688 сильно на JS, без рендера может прийти пустая оболочка
    geo_location: "China",
    // Первая попытка (без этого) один раз поймала полную выдачу (400КБ), другой раз —
    // только SPA-оболочку без данных (35КБ, товары подгружаются отдельным JS-запросом
    // уже после начального рендера). Явно ждём перед снимком DOM.
    browser_instructions: [{ type: "wait", wait_time_s: 6 }],
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
      const html = result.content;
      const outFile = `oxylabs-${SITE}-${Date.now()}.html`;
      writeFileSync(outFile, html, "utf-8");
      console.log(`\ncontent — строка (HTML), ${html.length} символов, сохранено в ${outFile}\n`);

      // Признаки антибот-блокировки/капчи — если сработают, значит страница не
      // настоящая выдача, а заглушка.
      const blockMarkers = ["验证码", "异常访问", "人机验证", "captcha", "访问过于频繁"];
      const foundBlocks = blockMarkers.filter((m) => html.includes(m));
      console.log(
        foundBlocks.length
          ? `⚠️  Похоже на антибот-страницу, найдены маркеры: ${foundBlocks.join(", ")}`
          : "✅ Признаков антибот-блокировки не найдено."
      );

      // Известные маркеры данных товаров на Taobao/1688 — ищем и показываем
      // контекст вокруг первого совпадения, чтобы понять реальную структуру.
      const dataMarkers = [
        "g_page_config",
        "__INITIAL_DATA__",
        "view_sales",
        "raw_title",
        "auctions",
        "\"itemId\"",
        "\"price\"",
      ];
      for (const marker of dataMarkers) {
        const idx = html.indexOf(marker);
        if (idx === -1) {
          console.log(`\n❌ Маркер "${marker}" не найден`);
          continue;
        }
        const start = Math.max(0, idx - 100);
        const snippet = html.slice(start, idx + 900);
        console.log(`\n✅ Маркер "${marker}" найден на позиции ${idx}, контекст:\n${snippet}`);
      }
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
