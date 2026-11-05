'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { API_BASE_URL } from '../lib/api'

type ApiResponse = {
  message?: string | string[]
  resetToken?: string
}

function getMessage(message: string | string[] | undefined, fallback: string) {
  if (Array.isArray(message)) {
    return message.join(' ')
  }

  return message ?? fallback
}

type Step = 'EMAIL' | 'CODE' | 'PASSWORD'

export default function ForgotPasswordPage() {
  const router = useRouter()

  const [step, setStep] = useState<Step>('EMAIL')

  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')

  const [resetToken, setResetToken] = useState('')

  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')

  const [loading, setLoading] = useState(false)

  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  /*
   * 1단계:
   * 비밀번호 재설정 인증번호 발송
   */
  async function sendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setError('')
    setMessage('')

    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedEmail) {
      setError('이메일을 입력해주세요.')
      return
    }

    setLoading(true)

    try {
      const response = await fetch(
        `${API_BASE_URL}/auth/password-reset/send-code`,
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
          },

          body: JSON.stringify({
            email: normalizedEmail,
          }),
        },
      )

      const data = (await response
        .json()
        .catch(() => null)) as ApiResponse | null

      if (!response.ok) {
        setError(getMessage(data?.message, '인증번호 발송에 실패했습니다.'))

        return
      }

      setEmail(normalizedEmail)

      setMessage(
        getMessage(
          data?.message,
          '입력한 이메일이 가입된 계정이라면 인증번호가 전송됩니다.',
        ),
      )

      setStep('CODE')
    } catch {
      setError('서버에 연결할 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }

  /*
   * 인증번호 재발송
   */
  async function resendCode() {
    setError('')
    setMessage('')

    setLoading(true)

    try {
      const response = await fetch(
        `${API_BASE_URL}/auth/password-reset/send-code`,
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
          },

          body: JSON.stringify({
            email,
          }),
        },
      )

      const data = (await response
        .json()
        .catch(() => null)) as ApiResponse | null

      if (!response.ok) {
        setError(getMessage(data?.message, '인증번호 재발송에 실패했습니다.'))

        return
      }

      setCode('')

      setMessage('새 인증번호를 요청했습니다.')
    } catch {
      setError('서버에 연결할 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }

  /*
   * 2단계:
   * 인증번호 확인
   */
  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setError('')
    setMessage('')

    if (!/^\d{6}$/.test(code)) {
      setError('인증번호 6자리를 입력해주세요.')
      return
    }

    setLoading(true)

    try {
      const response = await fetch(
        `${API_BASE_URL}/auth/password-reset/verify-code`,
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
          },

          body: JSON.stringify({
            email,
            code,
          }),
        },
      )

      const data = (await response
        .json()
        .catch(() => null)) as ApiResponse | null

      if (!response.ok) {
        setError(getMessage(data?.message, '인증번호 확인에 실패했습니다.'))

        return
      }

      if (!data?.resetToken) {
        setError('비밀번호 재설정 정보를 확인할 수 없습니다.')
        return
      }

      setResetToken(data.resetToken)

      setMessage('이메일 인증이 완료되었습니다.')

      setStep('PASSWORD')
    } catch {
      setError('서버에 연결할 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }

  /*
   * 3단계:
   * 새 비밀번호 설정
   */
  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setError('')
    setMessage('')

    if (newPassword.length < 8) {
      setError('새 비밀번호는 최소 8자 이상이어야 합니다.')
      return
    }

    if (newPassword.length > 64) {
      setError('새 비밀번호는 최대 64자까지 사용할 수 있습니다.')
      return
    }

    if (newPassword !== newPasswordConfirm) {
      setError('새 비밀번호와 비밀번호 확인이 일치하지 않습니다.')
      return
    }

    if (!resetToken) {
      setError('비밀번호 재설정 인증을 다시 진행해주세요.')
      return
    }

    setLoading(true)

    try {
      const response = await fetch(
        `${API_BASE_URL}/auth/password-reset/reset`,
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
          },

          body: JSON.stringify({
            email,
            resetToken,
            newPassword,
          }),
        },
      )

      const data = (await response
        .json()
        .catch(() => null)) as ApiResponse | null

      if (!response.ok) {
        setError(getMessage(data?.message, '비밀번호 재설정에 실패했습니다.'))

        return
      }

      window.alert(getMessage(data?.message, '비밀번호가 재설정되었습니다.'))

      router.replace('/login')
    } catch {
      setError('서버에 연결할 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
      <div className="w-full max-w-md">
        <Link
          href="/login"
          className="mb-6 inline-block text-sm font-semibold text-sky-600 hover:text-sky-700"
        >
          ← 로그인으로
        </Link>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-bold tracking-widest text-sky-600">
            KOREA TRIP QUEST
          </p>

          <h1 className="mt-3 text-3xl font-bold text-slate-900">
            비밀번호 찾기
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            가입한 이메일을 인증한 뒤 새 비밀번호를 설정할 수 있습니다.
          </p>

          <div className="mt-6 flex items-center gap-2">
            <div
              className={`h-2 flex-1 rounded-full ${
                step === 'EMAIL' || step === 'CODE' || step === 'PASSWORD'
                  ? 'bg-sky-500'
                  : 'bg-slate-200'
              }`}
            />

            <div
              className={`h-2 flex-1 rounded-full ${
                step === 'CODE' || step === 'PASSWORD'
                  ? 'bg-sky-500'
                  : 'bg-slate-200'
              }`}
            />

            <div
              className={`h-2 flex-1 rounded-full ${
                step === 'PASSWORD' ? 'bg-sky-500' : 'bg-slate-200'
              }`}
            />
          </div>

          {step === 'EMAIL' && (
            <form onSubmit={sendCode} className="mt-8 space-y-5">
              <div>
                <label
                  htmlFor="resetEmail"
                  className="mb-2 block text-sm font-bold text-slate-800"
                >
                  이메일
                </label>

                <input
                  id="resetEmail"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  disabled={loading}
                  autoComplete="email"
                  placeholder="example@email.com"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-900 caret-sky-600 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:bg-slate-100"
                />
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-sky-600 px-4 py-3 font-bold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {loading ? '인증번호 요청 중...' : '인증번호 받기'}
              </button>
            </form>
          )}

          {step === 'CODE' && (
            <form onSubmit={verifyCode} className="mt-8 space-y-5">
              <div className="rounded-xl bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-800">
                <span className="font-bold">{email}</span>
                <br />
                입력한 이메일이 가입된 계정이라면 인증번호가 전송됩니다.
              </div>

              <div>
                <label
                  htmlFor="resetCode"
                  className="mb-2 block text-sm font-bold text-slate-800"
                >
                  인증번호
                </label>

                <input
                  id="resetCode"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(event) =>
                    setCode(event.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  required
                  disabled={loading}
                  autoComplete="one-time-code"
                  placeholder="6자리 인증번호"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-xl font-bold tracking-[0.35em] text-slate-900 caret-sky-600 outline-none transition placeholder:text-sm placeholder:font-medium placeholder:tracking-normal placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:bg-slate-100"
                />
              </div>

              {message && (
                <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                  {message}
                </div>
              )}

              {error && (
                <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-sky-600 px-4 py-3 font-bold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {loading ? '확인 중...' : '인증번호 확인'}
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={resendCode}
                  className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  인증번호 재발송
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setStep('EMAIL')
                    setCode('')
                    setError('')
                    setMessage('')
                  }}
                  className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  이메일 변경
                </button>
              </div>
            </form>
          )}

          {step === 'PASSWORD' && (
            <form onSubmit={resetPassword} className="mt-8 space-y-5">
              <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-700">
                이메일 인증이 완료되었습니다.
                <br />새 비밀번호를 설정해주세요.
              </div>

              <div>
                <label
                  htmlFor="newPassword"
                  className="mb-2 block text-sm font-bold text-slate-800"
                >
                  새 비밀번호
                </label>

                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  required
                  disabled={loading}
                  minLength={8}
                  maxLength={64}
                  autoComplete="new-password"
                  placeholder="새 비밀번호"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-900 caret-sky-600 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:bg-slate-100"
                />

                <p className="mt-2 text-xs text-slate-500">
                  비밀번호는 8자 이상 64자 이하로 입력해주세요.
                </p>
              </div>

              <div>
                <label
                  htmlFor="newPasswordConfirm"
                  className="mb-2 block text-sm font-bold text-slate-800"
                >
                  새 비밀번호 확인
                </label>

                <input
                  id="newPasswordConfirm"
                  type="password"
                  value={newPasswordConfirm}
                  onChange={(event) =>
                    setNewPasswordConfirm(event.target.value)
                  }
                  required
                  disabled={loading}
                  minLength={8}
                  maxLength={64}
                  autoComplete="new-password"
                  placeholder="새 비밀번호 다시 입력"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-900 caret-sky-600 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:bg-slate-100"
                />
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-sky-600 px-4 py-3 font-bold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {loading ? '비밀번호 변경 중...' : '새 비밀번호 설정'}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}
