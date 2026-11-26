export const locales = ['ko', 'en', 'ja', 'zh-CN'] as const

export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'ko'

export const localeCookieName = 'NEXT_LOCALE'

export function isSupportedLocale(
  value: string | undefined | null,
): value is Locale {
  return locales.includes(value as Locale)
}
