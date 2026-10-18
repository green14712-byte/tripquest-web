'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

type StoredUser = {
  id: number
  email: string
  nickname: string | null
  role: 'USER' | 'INSTITUTION' | 'ADMIN'
  status: string
  institutionId: number | null
}

function getRoleLabel(role: StoredUser['role']) {
  if (role === 'ADMIN') {
    return '관리자'
  }

  if (role === 'INSTITUTION') {
    return '기관'
  }

  return '여행자'
}

export default function SiteHeader() {
  const router = useRouter()
  const pathname = usePathname()

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

  function handleLogout() {
    sessionStorage.removeItem('accessToken')
    sessionStorage.removeItem('user')

    setUser(null)

    router.push('/')
    router.refresh()
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-6 px-6">
        {/* 로고 */}
        <Link
          href="/"
          className="shrink-0 text-lg font-extrabold tracking-tight text-sky-600"
        >
          Korea Trip Quest
        </Link>

        {!user ? (
          /* 비로그인 */
          <nav className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              로그인
            </Link>

            <Link
              href="/signup"
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
            >
              회원가입
            </Link>
          </nav>
        ) : (
          /* 로그인 */
          <div className="flex items-center gap-2">
            {/* 사용자 정보 */}
            <div className="hidden text-right sm:block">
              <p className="text-sm font-bold text-slate-900">
                {user.nickname ?? user.email}님
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
              My
            </Link>

            {/* 기관 계정 메뉴 */}
            {user.role === 'INSTITUTION' && (
              <Link
                href="/institution"
                className="whitespace-nowrap rounded-lg bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-700 transition hover:bg-violet-100"
              >
                기관 관리
              </Link>
            )}

            {/* 관리자 메뉴 */}
            {user.role === 'ADMIN' && (
              <>
                <Link
                  href="/admin/institution-applications"
                  className="whitespace-nowrap rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-100"
                >
                  기관 신청 관리
                </Link>

                <Link
                  href="/admin/users"
                  className="whitespace-nowrap rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                >
                  회원 관리
                </Link>
              </>
            )}

            {/* 로그아웃 */}
            <button
              type="button"
              onClick={handleLogout}
              className="whitespace-nowrap rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              로그아웃
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
