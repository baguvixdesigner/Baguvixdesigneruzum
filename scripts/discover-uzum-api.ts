/**
 * graphql.umarket.uz из ТЗ не резолвится по DNS даже с обычного VDS (не только из
 * песочницы Claude) — похоже, домен устарел. Этот скрипт проверяет DNS для набора
 * вероятных кандидатов (включая актуальный бренд-домен uzum.uz) и пытается достучаться
 * до тех, что резолвятся, чтобы найти реальный живой эндпоинт.
 *
 * Запуск: npx tsx scripts/discover-uzum-api.ts
 */

import { lookup } from "node:dns/promises";

const CANDIDATE_HOSTS = [
  // из ТЗ (похоже, устарели)
  "umarket.uz",
  "api.umarket.uz",
  "graphql.umarket.uz",
  // актуальный бренд-домен
  "uzum.uz",
  "www.uzum.uz",
  "api.uzum.uz",
  "graphql.uzum.uz",
  "m.uzum.uz",
  "bff.uzum.uz",
  "gw.uzum.uz",
  // подтверждённо существует (seller/merchant API, не то, что нам нужно, но
  // подтверждает поддомен api-*.uzum.uz как рабочий паттерн)
  "api-seller.uzum.uz",
];

async function checkDns(host: string) {
  try {
    const { address, family } = await lookup(host);
    return { host, ok: true as const, address, family };
  } catch (err) {
    return { host, ok: false as const, error: err instanceof Error ? err.message : String(err) };
  }
}

async function checkHttp(host: string) {
  try {
    const res = await fetch(`https://${host}/`, { method: "GET", redirect: "manual" });
    return { status: res.status, location: res.headers.get("location") };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

async function main() {
  console.log("=== DNS-проверка кандидатов ===\n");

  const results = await Promise.all(CANDIDATE_HOSTS.map(checkDns));

  for (const r of results) {
    if (r.ok) {
      console.log(`✅ ${r.host} -> ${r.address} (IPv${r.family})`);
    } else {
      console.log(`❌ ${r.host} -> ${r.error}`);
    }
  }

  const resolvable = results.filter((r) => r.ok).map((r) => r.host);
  if (resolvable.length === 0) {
    console.log(
      "\nНи один хост не резолвится. Возможные причины: DNS/сеть на этом VDS сама " +
        "фильтрует такие домены, либо нужно проверять из сети Узбекистана (VPN/прокси " +
        "с UZ-IP), либо резолвер провайдера режет .uz зону. Попробуйте вручную " +
        "`nslookup uzum.uz 8.8.8.8` и `nslookup uzum.uz 1.1.1.1`, чтобы исключить резолвер."
    );
    return;
  }

  console.log(`\n=== HTTP-проверка резолвящихся хостов (${resolvable.join(", ")}) ===\n`);
  for (const host of resolvable) {
    const r = await checkHttp(host);
    console.log(`${host}:`, r);
  }

  console.log(
    "\nГотово. Пришлите вывод целиком. Если резолвится, например, uzum.uz — " +
      "следующий шаг: открыть uzum.uz в браузере с открытым DevTools → Network, " +
      "сделать поиск товара на сайте и посмотреть реальный XHR/fetch запрос к их " +
      "бэкенду (имя хоста, путь, тело запроса) — это самый надёжный способ найти " +
      "актуальный эндпоинт и структуру запроса, раз официальной документации нет."
  );
}

main();
