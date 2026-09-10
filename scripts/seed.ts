import { prisma } from "../src/db/prisma";
import { CATEGORY_SEED } from "../src/services/categories";
import { logger } from "../src/utils/logger";

async function main() {
  let created = 0;
  let updated = 0;

  for (let i = 0; i < CATEGORY_SEED.length; i++) {
    const seed = CATEGORY_SEED[i];
    const existing = await prisma.category.findFirst({
      where: { name: seed.name, parentGroup: seed.parentGroup },
    });

    if (existing) {
      await prisma.category.update({
        where: { id: existing.id },
        data: {
          nameUz: seed.nameUz,
          parentGroupUz: seed.parentGroupUz,
          chinaSearchTerms: seed.chinaSearchTerms,
          sortOrder: i,
        },
      });
      updated++;
    } else {
      await prisma.category.create({
        data: {
          name: seed.name,
          nameUz: seed.nameUz,
          parentGroup: seed.parentGroup,
          parentGroupUz: seed.parentGroupUz,
          chinaSearchTerms: seed.chinaSearchTerms,
          sortOrder: i,
          active: true,
        },
      });
      created++;
    }
  }

  logger.info(`Seed завершён: создано ${created}, обновлено ${updated}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
