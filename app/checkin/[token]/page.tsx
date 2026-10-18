'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

type UserRole = 'USER' | 'INSTITUTION' | 'ADMIN'

type AuthUser = {
  id: number
  role: UserRole
  nickname?: string
  email?: string
}

type AuthMeResponse = {
  user: AuthUser
}

type VerificationMethod = 'LOCATION' | 'QR' | 'BOTH'

type VerificationResult = {
  message?: string

  completion?: {
    id?: number
    userId?: number
    missionId?: number
    verificationMethod?: VerificationMethod
    completedAt?: string
  }

  verification?: {
    missionId?: number
    challengeId?: number
    verificationMode?: 'LOCATION_ONLY' | 'LOCATION_AND_QR' | 'LOCATION_OR_QR'
    method?: VerificationMethod
    locationVerified?: boolean
    qrVerified?: boolean
    distanceMeters?: number | null
    allowedRadiusMeters?: number
  }
}

type AuthState = 'checking' | 'logged_out' | 'authenticated'

export default function MissionQrCheckinPage() {
  const params = useParams()
  const router = useRouter()

  const tokenParam = Array.isArray(params.token)
    ? params.token[0]
    : params.token

  const [authState, setAuthState] = useState<AuthState>('checking')

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)

  const [verifying, setVerifying] = useState(false)

  const [error, setError] = useState('')

  const [locationNotice, setLocationNotice] = useState('')

  const [result, setResult] = useState<VerificationResult | null>(null)

  useEffect(() => {
    async function checkAuth() {
      const accessToken = sessionStorage.getItem('accessToken')

      if (!accessToken) {
        setAuthState('logged_out')
        return
      }

      try {
        const response = await fetch('http://localhost:3001/auth/me', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })

        if (response.status === 401) {
          sessionStorage.removeItem('accessToken')
          sessionStorage.removeItem('user')

          setCurrentUser(null)
          setAuthState('logged_out')
          return
        }

        if (!response.ok) {
          throw new Error('로그인 정보를 확인하지 못했습니다.')
        }

        const data = (await response.json()) as AuthMeResponse

        setCurrentUser(data.user)
        setAuthState('authenticated')
      } catch {
        setError('로그인 정보를 확인하는 중 오류가 발생했습니다.')
        setAuthState('authenticated')
      }
    }

    checkAuth()
  }, [])

  function getResponseMessage(data: unknown, fallback: string) {
    if (typeof data === 'object' && data !== null && 'message' in data) {
      const message = (data as { message?: string | string[] }).message

      if (Array.isArray(message)) {
        return message.join(', ')
      }

      if (typeof message === 'string') {
        return message
      }
    }

    return fallback
  }

  function getCurrentPosition() {
    return new Promise<GeolocationPosition>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('현재 브라우저에서는 위치 정보를 사용할 수 없습니다.'))

        return
      }

      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 15_000,
        maximumAge: 0,
      })
    })
  }

  function getLocationErrorMessage(error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof (error as { code?: unknown }).code === 'number'
    ) {
      const code = (error as { code: number }).code

      if (code === 1) {
        return '위치 권한이 거부되었습니다.'
      }

      if (code === 2) {
        return '현재 위치 정보를 확인할 수 없습니다.'
      }

      if (code === 3) {
        return '현재 위치 확인 시간이 초과되었습니다.'
      }
    }

    if (error instanceof Error) {
      return error.message
    }

    return '현재 위치를 확인하지 못했습니다.'
  }

  function getVerificationMethodLabel(method: VerificationMethod | undefined) {
    switch (method) {
      case 'LOCATION':
        return '위치 인증'

      case 'QR':
        return 'QR 인증'

      case 'BOTH':
        return '위치 + QR 인증'

      default:
        return '인증 완료'
    }
  }

  async function handleVerify() {
    if (!tokenParam) {
      setError('QR 인증 정보를 확인할 수 없습니다.')
      return
    }

    if (!currentUser) {
      setAuthState('logged_out')
      return
    }

    if (currentUser.role !== 'USER') {
      setError('Mission 인증은 여행자 계정에서만 사용할 수 있습니다.')
      return
    }

    const accessToken = sessionStorage.getItem('accessToken')

    if (!accessToken) {
      setAuthState('logged_out')
      return
    }

    setVerifying(true)
    setError('')
    setLocationNotice('')
    setResult(null)

    let position: GeolocationPosition | null = null
    let locationFailureMessage = ''

    /*
     * QR Mission 중에는
     * LOCATION_AND_QR 방식도 있으므로
     * 현재 위치를 먼저 확인해본다.
     *
     * 위치 확인에 실패해도 바로 중단하지 않는다.
     *
     * LOCATION_OR_QR이라면
     * QR만으로도 성공할 수 있기 때문이다.
     */
    try {
      position = await getCurrentPosition()

      setLocationNotice(
        `현재 위치를 확인했습니다. 위치 정확도는 약 ±${Math.round(
          position.coords.accuracy,
        )}m입니다.`,
      )
    } catch (locationError) {
      locationFailureMessage = getLocationErrorMessage(locationError)

      setLocationNotice(
        `${locationFailureMessage} QR 단독 인증이 가능한 Mission이면 계속 인증을 시도합니다.`,
      )
    }

    try {
      const body: {
        qrToken: string
        latitude?: number
        longitude?: number
        accuracy?: number
      } = {
        qrToken: tokenParam,
      }

      if (position) {
        body.latitude = position.coords.latitude
        body.longitude = position.coords.longitude
        body.accuracy = position.coords.accuracy
      }

      const response = await fetch(
        'http://localhost:3001/mission-completions/verify',
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',

            Authorization: `Bearer ${accessToken}`,
          },

          body: JSON.stringify(body),
        },
      )

      if (response.status === 401) {
        sessionStorage.removeItem('accessToken')
        sessionStorage.removeItem('user')

        setCurrentUser(null)
        setAuthState('logged_out')

        return
      }

      const data = (await response
        .json()
        .catch(() => null)) as VerificationResult | null

      if (!response.ok) {
        const serverMessage = getResponseMessage(
          data,
          'Mission QR 인증에 실패했습니다.',
        )

        if (locationFailureMessage) {
          throw new Error(`${serverMessage} ${locationFailureMessage}`)
        }

        throw new Error(serverMessage)
      }

      setResult(data)

      setError('')
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Mission QR 인증 중 오류가 발생했습니다.')
      }
    } finally {
      setVerifying(false)
    }
  }

  if (authState === 'checking') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="text-center">
          <div className="text-5xl">📱</div>

          <p className="mt-5 font-semibold text-slate-500">
            QR 인증 준비 중...
          </p>
        </div>
      </main>
    )
  }

  if (authState === 'logged_out') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
        <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="text-5xl">🔐</div>

          <p className="mt-6 text-sm font-bold tracking-widest text-sky-600">
            MISSION CHECK-IN
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            로그인이 필요합니다.
          </h1>

          <p className="mt-4 leading-7 text-slate-600">
            QR Mission 인증은 로그인한 여행자 계정에서 사용할 수 있습니다.
          </p>

          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-bold text-amber-800">
              QR을 다시 스캔해주세요.
            </p>

            <p className="mt-2 text-sm leading-6 text-amber-700">
              로그인한 뒤 현재 QR을 다시 스캔하면 Mission 인증을 계속할 수
              있습니다.
            </p>
          </div>

          <Link
            href="/login"
            className="mt-7 inline-flex rounded-xl bg-sky-600 px-7 py-3 font-bold text-white transition hover:bg-sky-700"
          >
            로그인하기
          </Link>
        </div>
      </main>
    )
  }

  if (currentUser && currentUser.role !== 'USER') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
        <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="text-5xl">🚫</div>

          <p className="mt-6 text-sm font-bold tracking-widest text-violet-600">
            MISSION CHECK-IN
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            여행자 전용 기능입니다.
          </h1>

          <p className="mt-4 leading-7 text-slate-600">
            Challenge 참여와 Mission 인증은 여행자 계정에서만 사용할 수
            있습니다.
          </p>

          <Link
            href="/"
            className="mt-7 inline-flex rounded-xl border border-slate-300 px-6 py-3 font-bold text-slate-700 transition hover:bg-slate-50"
          >
            홈으로 돌아가기
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">
      <div className="mx-auto w-full max-w-2xl">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 text-3xl">
            📱
          </div>

          <p className="mt-6 text-sm font-bold tracking-widest text-violet-600">
            MISSION CHECK-IN
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            Mission QR 인증
          </h1>

          <p className="mt-4 leading-7 text-slate-600">
            관광지에 설치된 Mission QR을 확인했습니다. 인증을 시작하면 QR의
            유효성을 검사하고, 필요한 Mission에서는 현재 위치도 함께 확인합니다.
          </p>

          <div className="mt-7 rounded-2xl border border-sky-200 bg-sky-50 p-5">
            <p className="font-bold text-sky-800">
              인증 방식은 Mission 설정에 따라 자동으로 결정됩니다.
            </p>

            <p className="mt-2 text-sm leading-6 text-sky-700">
              위치 또는 QR 방식은 QR만 정상이어도 완료할 수 있습니다. 위치 + QR
              방식은 QR과 현재 위치가 모두 인증 조건을 만족해야 합니다.
            </p>
          </div>

          {locationNotice && (
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-semibold leading-6 text-slate-600">
                📍 {locationNotice}
              </p>
            </div>
          )}

          {error && (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-5">
              <p className="font-bold text-red-700">인증하지 못했습니다.</p>

              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-red-700">
                {error}
              </p>
            </div>
          )}

          {result ? (
            <div className="mt-7">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
                <div className="text-4xl">✅</div>

                <h2 className="mt-4 text-2xl font-bold text-emerald-800">
                  Mission 완료!
                </h2>

                <p className="mt-3 leading-7 text-emerald-700">
                  {result.message || 'Mission 인증이 완료되었습니다.'}
                </p>

                <div className="mt-5 grid gap-3 rounded-xl bg-white/70 p-4 text-sm text-emerald-800 sm:grid-cols-2">
                  <p>
                    인증 방법:{' '}
                    <strong>
                      {getVerificationMethodLabel(result.verification?.method)}
                    </strong>
                  </p>

                  {typeof result.verification?.distanceMeters === 'number' && (
                    <p>
                      Mission 거리:{' '}
                      <strong>약 {result.verification.distanceMeters}m</strong>
                    </p>
                  )}

                  {typeof result.verification?.allowedRadiusMeters ===
                    'number' && (
                    <p>
                      인증 반경:{' '}
                      <strong>
                        {result.verification.allowedRadiusMeters}m
                      </strong>
                    </p>
                  )}

                  <p>
                    QR 인증:{' '}
                    <strong>
                      {result.verification?.qrVerified ? '성공' : '사용 안 함'}
                    </strong>
                  </p>

                  <p>
                    위치 인증:{' '}
                    <strong>
                      {result.verification?.locationVerified
                        ? '성공'
                        : '사용 안 함'}
                    </strong>
                  </p>
                </div>
              </div>

              {result.verification?.challengeId ? (
                <Link
                  href={`/challenges/${result.verification.challengeId}`}
                  className="mt-6 inline-flex w-full justify-center rounded-xl bg-emerald-600 px-6 py-4 font-bold text-white transition hover:bg-emerald-700"
                >
                  Challenge 진행 상황 확인
                </Link>
              ) : (
                <Link
                  href="/"
                  className="mt-6 inline-flex w-full justify-center rounded-xl bg-emerald-600 px-6 py-4 font-bold text-white transition hover:bg-emerald-700"
                >
                  Challenge 목록으로
                </Link>
              )}
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={handleVerify}
                disabled={verifying}
                className={`mt-7 w-full rounded-xl px-6 py-4 text-lg font-bold transition ${
                  verifying
                    ? 'cursor-not-allowed bg-slate-300 text-white'
                    : 'bg-violet-600 text-white hover:bg-violet-700'
                }`}
              >
                {verifying
                  ? 'QR과 현재 위치를 확인하는 중...'
                  : 'Mission 인증 시작'}
              </button>

              <p className="mt-4 text-center text-xs leading-5 text-slate-400">
                인증 과정에서 현재 위치 사용 권한을 요청할 수 있습니다. QR 원본
                인증값은 화면에 표시하지 않습니다.
              </p>
            </>
          )}
        </div>

        {!result && (
          <div className="mt-6 text-center">
            <Link
              href="/"
              className="text-sm font-bold text-slate-500 transition hover:text-slate-700"
            >
              ← Challenge 목록으로 돌아가기
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}
