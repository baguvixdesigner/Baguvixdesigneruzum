/**
 * Проверка Apify-акторов для Taobao/1688 — замена Oxylabs (см. README и
 * scripts/prototype-oxylabs.ts про то, почему отказались от Oxylabs для этих
 * двух сайтов).
 *
 * Поле "keyword" для Taobao (zen-studio/taobao-search-scraper) подтверждено
 * документацией актора. Для 1688 (zen-studio/1688-wholesale-scraper) — не
 * подтверждено, это первая гипотеза; если актор ответит ошибкой валидации
 * входных данных, в тексте ошибки обычно называют правильное имя поля —
 * смотрите на неё.
 *
 * Запуск (расходует платный баланс Apify-аккаунта — стоимость по прайсу актора,
 * обычно центы за десяток результатов):
 *   APIFY_TOKEN=... npx tsx scripts/prototype-apify-china.ts [taobao|1688] ["запрос"]
 */

import axios from "axios";

const TOKEN = process.env.APIFY_TOKEN;
const SITE = (process.argv[2] ?? "taobao") as "taobao" | "1688";
const QUERY = process.argv[3] ?? "连衣裙"; // "платье" по-китайски

const ACTOR_ID: Record<string, string> = {
  taobao: process.env.APIFY_TAOBAO_ACTOR_ID ?? "zen-studio~taobao-search-scraper",
  "1688": process.env.APIFY_1688_ACTOR_ID ?? "zen-studio~1688-wholesale-scraper",
};

if (!TOKEN) {
  console.log("⚠️  Задайте APIFY_TOKEN (из личного кабинета Apify → Settings → Integrations).");
  process.exit(1);
}

async function main() {
  const actorId = ACTOR_ID[SITE];
  const input = { keyword: QUERY, maxItems: 10 }; // maxItems must be >= 10 (актор так требует)

  console.log(`Сайт: ${SITE}`);
  console.log(`Актор: ${actorId}`);
  console.log(`Вход: ${JSON.stringify(input)}\n`);

  try {
    const { status, data } = await axios.post(
      `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items`,
      input,
      { params: { token: TOKEN }, timeout: 120_000, validateStatus: () => true }
    );

    console.log(`HTTP ${status}`);

    if (!Array.isArray(data)) {
      console.log("Ответ не массив (вероятно, ошибка) — полный вывод:");
      console.log(JSON.stringify(data, null, 2).slice(0, 3000));
      return;
    }

    console.log(`Получено элементов: ${data.length}\n`);
    if (data[0]) {
      console.log("Ключи первого элемента:", Object.keys(data[0]));
      console.log("\nПервый элемент целиком:");
      console.log(JSON.stringify(data[0], null, 2));
    }
  } catch (err) {
    console.log("Ошибка запроса:", err);
  }

  console.log("\nГотово. Пришлите вывод целиком — сверим реальные поля с src/services/apifyChina.ts.");
}

main();
