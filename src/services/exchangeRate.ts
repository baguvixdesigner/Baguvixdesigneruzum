import axios from "axios";
import { prisma } from "../db/prisma";
import { env } from "../config/env";
import { logger } from "../utils/logger";

const CURRENCY = "CNY";

interface CbuRateEntry {
  Ccy: string;
  Rate: string;
}

/**
 * Курс CNY -> UZS с кэшем в БД (TTL как у CACHE_TTL_HOURS, ЦБ обновляет раз в сутки).
 * Источник — официальный JSON-фид ЦБ Узбекистана.
 */
export async function getCnyToUzsRate(): Promise<number> {
  const cached = await prisma.exchangeRate.findFirst({
    where: { currency: CURRENCY },
    orderBy: { fetchedAt: "desc" },
  });

  const ttlMs = env.cacheTtlHours * 60 * 60 * 1000;
  if (cached && Date.now() - cached.fetchedAt.getTime() < ttlMs) {
    return cached.rateToUzs;
  }

  try {
    const { data } = await axios.get<CbuRateEntry[]>(env.cbuRatesUrl, { timeout: 10_000 });
    const entry = data.find((r) => r.Ccy === CURRENCY);
    if (!entry) throw new Error(`Валюта ${CURRENCY} не найдена в ответе ЦБ РУз`);

    const rate = Number.parseFloat(entry.Rate);
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error(`Некорректный курс ${CURRENCY} от ЦБ РУз: ${entry.Rate}`);
    }

    await prisma.exchangeRate.create({ data: { currency: CURRENCY, rateToUzs: rate } });
    logger.info(`Курс ${CURRENCY}->UZS обновлён: ${rate}`);
    return rate;
  } catch (err) {
    logger.error("Не удалось обновить курс ЦБ РУз", err);
    if (cached) {
      logger.warn("Используем устаревший закэшированный курс как резерв");
      return cached.rateToUzs;
    }
    throw new Error("Курс валют недоступен и кэш пуст — повторите попытку позже");
  }
}
