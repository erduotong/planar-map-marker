import { enUS, zhCN } from "date-fns/locale"

/** Returns the date-fns locale matching the active UI language. */
export function getDateFnsLocale(language: string | undefined) {
  return language?.toLowerCase().startsWith("zh") ? zhCN : enUS
}
