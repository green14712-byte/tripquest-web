'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { API_BASE_URL } from '../../lib/api'
import { supabase } from '../../lib/supabase'

type GoogleLoginResponse = {
  accessToken?: string

  user?: {
    id: number
    email: string
    nickname: string | null
    role: string
    status: string
    institutionId: number | null
  }

  message?: string | string[]
}

type GoogleLinkResponse = {
  message?: string | string[]

  user?: {
    id: number
    email: string
    nickname: string | null
    role: string
    status: string
    institutionId: number | null
  }
}

function getMessage(message: string | string[] | undefined, fallback: string) {
  if (Array.isArray(message)) {
    return message.join(' ')
  }

  return message ?? fallback
}

export default function AuthCallbackPage() {
  const router = useRouter()

  const [message, setMessage] = useState(
    'Google 로그인 정보를 확인하고 있습니다.',
  )

  const [error, setError] = useState('')

  const [callbackMode, setCallbackMode] = useState<'login' | 'link'>('login')

  useEffect(() => {
    async function handleCallback() {
      try {
        /*
         * 현재 callback 주소의 mode 확인
         *
         * /auth/callback
         * → 일반 Google 로그인
         *
         * /auth/callback?mode=link
         * → 기존 계정에 Google 연결
         */
        const params = new URLSearchParams(window.location.search)

        const mode = params.get('mode') === 'link' ? 'link' : 'login'

        setCallbackMode(mode)

        /*
         * Supabase Auth 세션 확인
         */
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError) {
          setError('Google 로그인 정보를 확인하지 못했습니다.')

          return
        }

        if (!session?.access_token) {
          setError('Google 로그인 세션을 확인할 수 없습니다.')

          return
        }

        /*
         * 기존 이메일 계정에 Google 계정 연결
         */
        if (mode === 'link') {
          setMessage('Google 계정을 현재 계정에 연결하고 있습니다.')

          const koreaTripQuestAccessToken =
            sessionStorage.getItem('accessToken')

          if (!koreaTripQuestAccessToken) {
            await supabase.auth.signOut()

            setError('로그인 정보를 확인할 수 없습니다. 다시 로그인해주세요.')

            return
          }

          const response = await fetch(`${API_BASE_URL}/auth/google/link`, {
            method: 'POST',

            headers: {
              'Content-Type': 'application/json',

              Authorization: `Bearer ${koreaTripQuestAccessToken}`,
            },

            body: JSON.stringify({
              accessToken: session.access_token,
            }),
          })

          const data = (await response
            .json()
            .catch(() => null)) as GoogleLinkResponse | null

          /*
           * Google 인증 세션은
           * 계정 연결 후 종료한다.
           *
           * Korea Trip Quest 로그인 JWT는
           * sessionStorage에 그대로 유지된다.
           */
          await supabase.auth.signOut()

          if (!response.ok) {
            setError(
              getMessage(data?.message, 'Google 계정 연결에 실패했습니다.'),
            )

            return
          }

          if (data?.user) {
            sessionStorage.setItem('user', JSON.stringify(data.user))
          }

          setMessage(getMessage(data?.message, 'Google 계정이 연결되었습니다.'))

          window.setTimeout(() => {
            router.replace('/my')
          }, 700)

          return
        }

        /*
         * 일반 Google 간편가입 / 로그인
         */
        setMessage('Trip Quest Korea 계정에 로그인하고 있습니다.')

        const response = await fetch(`${API_BASE_URL}/auth/google`, {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
          },

          body: JSON.stringify({
            accessToken: session.access_token,
          }),
        })

        const data = (await response
          .json()
          .catch(() => null)) as GoogleLoginResponse | null

        if (!response.ok) {
          await supabase.auth.signOut()

          setError(getMessage(data?.message, 'Google 로그인에 실패했습니다.'))

          return
        }

        if (!data?.accessToken || !data.user) {
          await supabase.auth.signOut()

          setError('Google 로그인 응답을 확인할 수 없습니다.')

          return
        }

        /*
         * Korea Trip Quest JWT 저장
         */
        sessionStorage.setItem('accessToken', data.accessToken)

        sessionStorage.setItem('user', JSON.stringify(data.user))

        setMessage('Google 로그인에 성공했습니다.')

        router.replace('/')
      } catch {
        await supabase.auth.signOut()

        setError('Google 로그인 처리 중 오류가 발생했습니다.')
      }
    }

    void handleCallback()
  }, [router])

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-bold tracking-widest text-sky-600">
          TRIP QUEST KOREA
        </p>

        <h1 className="mt-3 text-2xl font-bold text-slate-900">Google 인증</h1>

        {!error && (
          <p className="mt-4 text-sm leading-6 text-slate-600">{message}</p>
        )}

        {error && (
          <>
            <div className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium leading-6 text-red-700">
              {error}
            </div>

            <button
              type="button"
              onClick={() => {
                if (callbackMode === 'link') {
                  router.replace('/my')
                  return
                }

                router.replace('/login')
              }}
              className="mt-5 w-full rounded-xl bg-sky-600 px-4 py-3 font-bold text-white transition hover:bg-sky-700"
            >
              돌아가기
            </button>
          </>
        )}
      </div>
    </main>
  )
}
