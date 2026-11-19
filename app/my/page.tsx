'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useEffect, useState } from 'react'
import { API_BASE_URL } from '../lib/api'
import { supabase } from '../lib/supabase'

type User = {
  id: number
  email: string
  nickname: string | null
  role: 'USER' | 'INSTITUTION' | 'ADMIN'
  status: 'ACTIVE' | 'SUSPENDED' | 'DELETED'
  institutionId: number | null
  googleConnected: boolean
}

type InstitutionApplication = {
  id: number
  institutionName: string
  representativeName: string
  contactEmail: string
  contactPhone?: string | null
  address?: string | null
  website?: string | null
  description?: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  rejectionReason?: string | null
  createdAt?: string
  reviewedAt?: string | null
}

type ApiResponse = {
  message?: string | string[]
}

function getMessage(message: string | string[] | undefined, fallback: string) {
  if (Array.isArray(message)) {
    return message.join(' ')
  }

  return message ?? fallback
}

function roleLabel(role: User['role']) {
  if (role === 'ADMIN') {
    return '관리자'
  }

  if (role === 'INSTITUTION') {
    return '기관 관계자'
  }

  return '여행자'
}

function statusLabel(status: InstitutionApplication['status']) {
  if (status === 'APPROVED') {
    return '승인 완료'
  }

  if (status === 'REJECTED') {
    return '승인 거절'
  }

  return '관리자 검토 중'
}

export default function MyPage() {
  const router = useRouter()

  const [user, setUser] = useState<User | null>(null)

  const [application, setApplication] = useState<InstitutionApplication | null>(
    null,
  )

  const [loading, setLoading] = useState(true)

  const [error, setError] = useState('')

  /*
   * Google 계정 연결 UI 상태
   */
  const [googleLinkLoading, setGoogleLinkLoading] = useState(false)

  const [googleLinkError, setGoogleLinkError] = useState('')

  const [googleLinkSuccess, setGoogleLinkSuccess] = useState('')

  /*
   * 비밀번호 변경 UI 상태
   */
  const [passwordOpen, setPasswordOpen] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')

  const [newPassword, setNewPassword] = useState('')

  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')

  const [passwordError, setPasswordError] = useState('')

  const [passwordSuccess, setPasswordSuccess] = useState('')

  const [passwordLoading, setPasswordLoading] = useState(false)

  /*
   * 회원탈퇴 UI 상태
   */
  const [withdrawOpen, setWithdrawOpen] = useState(false)

  const [withdrawPassword, setWithdrawPassword] = useState('')

  const [withdrawError, setWithdrawError] = useState('')

  const [withdrawLoading, setWithdrawLoading] = useState(false)

  useEffect(() => {
    const googleLinkMessage = sessionStorage.getItem('googleLinkMessage')

    if (googleLinkMessage) {
      setGoogleLinkSuccess(googleLinkMessage)

      sessionStorage.removeItem('googleLinkMessage')
    }

    const googleLinkErrorMessage = sessionStorage.getItem('googleLinkError')

    if (googleLinkErrorMessage) {
      setGoogleLinkError(googleLinkErrorMessage)

      sessionStorage.removeItem('googleLinkError')
    }

    async function loadMyPage() {
      const accessToken = sessionStorage.getItem('accessToken')

      if (!accessToken) {
        router.replace('/login')
        return
      }

      try {
        /*
         * 1. 먼저 현재 로그인 사용자만 조회한다.
         *
         * ADMIN은 기관 신청 조회 API를
         * 호출하지 않아야 하기 때문에
         * Promise.all로 동시에 호출하지 않는다.
         */
        const meResponse = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },

          cache: 'no-store',
        })

        if (meResponse.status === 401 || meResponse.status === 403) {
          sessionStorage.removeItem('accessToken')

          sessionStorage.removeItem('user')

          router.replace('/login')
          return
        }

        if (!meResponse.ok) {
          throw new Error('계정 정보를 불러오지 못했습니다.')
        }

        const meData = await meResponse.json()

        const currentUser: User = meData.user ?? meData

        setUser(currentUser)

        sessionStorage.setItem('user', JSON.stringify(currentUser))

        /*
         * 2. ADMIN은 기관 가입 신청 대상이 아니므로
         * 기관 신청 API를 호출하지 않는다.
         */
        if (currentUser.role === 'ADMIN') {
          setApplication(null)

          return
        }

        /*
         * 3. USER / INSTITUTION만
         * 기관 가입 신청 이력을 조회한다.
         */
        const applicationResponse = await fetch(
          `${API_BASE_URL}/institution-applications/me`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },

            cache: 'no-store',
          },
        )

        if (applicationResponse.ok) {
          const applicationData = await applicationResponse.json()

          const received =
            applicationData.application ?? applicationData ?? null

          /*
           * 신청 이력이 배열이면
           * 가장 최근 신청을 표시한다.
           */
          if (Array.isArray(received)) {
            const sorted = [...received].sort(
              (a: InstitutionApplication, b: InstitutionApplication) =>
                b.id - a.id,
            )

            setApplication(sorted[0] ?? null)
          } else {
            setApplication(received)
          }
        } else if (applicationResponse.status === 404) {
          setApplication(null)
        } else {
          const applicationData = await applicationResponse
            .json()
            .catch(() => null)

          const message = applicationData?.message

          if (typeof message === 'string' && message.includes('신청')) {
            setApplication(null)
          } else {
            throw new Error('기관 신청 정보를 불러오지 못했습니다.')
          }
        }
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message)
        } else {
          setError('정보를 불러오는 중 오류가 발생했습니다.')
        }
      } finally {
        setLoading(false)
      }
    }

    void loadMyPage()
  }, [router])

  /*
   * Google 계정 연결 시작
   *
   * 실제 연결 처리는 /auth/callback?mode=link 에서
   * Supabase 세션을 확인한 뒤 백엔드 /auth/google/link를 호출한다.
   */
  async function startGoogleLink() {
    setGoogleLinkError('')
    setGoogleLinkSuccess('')

    const accessToken = sessionStorage.getItem('accessToken')

    if (!accessToken) {
      router.replace('/login')
      return
    }

    setGoogleLinkLoading(true)

    try {
      const redirectTo = `${window.location.origin}/auth/callback?mode=link`

      const { error: googleError } = await supabase.auth.signInWithOAuth({
        provider: 'google',

        options: {
          redirectTo,

          queryParams: {
            prompt: 'select_account',
          },
        },
      })

      if (googleError) {
        setGoogleLinkError(
          googleError.message || 'Google 계정 연결을 시작하지 못했습니다.',
        )
      }
    } catch {
      setGoogleLinkError('Google 계정 연결 처리 중 오류가 발생했습니다.')
    } finally {
      setGoogleLinkLoading(false)
    }
  }

  /*
   * 비밀번호 변경
   */
  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setPasswordError('')
    setPasswordSuccess('')

    if (currentPassword.length < 8) {
      setPasswordError('현재 비밀번호를 정확히 입력해주세요.')

      return
    }

    if (newPassword.length < 8) {
      setPasswordError('새 비밀번호는 최소 8자 이상이어야 합니다.')

      return
    }

    if (newPassword.length > 64) {
      setPasswordError('새 비밀번호는 최대 64자까지 사용할 수 있습니다.')

      return
    }

    if (newPassword !== newPasswordConfirm) {
      setPasswordError('새 비밀번호와 비밀번호 확인이 일치하지 않습니다.')

      return
    }

    const accessToken = sessionStorage.getItem('accessToken')

    if (!accessToken) {
      router.replace('/login')
      return
    }

    setPasswordLoading(true)

    try {
      const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',

          Authorization: `Bearer ${accessToken}`,
        },

        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      })

      const data = (await response
        .json()
        .catch(() => null)) as ApiResponse | null

      if (!response.ok) {
        setPasswordError(
          getMessage(data?.message, '비밀번호 변경에 실패했습니다.'),
        )

        return
      }

      setCurrentPassword('')
      setNewPassword('')
      setNewPasswordConfirm('')

      setPasswordSuccess(
        getMessage(data?.message, '비밀번호가 변경되었습니다.'),
      )
    } catch {
      setPasswordError('서버에 연결할 수 없습니다.')
    } finally {
      setPasswordLoading(false)
    }
  }

  /*
   * 회원탈퇴
   */
  async function withdrawAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!user) {
      return
    }

    setWithdrawError('')

    if (withdrawPassword.length < 8) {
      setWithdrawError('현재 비밀번호를 입력해주세요.')

      return
    }

    const confirmed = window.confirm(
      '정말 회원탈퇴하시겠습니까?\n\n탈퇴 후 현재 계정은 사용할 수 없으며, 기존 활동 기록은 보존됩니다.',
    )

    if (!confirmed) {
      return
    }

    const finalConfirmed = window.confirm(
      '회원탈퇴를 최종 확인합니다.\n\n탈퇴 후 같은 이메일로 새 계정을 다시 가입할 수 있습니다.',
    )

    if (!finalConfirmed) {
      return
    }

    const accessToken = sessionStorage.getItem('accessToken')

    if (!accessToken) {
      router.replace('/login')
      return
    }

    setWithdrawLoading(true)

    try {
      const response = await fetch(`${API_BASE_URL}/auth/withdraw`, {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',

          Authorization: `Bearer ${accessToken}`,
        },

        body: JSON.stringify({
          password: withdrawPassword,
        }),
      })

      const data = (await response
        .json()
        .catch(() => null)) as ApiResponse | null

      if (!response.ok) {
        setWithdrawError(getMessage(data?.message, '회원탈퇴에 실패했습니다.'))

        return
      }

      sessionStorage.removeItem('accessToken')
      sessionStorage.removeItem('user')

      window.alert('회원탈퇴가 완료되었습니다.')

      router.replace('/')
      router.refresh()
    } catch {
      setWithdrawError('서버에 연결할 수 없습니다.')
    } finally {
      setWithdrawLoading(false)
    }
  }

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center bg-slate-50 px-6 py-20">
        <p className="font-semibold text-slate-500">내 정보를 불러오는 중...</p>
      </main>
    )
  }

  if (error) {
    return (
      <main className="flex flex-1 items-center justify-center bg-slate-50 px-6 py-20">
        <div className="w-full max-w-xl rounded-2xl border border-red-200 bg-white p-8">
          <h1 className="text-xl font-bold text-slate-900">
            정보를 불러올 수 없습니다.
          </h1>

          <p className="mt-3 text-sm text-red-600">{error}</p>

          <Link href="/" className="mt-6 inline-block font-bold text-sky-600">
            홈으로 돌아가기
          </Link>
        </div>
      </main>
    )
  }

  if (!user) {
    return null
  }

  return (
    <main className="flex flex-1 justify-center bg-slate-50 px-6 py-12">
      <div className="w-full max-w-3xl">
        <div>
          <p className="text-sm font-bold tracking-widest text-sky-600">
            TRIP QUEST KOREA
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-900">My</h1>

          <p className="mt-2 text-slate-600">
            계정 정보와 권한 정보를 확인할 수 있습니다.
          </p>
        </div>

        {/* 계정 정보 */}
        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-500">내 계정</p>

              <h2 className="mt-1 text-2xl font-bold text-slate-900">
                {user.nickname ?? '사용자'}
              </h2>
            </div>

            <span
              className={`rounded-full px-4 py-2 text-sm font-bold ${
                user.role === 'ADMIN'
                  ? 'bg-red-100 text-red-700'
                  : user.role === 'INSTITUTION'
                    ? 'bg-violet-100 text-violet-700'
                    : 'bg-sky-100 text-sky-700'
              }`}
            >
              {roleLabel(user.role)}
            </span>
          </div>

          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-bold text-slate-500">이메일</p>

              <p className="mt-1 break-all font-medium text-slate-900">
                {user.email}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-bold text-slate-500">현재 권한</p>

              <p className="mt-1 font-medium text-slate-900">{user.role}</p>
            </div>
          </div>
        </section>

        {/* USER 배지 장식장 */}
        {user.role === 'USER' && (
          <section className="mt-6 overflow-hidden rounded-3xl border border-violet-200 bg-white shadow-sm">
            <div className="relative overflow-hidden bg-linear-to-br from-violet-50 via-white to-sky-50 p-8">
              <div className="absolute -right-12 -top-16 h-44 w-44 rounded-full bg-violet-200/30" />

              <div className="absolute -bottom-20 -left-12 h-44 w-44 rounded-full bg-sky-200/30" />

              <div className="relative">
                <div className="flex items-start gap-5">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-4xl shadow-sm">
                    🏆
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold tracking-widest text-violet-600">
                      MY BADGE CABINET
                    </p>

                    <h2 className="mt-1 text-2xl font-black text-slate-900">
                      내 배지 장식장
                    </h2>

                    <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
                      Challenge를 완주하며 획득한 배지를 한곳에서 모아볼 수
                      있습니다. 획득 당시의 배지 디자인과 버전, 난이도, 보유율을
                      확인해보세요.
                    </p>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-white/80 bg-white/70 p-4 backdrop-blur">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl" aria-hidden="true">
                      ✨
                    </span>

                    <p className="text-sm leading-6 text-slate-600">
                      한 번 획득한 배지는 이후 Challenge가 변경되어도 획득
                      당시의 BadgeVersion으로 보존됩니다.
                    </p>
                  </div>
                </div>

                <Link
                  href="/my/badges"
                  className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-3 font-bold text-white shadow-sm transition hover:bg-violet-700"
                >
                  <span>내 배지 장식장 보기</span>
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* Google 계정 연결 */}
        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold text-sky-600">계정 보안</p>

          <h2 className="mt-1 text-xl font-bold text-slate-900">Google 계정</h2>

          {user.googleConnected ? (
            <>
              <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <p className="font-bold text-emerald-800">
                  Google 계정이 연결되어 있습니다.
                </p>

                <p className="mt-2 text-sm leading-6 text-emerald-700">
                  이제 이메일/비밀번호 로그인과 Google 로그인을 모두 사용할 수
                  있습니다.
                </p>

                <p className="mt-2 break-all text-sm text-emerald-700">
                  연결된 계정 이메일:{' '}
                  <span className="font-bold">{user.email}</span>
                </p>
              </div>

              {googleLinkSuccess && (
                <div className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                  {googleLinkSuccess}
                </div>
              )}
            </>
          ) : (
            <>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                현재 계정과 동일한 이메일의 Google 계정을 연결하면 이후
                Google로도 간편하게 로그인할 수 있습니다.
              </p>

              <div className="mt-5 rounded-2xl bg-slate-50 p-5">
                <p className="font-bold text-slate-800">
                  연결 가능한 Google 계정
                </p>

                <p className="mt-2 break-all text-sm leading-6 text-slate-600">
                  현재 로그인한 이메일과 동일한 Google 계정만 연결할 수
                  있습니다. 현재 이메일:{' '}
                  <span className="font-bold text-slate-800">{user.email}</span>
                </p>
              </div>

              {googleLinkError && (
                <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {googleLinkError}
                </div>
              )}

              {googleLinkSuccess && (
                <div className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                  {googleLinkSuccess}
                </div>
              )}

              <button
                type="button"
                onClick={() => void startGoogleLink()}
                disabled={googleLinkLoading}
                className="mt-5 flex items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-5 py-3 font-bold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-sm font-black text-slate-700">
                  G
                </span>

                {googleLinkLoading ? 'Google 연결 중...' : 'Google 계정 연결'}
              </button>
            </>
          )}
        </section>

        {/* 비밀번호 변경 */}
        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold text-sky-600">계정 보안</p>

          <h2 className="mt-1 text-xl font-bold text-slate-900">
            비밀번호 변경
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            현재 비밀번호를 확인한 뒤 새 비밀번호로 변경할 수 있습니다.
          </p>

          {!passwordOpen && (
            <button
              type="button"
              onClick={() => {
                setPasswordOpen(true)
                setPasswordError('')
                setPasswordSuccess('')
              }}
              className="mt-5 rounded-xl bg-sky-600 px-5 py-3 font-bold text-white transition hover:bg-sky-700"
            >
              비밀번호 변경
            </button>
          )}

          {passwordOpen && (
            <form
              onSubmit={changePassword}
              className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5"
            >
              <div>
                <label
                  htmlFor="currentPassword"
                  className="block text-sm font-bold text-slate-700"
                >
                  현재 비밀번호
                </label>

                <input
                  id="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  disabled={passwordLoading}
                  placeholder="현재 비밀번호"
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:bg-slate-100"
                />
              </div>

              <div className="mt-4">
                <label
                  htmlFor="newPassword"
                  className="block text-sm font-bold text-slate-700"
                >
                  새 비밀번호
                </label>

                <input
                  id="newPassword"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  disabled={passwordLoading}
                  placeholder="새 비밀번호"
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:bg-slate-100"
                />

                <p className="mt-2 text-xs text-slate-500">
                  비밀번호는 8자 이상 64자 이하로 입력해주세요.
                </p>
              </div>

              <div className="mt-4">
                <label
                  htmlFor="newPasswordConfirm"
                  className="block text-sm font-bold text-slate-700"
                >
                  새 비밀번호 확인
                </label>

                <input
                  id="newPasswordConfirm"
                  type="password"
                  autoComplete="new-password"
                  value={newPasswordConfirm}
                  onChange={(event) =>
                    setNewPasswordConfirm(event.target.value)
                  }
                  disabled={passwordLoading}
                  placeholder="새 비밀번호 다시 입력"
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:bg-slate-100"
                />
              </div>

              {passwordError && (
                <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {passwordError}
                </div>
              )}

              {passwordSuccess && (
                <div className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                  {passwordSuccess}
                </div>
              )}

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="rounded-xl bg-sky-600 px-5 py-3 font-bold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {passwordLoading ? '변경 중...' : '비밀번호 변경'}
                </button>

                <button
                  type="button"
                  disabled={passwordLoading}
                  onClick={() => {
                    setPasswordOpen(false)
                    setCurrentPassword('')
                    setNewPassword('')
                    setNewPasswordConfirm('')
                    setPasswordError('')
                    setPasswordSuccess('')
                  }}
                  className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  취소
                </button>
              </div>
            </form>
          )}
        </section>

        {/* ADMIN 전용 안내 */}
        {user.role === 'ADMIN' && (
          <section className="mt-6 rounded-3xl border border-red-200 bg-white p-8 shadow-sm">
            <p className="text-sm font-semibold text-red-500">관리자 계정</p>

            <h2 className="mt-1 text-xl font-bold text-slate-900">
              관리자 기능
            </h2>

            <div className="mt-5 rounded-2xl bg-red-50 p-5">
              <p className="font-bold text-red-800">
                관리자 권한으로 로그인되어 있습니다.
              </p>

              <p className="mt-2 text-sm leading-6 text-red-700">
                관리자 계정은 기관 가입 신청 대상이 아니므로 기관 신청 상태를
                조회하지 않습니다. 아래 관리 메뉴에서 서비스 운영 기능을 사용할
                수 있습니다.
              </p>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Link
                href="/admin/institution-applications"
                className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 font-bold text-amber-800 transition hover:bg-amber-100"
              >
                기관 신청 관리
              </Link>

              <Link
                href="/admin/users"
                className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 font-bold text-red-700 transition hover:bg-red-100"
              >
                회원 관리
              </Link>
            </div>
          </section>
        )}

        {/* USER / INSTITUTION 기관 신청 상태 */}
        {user.role !== 'ADMIN' && (
          <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">기관 계정</p>

            <h2 className="mt-1 text-xl font-bold text-slate-900">
              기관 가입 신청 상태
            </h2>

            {!application && (
              <div className="mt-6 rounded-2xl bg-slate-50 p-5">
                <p className="font-bold text-slate-800">
                  기관 가입 신청 내역이 없습니다.
                </p>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  관광기관이나 지자체 담당자라면 기관 가입을 신청할 수 있습니다.
                </p>

                {user.role === 'USER' && (
                  <Link
                    href="/signup/institution"
                    className="mt-5 inline-block rounded-xl bg-violet-600 px-5 py-3 font-bold text-white hover:bg-violet-700"
                  >
                    기관 가입 신청
                  </Link>
                )}
              </div>
            )}

            {application && (
              <div className="mt-6">
                <div
                  className={`rounded-2xl p-5 ${
                    application.status === 'APPROVED'
                      ? 'bg-emerald-50'
                      : application.status === 'REJECTED'
                        ? 'bg-red-50'
                        : 'bg-amber-50'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-600">
                        신청 기관
                      </p>

                      <p className="mt-1 text-lg font-bold text-slate-900">
                        {application.institutionName}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-4 py-2 text-sm font-bold ${
                        application.status === 'APPROVED'
                          ? 'bg-emerald-100 text-emerald-700'
                          : application.status === 'REJECTED'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {statusLabel(application.status)}
                    </span>
                  </div>

                  {application.status === 'PENDING' && (
                    <p className="mt-4 text-sm leading-6 text-amber-800">
                      기관 가입 신청이 접수되었습니다. 관리자가 기관 정보를
                      검토하고 있습니다. 승인 전까지는 일반 USER 권한이
                      유지됩니다.
                    </p>
                  )}

                  {application.status === 'APPROVED' && (
                    <p className="mt-4 text-sm leading-6 text-emerald-700">
                      기관 가입 신청이 승인되었습니다. 이제 기관 기능을 사용할
                      수 있습니다.
                    </p>
                  )}

                  {application.status === 'REJECTED' && (
                    <div className="mt-4">
                      <p className="text-sm leading-6 text-red-700">
                        기관 가입 신청이 승인되지 않았습니다.
                      </p>

                      {application.rejectionReason && (
                        <div className="mt-3 rounded-xl bg-white/70 p-4">
                          <p className="text-xs font-bold text-red-700">
                            거절 사유
                          </p>

                          <p className="mt-1 text-sm text-slate-700">
                            {application.rejectionReason}
                          </p>
                        </div>
                      )}

                      {user.role === 'USER' && (
                        <div className="mt-4 rounded-xl border border-red-200 bg-white/80 p-4">
                          <p className="text-sm font-bold text-slate-800">
                            신청 내용을 수정해서 다시 신청할 수 있습니다.
                          </p>

                          <p className="mt-1 text-sm leading-6 text-slate-600">
                            새로운 계정을 만들 필요 없이 현재 계정을 그대로
                            사용합니다. 이전 기관 정보를 불러온 뒤 필요한 내용을
                            수정하고 새로운 증빙자료를 제출하면 됩니다.
                          </p>

                          <Link
                            href="/signup/institution"
                            className="mt-4 inline-block rounded-xl bg-violet-600 px-5 py-3 font-bold text-white transition hover:bg-violet-700"
                          >
                            기관 재신청
                          </Link>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-xs font-bold text-slate-500">담당자</p>

                    <p className="mt-1 font-medium text-slate-900">
                      {application.representativeName}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-xs font-bold text-slate-500">
                      담당자 이메일
                    </p>

                    <p className="mt-1 break-all font-medium text-slate-900">
                      {application.contactEmail}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* 계정 관리 */}
        <section className="mt-6 rounded-3xl border border-red-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold text-red-500">계정 관리</p>

          <h2 className="mt-1 text-xl font-bold text-slate-900">회원탈퇴</h2>

          {user.role === 'ADMIN' ? (
            <div className="mt-5 rounded-2xl bg-slate-50 p-5">
              <p className="font-bold text-slate-800">
                관리자 계정은 직접 탈퇴할 수 없습니다.
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                서비스 관리 계정 보호를 위해 관리자 계정의 직접 탈퇴는 제한되어
                있습니다.
              </p>
            </div>
          ) : (
            <>
              <div className="mt-5 rounded-2xl bg-red-50 p-5">
                <p className="font-bold text-red-800">
                  탈퇴하기 전에 확인해주세요.
                </p>

                <p className="mt-2 text-sm leading-6 text-red-700">
                  탈퇴하면 현재 계정으로 더 이상 로그인할 수 없습니다. 기존
                  Challenge 참여, Mission 완료, 기관 신청 등의 기록은 관계
                  유지를 위해 보존됩니다.
                </p>

                <p className="mt-2 text-sm leading-6 text-red-700">
                  현재 이메일은 계정에서 익명화되므로 탈퇴 완료 후 같은 이메일로
                  새 계정을 다시 가입할 수 있습니다.
                </p>
              </div>

              {!withdrawOpen && (
                <button
                  type="button"
                  onClick={() => {
                    setWithdrawOpen(true)
                    setWithdrawError('')
                  }}
                  className="mt-5 rounded-xl border border-red-300 bg-white px-5 py-3 font-bold text-red-600 transition hover:bg-red-50"
                >
                  회원탈퇴
                </button>
              )}

              {withdrawOpen && (
                <form
                  onSubmit={withdrawAccount}
                  className="mt-5 rounded-2xl border border-red-200 p-5"
                >
                  <label
                    htmlFor="withdrawPassword"
                    className="block text-sm font-bold text-slate-700"
                  >
                    현재 비밀번호
                  </label>

                  <p className="mt-1 text-sm text-slate-500">
                    본인 확인을 위해 현재 비밀번호를 다시 입력해주세요.
                  </p>

                  <input
                    id="withdrawPassword"
                    type="password"
                    autoComplete="current-password"
                    value={withdrawPassword}
                    onChange={(event) =>
                      setWithdrawPassword(event.target.value)
                    }
                    disabled={withdrawLoading}
                    placeholder="현재 비밀번호"
                    className="mt-4 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-red-500 focus:ring-2 focus:ring-red-100 disabled:bg-slate-100"
                  />

                  {withdrawError && (
                    <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                      {withdrawError}
                    </div>
                  )}

                  <div className="mt-5 flex flex-wrap gap-2">
                    <button
                      type="submit"
                      disabled={withdrawLoading}
                      className="rounded-xl bg-red-600 px-5 py-3 font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {withdrawLoading ? '탈퇴 처리 중...' : '회원탈퇴 확인'}
                    </button>

                    <button
                      type="button"
                      disabled={withdrawLoading}
                      onClick={() => {
                        setWithdrawOpen(false)
                        setWithdrawPassword('')
                        setWithdrawError('')
                      }}
                      className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      취소
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  )
}
