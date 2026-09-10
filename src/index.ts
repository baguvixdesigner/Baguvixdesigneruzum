import { createBot } from "./bot";
import { logger } from "./utils/logger";

async function main() {
  const bot = createBot();

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));

  await bot.launch();
  logger.info("Бот запущен");
}

main().catch((err) => {
  logger.error("Не удалось запустить бота", err);
  process.exit(1);
});
