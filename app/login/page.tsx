'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { API_BASE_URL } from '../lib/api'
import { supabase } from '../lib/supabase'

type LoginResponse = {
  accessToken?: string

  user?: {
    id: number
    email: string
    nickname: string | null
    role: string
    status: string
    institutionId: number | null
  }

  message?: string
}

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setError('')
    setLoading(true)

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
        },

        body: JSON.stringify({
          email,
          password,
        }),
      })

      const data = (await response.json()) as LoginResponse

      if (!response.ok) {
        setError(data.message ?? '로그인에 실패했습니다.')
        return
      }

      if (!data.accessToken || !data.user) {
        setError('로그인 응답을 확인할 수 없습니다.')
        return
      }

      /*
       * 현재는 프론트 연동 확인을 위한 임시 단계입니다.
       * 최종 보안 버전에서는 accessToken을
       * HttpOnly Cookie 방식으로 변경할 예정입니다.
       */
      sessionStorage.setItem('accessToken', data.accessToken)

      sessionStorage.setItem('user', JSON.stringify(data.user))

      router.push('/')
    } catch {
      setError('서버에 연결할 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleLogin() {
    setError('')
    setGoogleLoading(true)

    try {
      const redirectTo = `${window.location.origin}/auth/callback`

      const { error: googleError } = await supabase.auth.signInWithOAuth({
        provider: 'google',

        options: {
          redirectTo,
        },
      })

      if (googleError) {
        setError(googleError.message || 'Google 로그인에 실패했습니다.')
      }
    } catch {
      setError('Google 로그인 처리 중 오류가 발생했습니다.')
    } finally {
      setGoogleLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="mb-6 inline-block text-sm font-semibold text-sky-600 hover:text-sky-700"
        >
          ← 홈으로
        </Link>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-bold tracking-widest text-sky-600">
            KOREA TRIP QUEST
          </p>

          <h1 className="mt-3 text-3xl font-bold text-slate-900">로그인</h1>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            Challenge에 참여하려면 로그인해주세요.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-bold text-slate-800"
              >
                이메일
              </label>

              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
                placeholder="example@email.com"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-900 caret-sky-600 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-bold text-slate-800"
              >
                비밀번호
              </label>

              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                autoComplete="current-password"
                placeholder="비밀번호를 입력하세요"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-900 caret-sky-600 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />

              <div className="mt-2 text-right">
                <Link
                  href="/forgot-password"
                  className="text-sm font-semibold text-sky-600 hover:text-sky-700"
                >
                  비밀번호를 잊으셨나요?
                </Link>
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full rounded-xl bg-sky-600 px-4 py-3 font-bold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />

            <span className="text-xs font-semibold text-slate-400">또는</span>

            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading || googleLoading}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 bg-white text-sm font-black text-slate-700">
              G
            </span>

            {googleLoading ? 'Google 로그인 중...' : 'Google로 계속하기'}
          </button>
        </div>
      </div>
    </main>
  )
}
