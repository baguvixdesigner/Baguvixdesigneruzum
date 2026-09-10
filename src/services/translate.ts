import axios from "axios";
import { env } from "../config/env";
import { logger } from "../utils/logger";

/**
 * Переводит название товара (обычно с китайского) на русский — нужно для поиска
 * совпадений на Uzum по ключевым словам. Провайдер переключается через
 * TRANSLATE_PROVIDER, не меняя остальной пайплайн.
 */
export async function translateToRussian(text: string): Promise<string> {
  if (!text.trim()) return text;

  try {
    if (env.translateProvider === "yandex" && env.yandexTranslateApiKey) {
      return await translateYandex(text);
    }
    return await translateGoogleUnofficial(text);
  } catch (err) {
    logger.error(`Не удалось перевести "${text}"`, err);
    return text; // fallback: используем оригинал, чтобы не ронять пайплайн
  }
}

async function translateGoogleUnofficial(text: string): Promise<string> {
  // Неофициальный, без ключа, есть неявные лимиты — норм для MVP. При росте
  // нагрузки переключить TRANSLATE_PROVIDER=yandex.
  const { data } = await axios.get("https://translate.googleapis.com/translate_a/single", {
    params: {
      client: "gtx",
      sl: "auto",
      tl: "ru",
      dt: "t",
      q: text,
    },
    timeout: 10_000,
  });
  const translated = data?.[0]?.map((chunk: unknown[]) => chunk[0]).join("") ?? text;
  return String(translated);
}

async function translateYandex(text: string): Promise<string> {
  const { data } = await axios.post(
    "https://translate.api.cloud.yandex.net/translate/v2/translate",
    { texts: [text], targetLanguageCode: "ru" },
    {
      headers: { Authorization: `Api-Key ${env.yandexTranslateApiKey}` },
      timeout: 10_000,
    }
  );
  return data?.translations?.[0]?.text ?? text;
}
