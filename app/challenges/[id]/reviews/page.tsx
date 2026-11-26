'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

import ChallengeReviews from '../../../components/challenge-reviews'

import { API_BASE_URL } from '../../../lib/api'

type UserRole = 'USER' | 'INSTITUTION' | 'ADMIN'

type ChallengeDetail = {
  id: number
  title: string
  description: string | null
  region: string | null

  coverImageUrl: string | null
  coverPositionX: number
  coverPositionY: number
}

type ChallengeDetailResponse = {
  challenge: ChallengeDetail
}

type AuthMeResponse = {
  user: {
    id: number
    role: UserRole
  }
}

export default function ChallengeReviewsPage() {
  const params = useParams()

  const challengeIdParam = Array.isArray(params.id) ? params.id[0] : params.id

  const challengeId = Number(challengeIdParam)

  const validChallengeId = Number.isSafeInteger(challengeId) && challengeId > 0

  const [challenge, setChallenge] = useState<ChallengeDetail | null>(null)

  const [userRole, setUserRole] = useState<UserRole | null>(null)

  const [loading, setLoading] = useState(true)

  /*
   * Challenge 기본 정보 및
   * 로그인 사용자 역할 조회
   */
  useEffect(() => {
    const controller = new AbortController()

    const { signal } = controller

    if (!validChallengeId) {
      setLoading(false)
      return
    }

    setLoading(true)
    setChallenge(null)
    setUserRole(null)

    /*
     * Challenge 대표 정보 조회
     */
    async function loadChallenge() {
      try {
        const response = await fetch(
          `${API_BASE_URL}/challenges/${challengeId}`,
          {
            cache: 'no-store',
            signal,
          },
        )

        if (!response.ok) {
          return
        }

        const data = (await response.json()) as ChallengeDetailResponse

        if (signal.aborted || !data.challenge) {
          return
        }

        setChallenge({
          ...data.challenge,

          coverImageUrl: data.challenge.coverImageUrl ?? null,

          coverPositionX:
            typeof data.challenge.coverPositionX === 'number'
              ? data.challenge.coverPositionX
              : 50,

          coverPositionY:
            typeof data.challenge.coverPositionY === 'number'
              ? data.challenge.coverPositionY
              : 50,
        })
      } catch {
        /*
         * Challenge 소개 조회에 실패해도
         * 후기 API 조회는 가능하도록 유지한다.
         */
      }
    }

    /*
     * 로그인 사용자 정보 조회
     */
    async function loadCurrentUser() {
      const accessToken = sessionStorage.getItem('accessToken')

      if (!accessToken) {
        return
      }

      try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },

          cache: 'no-store',
          signal,
        })

        if (signal.aborted) {
          return
        }

        if (response.status === 401) {
          sessionStorage.removeItem('accessToken')
          sessionStorage.removeItem('user')

          return
        }

        if (!response.ok) {
          return
        }

        const data = (await response.json()) as AuthMeResponse

        if (signal.aborted) {
          return
        }

        if (
          data.user?.role === 'USER' ||
          data.user?.role === 'INSTITUTION' ||
          data.user?.role === 'ADMIN'
        ) {
          setUserRole(data.user.role)
        }
      } catch {
        /*
         * 사용자 정보 조회에 실패하더라도
         * 공개 후기 열람은 유지한다.
         */
      }
    }

    /*
     * 페이지 초기 데이터 조회
     */
    async function loadPage() {
      try {
        await Promise.all([loadChallenge(), loadCurrentUser()])
      } finally {
        if (!signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadPage()

    return () => {
      controller.abort()
    }
  }, [challengeId, validChallengeId])

  /*
   * 잘못된 Challenge ID 처리
   */
  if (!validChallengeId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-4xl">🧭</p>

          <h1 className="mt-4 text-xl font-black text-slate-900">
            챌린지를 확인할 수 없습니다.
          </h1>

          <Link
            href="/"
            className="mt-6 inline-flex rounded-xl bg-sky-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-sky-700"
          >
            챌린지 목록으로 돌아가기
          </Link>
        </div>
      </main>
    )
  }

  /*
   * 페이지 로딩
   */
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-sky-100 border-t-sky-600" />

          <p className="mt-4 text-sm font-semibold text-slate-500">
            여행자 후기를 준비하고 있습니다...
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-16">
      {/* 상단 네비게이션 */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link
            href={challenge ? `/challenges/${challengeId}` : '/'}
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 transition hover:text-sky-600"
          >
            <span aria-hidden="true">←</span>

            <span>
              {challenge ? 'Challenge 상세 페이지' : 'Challenge 목록'}
            </span>
          </Link>

          <Link
            href="/"
            className="text-sm font-semibold text-slate-400 transition hover:text-sky-600"
          >
            홈으로
          </Link>
        </div>
      </section>

      {/* 후기 페이지 대표사진 영역 */}
      <section className="relative overflow-hidden bg-sky-700 text-white">
        {challenge?.coverImageUrl ? (
          <>
            <img
              src={challenge.coverImageUrl}
              alt={`${challenge.title} 대표사진`}
              className="absolute inset-0 h-full w-full object-cover"
              style={{
                objectPosition: `${challenge.coverPositionX}% ${challenge.coverPositionY}%`,
              }}
            />

            <div className="absolute inset-0 bg-black/65" />

            <div className="absolute inset-0 bg-linear-to-t from-black/65 to-transparent" />
          </>
        ) : (
          <>
            <div className="absolute inset-0 bg-linear-to-br from-sky-600 via-sky-700 to-indigo-800" />

            <div className="absolute -right-24 -top-32 h-80 w-80 rounded-full bg-white/10" />

            <div className="absolute -bottom-40 -left-20 h-80 w-80 rounded-full bg-white/10" />
          </>
        )}

        <div className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <p className="text-xs font-black tracking-[0.2em] text-sky-100">
            TRIP QUEST KOREA
          </p>

          {challenge?.region && (
            <div className="mt-4">
              <span className="inline-flex rounded-full border border-white/20 bg-black/20 px-3 py-1.5 text-xs font-bold backdrop-blur">
                📍 {challenge.region}
              </span>
            </div>
          )}

          <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
            {challenge?.title ?? 'Challenge'}
          </h1>

          <h2 className="mt-3 text-lg font-bold text-white/90">여행자 후기</h2>

          <p className="mt-3 max-w-2xl text-sm leading-7 text-white/75 sm:text-base">
            챌린지를 완료한 여행자들의 별점과 여행 경험을 확인하고 나만의 후기를
            남겨보세요.
          </p>
        </div>
      </section>

      {/* 기존 여행자 후기 컴포넌트 */}
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <ChallengeReviews
          key={`${challengeId}-${userRole ?? 'guest'}`}
          challengeId={challengeId}
          userRole={userRole}
        />

        {/* Challenge 상세 페이지 돌아가기 */}
        <div className="mt-8 text-center">
          <Link
            href={challenge ? `/challenges/${challengeId}` : '/'}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-600 shadow-sm transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
          >
            <span aria-hidden="true">←</span>

            {challenge
              ? 'Challenge 상세 페이지로 돌아가기'
              : 'Challenge 목록으로 돌아가기'}
          </Link>
        </div>
      </div>
    </main>
  )
}
