export function formatSum(amount: number): string {
  return `${Math.round(amount).toLocaleString("ru-RU").replace(/,/g, " ")} сум`;
}

export function cnyToUzs(priceCny: number, rateToUzs: number): number {
  return priceCny * rateToUzs;
}
