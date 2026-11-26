import { cookies } from 'next/headers'
import { getRequestConfig } from 'next-intl/server'

import { defaultLocale, isSupportedLocale, localeCookieName } from './config'

export default getRequestConfig(async () => {
  const cookieStore = await cookies()

  const savedLocale = cookieStore.get(localeCookieName)?.value

  const locale = isSupportedLocale(savedLocale) ? savedLocale : defaultLocale

  const messages = (await import(`../messages/${locale}.json`)).default

  return {
    locale,
    messages,
  }
})
