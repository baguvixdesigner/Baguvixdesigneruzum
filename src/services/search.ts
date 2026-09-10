import { prisma } from "../db/prisma";
import { collectCategory, getCategoryCacheStatus } from "./pipeline";
import type { SourceScope, ChinaSource } from "@prisma/client";

const PAGE_SIZE = 10;

export async function ensureFreshCategoryCache(categoryId: string): Promise<{ servedFromCache: boolean }> {
  const status = await getCategoryCacheStatus(categoryId);
  if (status.fresh) return { servedFromCache: true };

  const category = await prisma.category.findUniqueOrThrow({ where: { id: categoryId } });
  await collectCategory(category);
  return { servedFromCache: false };
}

function sourceFilter(scope: SourceScope): ChinaSource[] | undefined {
  if (scope === "BOTH") return undefined;
  return [scope as unknown as ChinaSource];
}

export async function getResultsPage(categoryId: string, scope: SourceScope, batchNumber: number) {
  const sources = sourceFilter(scope);
  return prisma.productSnapshot.findMany({
    where: { categoryId, ...(sources ? { source: { in: sources } } : {}) },
    orderBy: { rank: "asc" },
    skip: (batchNumber - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
}

export { PAGE_SIZE };
