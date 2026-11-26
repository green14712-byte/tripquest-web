'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

import { API_BASE_URL } from '../lib/api'

type ReviewSort = 'latest' | 'highest' | 'lowest'

type UserRole = 'USER' | 'INSTITUTION' | 'ADMIN'

type Review = {
  id: number
  challengeId: number
  rating: number
  comment: string | null
  createdAt: string
  updatedAt: string
}

type PublicReview = Review & {
  isEdited: boolean

  author: {
    nickname: string
  }

  isVerifiedTraveler: boolean
}

type ReviewDistribution = {
  1: number
  2: number
  3: number
  4: number
  5: number
}

type ReviewsResponse = {
  challengeId: number

  averageRating: number
  reviewCount: number

  ratingDistribution: ReviewDistribution

  sort: ReviewSort

  reviews: PublicReview[]
}

type MyReviewResponse = {
  challengeId: number

  hasCompletedChallenge: boolean
  completedAt: string | null

  hasReview: boolean

  canWriteReview: boolean
  canEditReview: boolean
  canDeleteReview: boolean

  review: Review | null
}

type ChallengeReviewsProps = {
  challengeId: number

  userRole?: UserRole | null

  refreshKey?: string | number | boolean
}

const RATING_LABELS = [
  '별점을 선택해주세요.',
  '아쉬워요',
  '조금 아쉬워요',
  '보통이에요',
  '좋아요',
  '최고예요!',
]

const EMPTY_DISTRIBUTION: ReviewDistribution = {
  1: 0,
  2: 0,
  3: 0,
  4: 0,
  5: 0,
}

function getResponseMessage(data: unknown, fallback: string) {
  if (typeof data !== 'object' || data === null || !('message' in data)) {
    return fallback
  }

  const message = data.message

  if (Array.isArray(message)) {
    return message.join(', ')
  }

  if (typeof message === 'string') {
    return message
  }

  return fallback
}

function formatReviewDate(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

/*
 * 별점 표시 컴포넌트
 *
 * 평균 별점은 소수점 단위로 채워서 표시한다.
 */
function RatingStars({
  rating,
  className = '',
}: {
  rating: number
  className?: string
}) {
  const normalizedRating = Math.max(0, Math.min(5, rating))

  return (
    <div
      className={`inline-flex items-center gap-0.5 ${className}`}
      role="img"
      aria-label={`5점 만점에 ${normalizedRating}점`}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const fillPercent =
          Math.max(0, Math.min(1, normalizedRating - (star - 1))) * 100

        return (
          <span
            key={star}
            className="relative inline-block leading-none"
            aria-hidden="true"
          >
            <span className="text-slate-200">★</span>

            <span
              className="absolute inset-y-0 left-0 overflow-hidden whitespace-nowrap text-amber-400"
              style={{
                width: `${fillPercent}%`,
              }}
            >
              ★
            </span>
          </span>
        )
      })}
    </div>
  )
}

/*
 * 별점 선택 컴포넌트
 */
function RatingPicker({
  value,
  onChange,
  disabled,
}: {
  value: number
  onChange: (value: number) => void
  disabled?: boolean
}) {
  const [hoverRating, setHoverRating] = useState(0)

  const displayRating = hoverRating || value

  return (
    <div>
      <div
        className="flex items-center justify-center gap-1 sm:gap-3"
        role="group"
        aria-label="별점 선택"
        onMouseLeave={() => setHoverRating(0)}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={disabled}
            aria-label={`${star}점 선택`}
            aria-pressed={value === star}
            onMouseEnter={() => setHoverRating(star)}
            onFocus={() => setHoverRating(star)}
            onBlur={() => setHoverRating(0)}
            onClick={() => onChange(star)}
            className={[
              'rounded-xl px-1 text-4xl leading-none',
              'transition duration-200 sm:text-5xl',
              'hover:scale-110',
              'focus-visible:outline-2',
              'focus-visible:outline-sky-400',
              'disabled:cursor-not-allowed',
              'disabled:opacity-50',
              star <= displayRating ? 'text-amber-400' : 'text-slate-300',
            ].join(' ')}
          >
            ★
          </button>
        ))}
      </div>

      <p className="mt-4 text-center text-sm font-bold text-sky-700">
        {RATING_LABELS[displayRating]}
      </p>
    </div>
  )
}

export default function ChallengeReviews({
  challengeId,
  userRole = null,
  refreshKey = 0,
}: ChallengeReviewsProps) {
  /*
   * 전체 후기 상태
   */
  const [reviewsData, setReviewsData] = useState<ReviewsResponse | null>(null)

  const [sort, setSort] = useState<ReviewSort>('latest')

  const [loading, setLoading] = useState(true)

  const [loadError, setLoadError] = useState('')

  /*
   * 로그인 사용자의 후기 상태
   */
  const [myReviewData, setMyReviewData] = useState<MyReviewResponse | null>(
    null,
  )

  const [myLoading, setMyLoading] = useState(false)

  const [myError, setMyError] = useState('')

  /*
   * 후기 작성 및 수정 상태
   */
  const [editing, setEditing] = useState(false)

  const [rating, setRating] = useState(0)

  const [comment, setComment] = useState('')

  const [saving, setSaving] = useState(false)

  const [deleting, setDeleting] = useState(false)

  const [actionError, setActionError] = useState('')

  const [actionMessage, setActionMessage] = useState('')

  /*
   * 후기 목록 초기 표시 개수
   */
  const [visibleCount, setVisibleCount] = useState(5)

  const reviewsUrl = `${API_BASE_URL}/challenges/${challengeId}/reviews`

  const myReviewUrl = `${reviewsUrl}/me`

  /*
   * 전체 후기 및 평균 별점 조회
   */
  const loadReviews = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true)
      setLoadError('')

      try {
        const response = await fetch(`${reviewsUrl}?sort=${sort}`, {
          cache: 'no-store',
          signal,
        })

        const data = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(
            getResponseMessage(data, '후기를 불러오지 못했습니다.'),
          )
        }

        if (signal?.aborted) {
          return
        }

        setReviewsData(data as ReviewsResponse)
      } catch (error) {
        if (signal?.aborted) {
          return
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : '후기를 불러오는 중 오류가 발생했습니다.',
        )
      } finally {
        if (!signal?.aborted) {
          setLoading(false)
        }
      }
    },
    [reviewsUrl, sort],
  )

  /*
   * 본인 후기 및 작성 자격 조회
   */
  const loadMyReview = useCallback(
    async (signal?: AbortSignal) => {
      const accessToken = sessionStorage.getItem('accessToken')

      if (!accessToken || userRole !== 'USER') {
        setMyReviewData(null)
        setMyError('')
        setMyLoading(false)

        return
      }

      setMyLoading(true)
      setMyError('')

      try {
        const response = await fetch(myReviewUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },

          cache: 'no-store',
          signal,
        })

        const data = await response.json().catch(() => null)

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error(
              '로그인 세션이 만료되었습니다. 다시 로그인해주세요.',
            )
          }

          throw new Error(
            getResponseMessage(data, '후기 작성 자격을 확인하지 못했습니다.'),
          )
        }

        if (signal?.aborted) {
          return
        }

        const result = data as MyReviewResponse

        setMyReviewData(result)
      } catch (error) {
        if (signal?.aborted) {
          return
        }

        setMyReviewData(null)

        setMyError(
          error instanceof Error
            ? error.message
            : '내 후기를 불러오는 중 오류가 발생했습니다.',
        )
      } finally {
        if (!signal?.aborted) {
          setMyLoading(false)
        }
      }
    },
    [myReviewUrl, userRole],
  )

  /*
   * Challenge 또는 정렬 방식 변경 시 조회
   */
  useEffect(() => {
    const controller = new AbortController()

    void loadReviews(controller.signal)

    return () => {
      controller.abort()
    }
  }, [loadReviews])

  /*
   * 로그인 사용자 및 Challenge 완료 상태
   * 변경 시 후기 작성 자격 다시 확인
   */
  useEffect(() => {
    const controller = new AbortController()

    void loadMyReview(controller.signal)

    return () => {
      controller.abort()
    }
  }, [loadMyReview, refreshKey])

  /*
   * 정렬 또는 Challenge 변경 시
   * 후기 표시 개수 초기화
   */
  useEffect(() => {
    setVisibleCount(5)
  }, [challengeId, sort])

  /*
   * Challenge 또는 사용자 역할 변경 시
   * 작성 화면 초기화
   */
  useEffect(() => {
    setMyReviewData(null)

    setEditing(false)
    setRating(0)
    setComment('')

    setActionError('')
    setActionMessage('')
  }, [challengeId, userRole])

  /*
   * 후기 수정 시작
   */
  function handleStartEdit() {
    const review = myReviewData?.review

    if (!review || !myReviewData?.canEditReview) {
      return
    }

    setRating(review.rating)

    setComment(review.comment ?? '')

    setEditing(true)

    setActionError('')
    setActionMessage('')
  }

  /*
   * 후기 작성 또는 수정 취소
   */
  function handleCancelEdit() {
    setEditing(false)

    setRating(0)
    setComment('')

    setActionError('')
  }

  /*
   * 후기 등록 및 수정
   */
  async function handleSaveReview() {
    if (saving || deleting) {
      return
    }

    setActionError('')
    setActionMessage('')

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      setActionError('별점을 선택해주세요.')

      return
    }

    if (Array.from(comment).length > 500) {
      setActionError('후기는 최대 500자까지 작성할 수 있습니다.')

      return
    }

    const accessToken = sessionStorage.getItem('accessToken')

    if (!accessToken) {
      setActionError('로그인이 필요합니다.')

      return
    }

    if (editing) {
      if (!myReviewData?.canEditReview) {
        setActionError('후기를 수정할 수 없습니다.')

        return
      }
    } else if (!myReviewData?.canWriteReview) {
      setActionError('챌린지를 완료한 여행자만 후기를 작성할 수 있습니다.')

      return
    }

    setSaving(true)

    try {
      const response = await fetch(editing ? myReviewUrl : reviewsUrl, {
        method: editing ? 'PATCH' : 'POST',

        headers: {
          'Content-Type': 'application/json',

          Authorization: `Bearer ${accessToken}`,
        },

        body: JSON.stringify({
          rating,

          comment: comment.trim() || null,
        }),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(
          getResponseMessage(
            data,
            editing ? '후기 수정에 실패했습니다.' : '후기 등록에 실패했습니다.',
          ),
        )
      }

      setActionMessage(
        getResponseMessage(
          data,
          editing ? '후기가 수정되었습니다.' : '후기가 등록되었습니다.',
        ),
      )

      setEditing(false)

      setRating(0)
      setComment('')

      /*
       * 저장 직후 평균 별점, 후기 개수,
       * 내 후기 내용을 다시 조회한다.
       */
      await Promise.all([loadReviews(), loadMyReview()])
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : '후기 저장 중 오류가 발생했습니다.',
      )
    } finally {
      setSaving(false)
    }
  }

  /*
   * 본인 후기 삭제
   */
  async function handleDeleteReview() {
    if (saving || deleting || !myReviewData?.canDeleteReview) {
      return
    }

    const confirmed = window.confirm(
      '작성한 후기를 삭제하시겠습니까?\n챌린지 완료 기록과 획득한 배지는 그대로 유지됩니다.',
    )

    if (!confirmed) {
      return
    }

    const accessToken = sessionStorage.getItem('accessToken')

    if (!accessToken) {
      setActionError('로그인이 필요합니다.')

      return
    }

    setDeleting(true)

    setActionError('')
    setActionMessage('')

    try {
      const response = await fetch(myReviewUrl, {
        method: 'DELETE',

        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(getResponseMessage(data, '후기 삭제에 실패했습니다.'))
      }

      setActionMessage(getResponseMessage(data, '후기가 삭제되었습니다.'))

      setEditing(false)
      setRating(0)
      setComment('')

      await Promise.all([loadReviews(), loadMyReview()])
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : '후기 삭제 중 오류가 발생했습니다.',
      )
    } finally {
      setDeleting(false)
    }
  }

  /*
   * 화면에 표시할 통계
   */
  const averageRating = reviewsData?.averageRating ?? 0

  const reviewCount = reviewsData?.reviewCount ?? 0

  const distribution = reviewsData?.ratingDistribution ?? EMPTY_DISTRIBUTION

  const reviews = reviewsData?.reviews ?? []

  const visibleReviews = reviews.slice(0, visibleCount)

  const myReview = myReviewData?.review ?? null

  const busy = saving || deleting

  const showReviewForm =
    userRole === 'USER' &&
    !myLoading &&
    !myError &&
    Boolean(
      myReviewData?.canWriteReview || (editing && myReviewData?.canEditReview),
    )

  return (
    <section
      id="challenge-reviews"
      className="scroll-mt-28 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8"
    >
      {/* 후기 영역 제목 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black tracking-[0.2em] text-sky-500">
            TRAVEL REVIEWS
          </p>

          <h2 className="mt-2 text-2xl font-black text-slate-900">
            여행자 후기
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            챌린지를 완료한 여행자들의 경험을 확인해보세요.
          </p>
        </div>

        {reviewsData && !loadError && (
          <span className="rounded-full bg-sky-50 px-4 py-2 text-sm font-bold text-sky-700">
            후기 {reviewCount}개
          </span>
        )}
      </div>

      {/* 후기 통계 */}
      {!loadError && reviewsData && (
        <div className="mt-6 grid gap-6 rounded-2xl border border-slate-100 bg-slate-50 p-5 sm:grid-cols-[150px_1fr] sm:items-center sm:p-6">
          <div className="text-center">
            <div className="flex items-end justify-center gap-1">
              <span className="text-5xl font-black text-slate-900">
                {reviewCount > 0 ? averageRating.toFixed(1) : '—'}
              </span>

              {reviewCount > 0 && (
                <span className="pb-1 text-sm font-bold text-slate-400">
                  / 5
                </span>
              )}
            </div>

            <RatingStars rating={averageRating} className="mt-3 text-2xl" />

            <p className="mt-2 text-sm font-medium text-slate-500">
              {reviewCount > 0
                ? `${reviewCount}개의 평가`
                : '아직 평가가 없습니다.'}
            </p>
          </div>

          <div className="space-y-3">
            {([5, 4, 3, 2, 1] as const).map((score) => {
              const count = distribution[score] ?? 0

              const percent = reviewCount > 0 ? (count / reviewCount) * 100 : 0

              return (
                <div key={score} className="flex items-center gap-3">
                  <span className="w-8 shrink-0 text-sm font-semibold text-slate-600">
                    {score}점
                  </span>

                  <div
                    className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-200"
                    role="progressbar"
                    aria-label={`${score}점 후기 비율`}
                    aria-valuenow={Math.round(percent)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="h-full rounded-full bg-amber-400 transition-all duration-500"
                      style={{
                        width: `${percent}%`,
                      }}
                    />
                  </div>

                  <span className="w-8 shrink-0 text-right text-xs font-bold text-slate-500">
                    {count}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 비로그인 사용자 안내 */}
      {!userRole && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-sky-100 bg-sky-50 p-5">
          <div>
            <p className="font-bold text-slate-800">
              여행 경험을 공유해보세요.
            </p>

            <p className="mt-1 text-sm leading-6 text-slate-500">
              로그인 후 챌린지를 완료하면 후기를 작성할 수 있습니다.
            </p>
          </div>

          <Link
            href="/login"
            className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-sky-700"
          >
            로그인
          </Link>
        </div>
      )}

      {/* 여행자 작성 자격 로딩 */}
      {userRole === 'USER' && myLoading && (
        <div className="mt-6 rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">
          후기 작성 자격을 확인하고 있습니다...
        </div>
      )}

      {/* 작성 자격 조회 오류 */}
      {userRole === 'USER' && myError && (
        <div className="mt-6 rounded-2xl border border-rose-100 bg-rose-50 p-5">
          <p className="text-sm font-semibold text-rose-700">{myError}</p>

          <button
            type="button"
            onClick={() => void loadMyReview()}
            className="mt-3 text-sm font-bold text-rose-700 underline"
          >
            다시 확인
          </button>
        </div>
      )}

      {/* 아직 Challenge를 완료하지 않은 USER */}
      {userRole === 'USER' &&
        !myLoading &&
        !myError &&
        myReviewData &&
        !myReviewData.hasCompletedChallenge &&
        !myReview && (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔒</span>

              <div>
                <p className="font-bold text-slate-700">
                  챌린지 완료 후 후기 작성
                </p>

                <p className="mt-1 text-sm leading-6 text-slate-500">
                  챌린지의 미션을 모두 완료하면 별점과 후기를 남길 수 있습니다.
                </p>
              </div>
            </div>
          </div>
        )}

      {/* 내 후기 표시 */}
      {myReview && !editing && !myLoading && !myError && (
        <div className="mt-6 rounded-2xl border border-sky-100 bg-sky-50/60 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-black text-slate-900">
              나의 여행 후기
            </h3>

            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
              ✓ 작성 완료
            </span>
          </div>

          <RatingStars rating={myReview.rating} className="mt-4 text-3xl" />

          <p className="mt-2 text-sm font-semibold text-slate-600">
            {RATING_LABELS[myReview.rating]}
          </p>

          {myReview.comment ? (
            <div className="mt-4 whitespace-pre-wrap warp-break-words rounded-xl border border-sky-100 bg-white p-4 text-sm leading-7 text-slate-700">
              {myReview.comment}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              별점만 등록한 후기입니다.
            </p>
          )}

          <p className="mt-3 text-xs text-slate-400">
            작성일 {formatReviewDate(myReview.createdAt)}
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {myReviewData?.canEditReview && (
              <button
                type="button"
                disabled={busy}
                onClick={handleStartEdit}
                className="rounded-xl border border-sky-200 bg-white px-4 py-2.5 text-sm font-bold text-sky-700 transition hover:bg-sky-100 disabled:opacity-50"
              >
                후기 수정
              </button>
            )}

            {myReviewData?.canDeleteReview && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleDeleteReview()}
                className="rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-bold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
              >
                {deleting ? '삭제 중...' : '후기 삭제'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* 후기 작성 및 수정 폼 */}
      {showReviewForm && (
        <form
          className="mt-6 rounded-2xl border border-sky-100 bg-linear-to-b from-sky-50 to-white p-5 sm:p-6"
          onSubmit={(event) => {
            event.preventDefault()

            void handleSaveReview()
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-black text-slate-900">
              {editing ? '나의 후기 수정' : '나의 여행 후기 작성'}
            </h3>

            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
              ✓ 챌린지 완료
            </span>
          </div>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            이번 여행은 어떠셨나요? 별점과 함께 소감을 남겨주세요.
          </p>

          <div className="my-7">
            <RatingPicker value={rating} onChange={setRating} disabled={busy} />
          </div>

          <label
            htmlFor={`challenge-review-${challengeId}`}
            className="text-sm font-bold text-slate-700"
          >
            후기 내용
            <span className="ml-2 text-xs font-normal text-slate-400">
              선택 사항
            </span>
          </label>

          <textarea
            id={`challenge-review-${challengeId}`}
            value={comment}
            disabled={busy}
            rows={5}
            onChange={(event) => {
              const value = Array.from(event.target.value)
                .slice(0, 500)
                .join('')

              setComment(value)
            }}
            placeholder="여행 코스, 미션, 관광지에 대한 솔직한 후기를 남겨주세요."
            className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100 disabled:opacity-50"
          />

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-slate-400">
              별점만 등록할 수도 있습니다.
            </span>

            <span className="text-xs font-semibold text-slate-500">
              {Array.from(comment).length}/500
            </span>
          </div>

          <div className="mt-5 flex gap-3">
            {editing && (
              <button
                type="button"
                disabled={busy}
                onClick={handleCancelEdit}
                className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                취소
              </button>
            )}

            <button
              type="submit"
              disabled={rating === 0 || busy}
              className="flex-1 rounded-xl bg-sky-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {saving
                ? '저장 중...'
                : editing
                  ? '후기 수정하기'
                  : '후기 등록하기'}
            </button>
          </div>

          <p className="mt-4 text-center text-xs leading-5 text-slate-400">
            후기 작성은 선택 사항이며 챌린지 완료 및 배지 획득과는 별개입니다.
          </p>
        </form>
      )}

      {/* 작업 성공 메시지 */}
      {actionMessage && (
        <div
          role="status"
          className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"
        >
          {actionMessage}
        </div>
      )}

      {/* 작업 실패 메시지 */}
      {actionError && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700"
        >
          {actionError}
        </div>
      )}

      {/* 전체 후기 목록 */}
      <div className="mt-8 border-t border-slate-100 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-black text-slate-900">
            전체 후기
            {reviewsData && !loadError && (
              <span className="ml-2 text-sm font-bold text-slate-400">
                {reviewCount}
              </span>
            )}
          </h3>

          <select
            value={sort}
            aria-label="후기 정렬 방식"
            disabled={busy}
            onChange={(event) => setSort(event.target.value as ReviewSort)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-600 outline-none focus:border-sky-400"
          >
            <option value="latest">최신순</option>

            <option value="highest">높은 별점순</option>

            <option value="lowest">낮은 별점순</option>
          </select>
        </div>

        {/* 전체 후기 조회 중 */}
        {loading && (
          <div
            role="status"
            className="py-12 text-center text-sm text-slate-500"
          >
            후기를 불러오는 중...
          </div>
        )}

        {/* 전체 후기 조회 실패 */}
        {!loading && loadError && (
          <div className="mt-5 rounded-xl bg-rose-50 p-5 text-center">
            <p className="text-sm font-semibold text-rose-700">{loadError}</p>

            <button
              type="button"
              onClick={() => void loadReviews()}
              className="mt-3 rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm font-bold text-rose-600"
            >
              다시 불러오기
            </button>
          </div>
        )}

        {/* 아직 후기가 없는 경우 */}
        {!loading && !loadError && reviews.length === 0 && (
          <div className="py-12 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sky-50 text-3xl">
              💬
            </div>

            <p className="mt-4 font-bold text-slate-700">
              아직 등록된 후기가 없습니다.
            </p>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              챌린지를 완료하고 첫 번째 여행 후기를 남겨보세요.
            </p>
          </div>
        )}

        {/* 실제 후기 목록 */}
        {!loading && !loadError && visibleReviews.length > 0 && (
          <div className="mt-3 divide-y divide-slate-100">
            {visibleReviews.map((review) => {
              const isMine = myReview?.id === review.id

              const nickname = review.author.nickname || '여행자'

              return (
                <article key={review.id} className="py-5 sm:py-6">
                  <div className="flex items-start gap-3">
                    {/* 작성자 프로필 */}
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-100 text-lg font-black text-sky-700">
                      {Array.from(nickname)[0] || '여'}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="break-all font-bold text-slate-800">
                          {nickname}
                        </span>

                        {isMine && (
                          <span className="rounded-full bg-sky-100 px-2 py-1 text-[10px] font-bold text-sky-700">
                            내 후기
                          </span>
                        )}

                        {review.isVerifiedTraveler && (
                          <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">
                            ✓ 완료 여행자
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <RatingStars
                          rating={review.rating}
                          className="text-lg"
                        />

                        <span className="text-xs font-bold text-slate-500">
                          {review.rating}.0
                        </span>

                        <span className="text-xs text-slate-400">
                          · {formatReviewDate(review.createdAt)}
                        </span>

                        {review.isEdited && (
                          <span className="text-xs text-slate-400">
                            · 수정됨
                          </span>
                        )}
                      </div>

                      {review.comment ? (
                        <p className="mt-3 whitespace-pre-wrap wrap-break-words text-sm leading-7 text-slate-700">
                          {review.comment}
                        </p>
                      ) : (
                        <p className="mt-3 text-sm text-slate-400">
                          별점만 등록한 후기입니다.
                        </p>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        {/* 후기 더 보기 */}
        {!loading && !loadError && visibleCount < reviews.length && (
          <button
            type="button"
            onClick={() => setVisibleCount((current) => current + 5)}
            className="mt-3 w-full rounded-xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-600 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
          >
            후기 더 보기 ({visibleReviews.length}/{reviews.length})
          </button>
        )}
      </div>
    </section>
  )
}
