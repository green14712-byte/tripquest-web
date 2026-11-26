'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

type StoredUser = {
  id: number
  email: string
  nickname: string | null
  role: 'USER' | 'INSTITUTION' | 'ADMIN'
  status: string
  institutionId: number | null
}

type Locale = 'ko' | 'en' | 'ja' | 'zh-CN'

const localeOptions: {
  value: Locale
  label: string
}[] = [
  {
    value: 'ko',
    label: '한국어',
  },
  {
    value: 'en',
    label: 'English',
  },
  {
    value: 'ja',
    label: '日本語',
  },
  {
    value: 'zh-CN',
    label: '中文',
  },
]

export default function SiteHeader() {
  const router = useRouter()
  const pathname = usePathname()

  const t = useTranslations('Common')
  const locale = useLocale()

  const [user, setUser] = useState<StoredUser | null>(null)

  useEffect(() => {
    const userText = sessionStorage.getItem('user')

    const accessToken = sessionStorage.getItem('accessToken')

    if (!userText || !accessToken) {
      setUser(null)
      return
    }

    try {
      const parsedUser = JSON.parse(userText) as StoredUser

      setUser(parsedUser)
    } catch {
      sessionStorage.removeItem('user')
      sessionStorage.removeItem('accessToken')

      setUser(null)
    }
  }, [pathname])

  function getRoleLabel(role: StoredUser['role']) {
    if (role === 'ADMIN') {
      return t('admin')
    }

    if (role === 'INSTITUTION') {
      return t('institution')
    }

    return t('traveler')
  }

  function handleLogout() {
    sessionStorage.removeItem('accessToken')
    sessionStorage.removeItem('user')

    setUser(null)

    router.push('/')
    router.refresh()
  }

  function handleLanguageChange(newLocale: Locale) {
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000; SameSite=Lax`

    router.refresh()
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-6">
        {/* 로고 */}
        <Link
          href="/"
          className="shrink-0 text-lg font-extrabold tracking-tight text-sky-600"
        >
          {t('serviceName')}
        </Link>

        <div className="flex items-center gap-3">
          {/* 언어 선택 */}
          <div className="relative">
            <label htmlFor="language-select" className="sr-only">
              {t('language')}
            </label>

            <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-2">
              <span className="text-sm" aria-hidden="true">
                🌐
              </span>

              <select
                id="language-select"
                value={locale}
                onChange={(event) =>
                  handleLanguageChange(event.target.value as Locale)
                }
                className="cursor-pointer bg-transparent py-2 pr-1 text-sm font-semibold text-slate-700 outline-none"
              >
                {localeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!user ? (
            /* 비로그인 */
            <nav className="flex items-center gap-3">
              <Link
                href="/login"
                className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                {t('login')}
              </Link>

              <Link
                href="/signup"
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
              >
                {t('signup')}
              </Link>
            </nav>
          ) : (
            /* 로그인 */
            <div className="flex items-center gap-2">
              {/* 사용자 정보 */}
              <div className="hidden text-right sm:block">
                <p className="text-sm font-bold text-slate-900">
                  {user.nickname ?? user.email}
                  {locale === 'ko' ? '님' : ''}
                </p>

                <p className="text-xs font-medium text-slate-500">
                  {getRoleLabel(user.role)}
                </p>
              </div>

              {/* 공통 My */}
              <Link
                href="/my"
                className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                {t('my')}
              </Link>

              {/* 기관 계정 메뉴 */}
              {user.role === 'INSTITUTION' && (
                <Link
                  href="/institution"
                  className="whitespace-nowrap rounded-lg bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-700 transition hover:bg-violet-100"
                >
                  {t('institutionManagement')}
                </Link>
              )}

              {/* 관리자 메뉴 */}
              {user.role === 'ADMIN' && (
                <>
                  <Link
                    href="/admin/institution-applications"
                    className="whitespace-nowrap rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-100"
                  >
                    {t('institutionApplications')}
                  </Link>

                  <Link
                    href="/admin/users"
                    className="whitespace-nowrap rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                  >
                    {t('userManagement')}
                  </Link>
                </>
              )}

              {/* 로그아웃 */}
              <button
                type="button"
                onClick={handleLogout}
                className="whitespace-nowrap rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                {t('logout')}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
