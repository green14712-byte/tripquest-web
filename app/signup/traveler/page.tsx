'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'

type ApiResponse = {
  message?: string | string[]
  verificationToken?: string
}

function getMessage(message: string | string[] | undefined, fallback: string) {
  if (Array.isArray(message)) {
    return message.join(' ')
  }

  return message ?? fallback
}

export default function SignupPage() {
  const router = useRouter()

  const [step, setStep] = useState<1 | 2 | 3>(1)

  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')

  const [verificationToken, setVerificationToken] = useState('')

  const [nickname, setNickname] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  function resetMessages() {
    setMessage('')
    setError('')
  }

  async function sendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    resetMessages()
    setLoading(true)

    try {
      const response = await fetch(
        'http://localhost:3001/auth/email/send-code',
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

      const data = (await response.json()) as ApiResponse

      if (!response.ok) {
        setError(getMessage(data.message, '인증번호 발송에 실패했습니다.'))
        return
      }

      setMessage(getMessage(data.message, '인증번호를 이메일로 전송했습니다.'))

      setStep(2)
    } catch {
      setError('서버에 연결할 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    resetMessages()
    setLoading(true)

    try {
      const response = await fetch(
        'http://localhost:3001/auth/email/verify-code',
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

      const data = (await response.json()) as ApiResponse

      if (!response.ok) {
        setError(getMessage(data.message, '이메일 인증에 실패했습니다.'))
        return
      }

      if (!data.verificationToken) {
        setError('회원가입 인증 토큰을 확인할 수 없습니다.')
        return
      }

      setVerificationToken(data.verificationToken)

      setMessage('이메일 인증이 완료되었습니다.')

      setStep(3)
    } catch {
      setError('서버에 연결할 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    resetMessages()

    if (nickname.trim().length < 2) {
      setError('닉네임은 최소 2자 이상 입력해주세요.')
      return
    }

    if (password.length < 8) {
      setError('비밀번호는 최소 8자 이상 입력해주세요.')
      return
    }

    if (password !== passwordConfirm) {
      setError('비밀번호와 비밀번호 확인이 일치하지 않습니다.')
      return
    }

    if (!verificationToken) {
      setError('이메일 인증을 다시 진행해주세요.')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('http://localhost:3001/auth/register', {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
        },

        body: JSON.stringify({
          email,
          verificationToken,
          password,
          nickname: nickname.trim(),
        }),
      })

      const data = (await response.json()) as ApiResponse

      if (!response.ok) {
        setError(getMessage(data.message, '회원가입에 실패했습니다.'))
        return
      }

      alert('회원가입이 완료되었습니다.')

      router.push('/login')
    } catch {
      setError('서버에 연결할 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-slate-50 px-6 py-12">
      <div className="w-full max-w-lg">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-bold tracking-widest text-sky-600">
            KOREA TRIP QUEST
          </p>

          <h1 className="mt-3 text-3xl font-bold text-slate-900">회원가입</h1>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            이메일 인증 후 Korea Trip Quest를 시작해보세요.
          </p>

          <div className="mt-7 flex gap-2">
            {[1, 2, 3].map((number) => (
              <div
                key={number}
                className={`h-2 flex-1 rounded-full ${
                  step >= number ? 'bg-sky-600' : 'bg-slate-200'
                }`}
              />
            ))}
          </div>

          <p className="mt-3 text-sm font-semibold text-slate-500">
            {step === 1 && '1단계 · 이메일 입력'}

            {step === 2 && '2단계 · 인증번호 확인'}

            {step === 3 && '3단계 · 계정 정보 입력'}
          </p>

          {step === 1 && (
            <form onSubmit={sendCode} className="mt-7 space-y-5">
              <div>
                <label
                  htmlFor="signup-email"
                  className="mb-2 block text-sm font-bold text-slate-800"
                >
                  이메일
                </label>

                <input
                  id="signup-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  autoComplete="email"
                  placeholder="example@email.com"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-sky-600 px-4 py-3 font-bold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {loading ? '전송 중...' : '인증번호 받기'}
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={verifyCode} className="mt-7 space-y-5">
              <div className="rounded-xl bg-sky-50 px-4 py-3">
                <p className="text-xs font-semibold text-slate-500">
                  인증 이메일
                </p>

                <p className="mt-1 break-all font-semibold text-slate-800">
                  {email}
                </p>
              </div>

              <div>
                <label
                  htmlFor="verification-code"
                  className="mb-2 block text-sm font-bold text-slate-800"
                >
                  인증번호
                </label>

                <input
                  id="verification-code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(event) =>
                    setCode(event.target.value.replace(/\D/g, ''))
                  }
                  required
                  placeholder="6자리 인증번호"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-xl font-bold tracking-[0.3em] text-slate-900 outline-none transition placeholder:text-base placeholder:font-medium placeholder:tracking-normal placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-sky-600 px-4 py-3 font-bold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {loading ? '확인 중...' : '인증하기'}
              </button>

              <button
                type="button"
                onClick={() => {
                  resetMessages()
                  setCode('')
                  setStep(1)
                }}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                이메일 다시 입력
              </button>
            </form>
          )}

          {step === 3 && (
            <form onSubmit={register} className="mt-7 space-y-5">
              <div className="rounded-xl bg-emerald-50 px-4 py-3">
                <p className="text-sm font-semibold text-emerald-700">
                  ✓ 이메일 인증 완료
                </p>

                <p className="mt-1 break-all text-sm text-slate-600">{email}</p>
              </div>

              <div>
                <label
                  htmlFor="nickname"
                  className="mb-2 block text-sm font-bold text-slate-800"
                >
                  닉네임
                </label>

                <input
                  id="nickname"
                  type="text"
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  required
                  minLength={2}
                  maxLength={30}
                  placeholder="사용할 닉네임"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                />
              </div>

              <div>
                <label
                  htmlFor="signup-password"
                  className="mb-2 block text-sm font-bold text-slate-800"
                >
                  비밀번호
                </label>

                <input
                  id="signup-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={8}
                  maxLength={64}
                  autoComplete="new-password"
                  placeholder="8자 이상 입력"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                />
              </div>

              <div>
                <label
                  htmlFor="password-confirm"
                  className="mb-2 block text-sm font-bold text-slate-800"
                >
                  비밀번호 확인
                </label>

                <input
                  id="password-confirm"
                  type="password"
                  value={passwordConfirm}
                  onChange={(event) => setPasswordConfirm(event.target.value)}
                  required
                  minLength={8}
                  maxLength={64}
                  autoComplete="new-password"
                  placeholder="비밀번호 다시 입력"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-sky-600 px-4 py-3 font-bold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {loading ? '가입 중...' : '회원가입 완료'}
              </button>
            </form>
          )}

          {message && (
            <div className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
              {message}
            </div>
          )}

          {error && (
            <div className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error}
            </div>
          )}

          <div className="mt-8 border-t border-slate-200 pt-6 text-center">
            <p className="text-sm text-slate-600">
              이미 계정이 있나요?{' '}
              <Link
                href="/login"
                className="font-bold text-sky-600 hover:text-sky-700"
              >
                로그인
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
