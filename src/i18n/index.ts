import { ru, Dictionary } from "./ru";
import { uz } from "./uz";

export type Lang = "ru" | "uz";

const dictionaries: Record<Lang, Dictionary> = { ru, uz };

export function t(lang: Lang, key: keyof Dictionary, params?: Record<string, string | number>): string {
  const dict = dictionaries[lang] ?? dictionaries.ru;
  let str: string = dict[key] ?? dictionaries.ru[key] ?? String(key);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replaceAll(`{{${k}}}`, String(v));
    }
  }
  return str;
}
