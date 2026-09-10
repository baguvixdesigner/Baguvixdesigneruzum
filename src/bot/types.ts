import type { Context } from "telegraf";
import type { TelegramUser, SourceScope } from "@prisma/client";
import type { Lang } from "../i18n";

export interface GroupOption {
  name: string;
  nameUz: string;
}

export interface CategoryOption {
  id: string;
  name: string;
  nameUz: string;
}

export type AwaitingInput =
  | "topup_amount"
  | "topup_screenshot"
  | "suggest_category"
  | undefined;

export interface SessionData {
  lang?: Lang;
  awaiting?: AwaitingInput;
  groups?: GroupOption[];
  subcategories?: CategoryOption[];
  selectedGroup?: string;
  selectedCategoryId?: string;
  selectedCategoryName?: string;
  selectedCategoryNameUz?: string;
  selectedSourceScope?: SourceScope;
  currentBatch?: number;
  pendingTopUpId?: string;
  pendingTopUpAmount?: number;
}

export interface BotContext extends Context {
  session: SessionData;
  dbUser: TelegramUser;
  lang: Lang;
}
