import "dotenv/config";

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === "") {
    throw new Error(`Отсутствует обязательная переменная окружения: ${name}`);
  }
  return v;
}

function optional(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

export const env = {
  botToken: required("BOT_TOKEN"),
  adminTelegramId: BigInt(required("ADMIN_TELEGRAM_ID", "0")),
  supportUsername: optional("SUPPORT_USERNAME", "karim"),

  databaseUrl: required("DATABASE_URL"),

  oxylabsUsername: optional("OXYLABS_USERNAME"),
  oxylabsPassword: optional("OXYLABS_PASSWORD"),

  // graphql.umarket.uz / api.umarket.uz из исходного ТЗ больше не резолвятся —
  // живой бренд-домен подтверждён вручную: graphql.uzum.uz / api.uzum.uz
  uzumGraphqlUrl: optional("UZUM_GRAPHQL_URL", "https://graphql.uzum.uz/"),
  uzumApiUrl: optional("UZUM_API_URL", "https://api.uzum.uz/"),
  // Шлюз перед GraphQL требует Authorization: Bearer <анонимный JWT от "Uzum ID">
  // (без него — 401 с пустым телом). Токен живёт ~3 часа, программный способ его
  // получать ещё не найден (см. README) — временно берётся вручную из DevTools.
  uzumBearerToken: optional("UZUM_BEARER_TOKEN"),
  uzumClientVersion: optional("UZUM_CLIENT_VERSION", "1.63.2"),
  uzumCityId: optional("UZUM_CITY_ID", "1"),
  uzumCityLat: optional("UZUM_CITY_LAT", "41.379112"),
  uzumCityLon: optional("UZUM_CITY_LON", "69.29944"),

  apifyToken: optional("APIFY_TOKEN"),
  apifyUzumActorId: optional("APIFY_UZUM_ACTOR_ID"),

  cbuRatesUrl: optional("CBU_RATES_URL", "https://cbu.uz/ru/arkhiv-kursov-valyut/json/"),

  translateProvider: optional("TRANSLATE_PROVIDER", "google-unofficial"),
  yandexTranslateApiKey: optional("YANDEX_TRANSLATE_API_KEY"),

  topupCardNumber: optional("TOPUP_CARD_NUMBER", "0000 0000 0000 0000"),
  topupCardHolder: optional("TOPUP_CARD_HOLDER", "Karim K."),

  queryPriceSum: int("QUERY_PRICE_SUM", 14900),
  minTopupSum: int("MIN_TOPUP_SUM", 50000),
  cacheTtlHours: int("CACHE_TTL_HOURS", 24),
};
