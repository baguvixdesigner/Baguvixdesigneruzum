import { createBot } from "./bot";
import { logger } from "./utils/logger";

async function main() {
  const bot = createBot();

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));

  // bot.launch() не резолвится, пока бот работает (это его нормальный режим
  // в long-polling) — не ждём его, иначе следующая строка никогда не выполнится.
  const launching = bot.launch();
  logger.info("Бот запущен");
  await launching;
}

main().catch((err) => {
  logger.error("Не удалось запустить бота", err);
  process.exit(1);
});
