import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Geist, Geist_Mono } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale } from 'next-intl/server'

import SiteHeader from './components/site-header'

import 'leaflet/dist/leaflet.css'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Trip Quest Korea',
  description: '한국의 관광지를 여행하고 미션을 수행하는 Trip Quest Korea',
}

type RootLayoutProps = {
  children: ReactNode
}

export default async function RootLayout({ children }: RootLayoutProps) {
  const locale = await getLocale()

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider>
          <SiteHeader />

          <div className="flex flex-1 flex-col">{children}</div>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
