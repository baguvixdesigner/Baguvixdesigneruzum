import axios from "axios";
import { env } from "../config/env";
import { logger } from "../utils/logger";

/**
 * Автоматическое получение анонимного Bearer-токена для GraphQL Uzum.
 * Воспроизводит флоу их же сайта (снято через DevTools):
 *
 *  1) GET https://uzum.uz/ — отвечает 307 и ставит куку `_yasc` (Yandex Cloud
 *     Application Load Balancer, `server: ycalb` — это кука привязки к серверу,
 *     НЕ HttpOnly, НЕ антибот-капча, ставится чистым HTTP-редиректом без JS).
 *  2) POST https://id.uzum.uz/api/auth/token с этой кукой, пустое тело —
 *     отвечает Set-Cookie: access_token=<JWT>; HttpOnly (+ refresh_token).
 *     HttpOnly блокирует чтение куки из JS в браузере, но не мешает обычному
 *     HTTP-клиенту (нам) прочитать Set-Cookie напрямую.
 *
 * JWT в access_token живёт ~3 часа (поле exp). Кэшируем в памяти процесса и
 * обновляем заранее, за 5 минут до истечения.
 */

let cachedToken: string | null = null;
let cachedExpiresAtMs = 0;

const REFRESH_MARGIN_MS = 5 * 60 * 1000;

function extractSetCookieValue(setCookieHeaders: unknown, name: string): string | null {
  const headers = Array.isArray(setCookieHeaders) ? (setCookieHeaders as string[]) : [];
  for (const header of headers) {
    const match = header.match(new RegExp(`^${name}=([^;]+)`));
    if (match) return match[1];
  }
  return null;
}

function decodeJwtExpMs(token: string): number | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

const COMMON_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
};

async function fetchStickySessionCookie(): Promise<string> {
  const res = await axios.get("https://uzum.uz/", {
    headers: COMMON_HEADERS,
    maxRedirects: 0,
    validateStatus: (status) => status < 400,
    timeout: 15_000,
  });
  const yasc = extractSetCookieValue(res.headers["set-cookie"], "_yasc");
  if (!yasc) throw new Error("Не удалось получить куку _yasc от uzum.uz");
  return yasc;
}

async function mintAnonymousToken(yasc: string): Promise<string> {
  const res = await axios.post(
    "https://id.uzum.uz/api/auth/token",
    undefined,
    {
      headers: {
        ...COMMON_HEADERS,
        Accept: "*/*",
        "Accept-Language": "ru",
        "Content-Type": "application/json",
        Origin: "https://uzum.uz",
        Referer: "https://uzum.uz/",
        Cookie: `_yasc=${yasc}`,
      },
      timeout: 15_000,
    }
  );
  const token = extractSetCookieValue(res.headers["set-cookie"], "access_token");
  if (!token) throw new Error("Не удалось получить access_token от id.uzum.uz");
  return token;
}

/**
 * Отдаёт валидный Bearer-токен, при необходимости получая новый. Если задан
 * UZUM_BEARER_TOKEN в .env — используется он (ручной оверрайд для отладки),
 * автополучение не запускается.
 */
export async function getUzumBearerToken(): Promise<string | null> {
  if (env.uzumBearerToken) return env.uzumBearerToken;

  if (cachedToken && Date.now() < cachedExpiresAtMs - REFRESH_MARGIN_MS) {
    return cachedToken;
  }

  try {
    const yasc = await fetchStickySessionCookie();
    const token = await mintAnonymousToken(yasc);
    const expMs = decodeJwtExpMs(token) ?? Date.now() + 3 * 60 * 60 * 1000;

    cachedToken = token;
    cachedExpiresAtMs = expMs;
    logger.info(`Получен новый анонимный токен Uzum, истекает ${new Date(expMs).toISOString()}`);
    return token;
  } catch (err) {
    logger.error("Не удалось получить анонимный токен Uzum", err);
    return null;
  }
}
