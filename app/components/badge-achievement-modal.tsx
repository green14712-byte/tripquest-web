'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'

import { API_BASE_URL } from '../lib/api'

/*
 * Mission 인증 API에서 반환하는
 * Challenge 완료 및 배지 지급 정보
 */
export type ChallengeCompletionResult = {
  completed: boolean
  justCompleted: boolean
  completedAt: string | null
  badgeAwarded: boolean
  userBadgeId: number | null
  badgeVersionId: number | null
}

type BadgeShape =
  | 'CIRCLE'
  | 'TRIANGLE'
  | 'DIAMOND'
  | 'PENTAGON'
  | 'HEXAGON'
  | 'SHIELD'

type BadgeCenterType = 'IMAGE' | 'ICON'

type UserBadgeItem = {
  id: number
  challengeId: number
  badgeVersionId: number
  completedAt: string
  issuedAt: string

  challenge: {
    id: number
    title: string
    status: string
  }

  badge: {
    id: number
    version: number
    missionCount: number
    shape: BadgeShape
    difficulty: number
    borderColor: string
    centerType: BadgeCenterType
    hasCenterImage: boolean
    centerImageUrl: string | null
    imageScale: number
    imagePositionX: number
    imagePositionY: number
    icon: string | null
    name: string
    description: string | null
    createdAt: string

    ownershipCount: number
    participantCount: number
    ownershipRate: number
    isCurrentVersion: boolean
  }
}

type UserBadgesResponse = {
  message?: string
  restoredBadgeCount?: number
  badges?: UserBadgeItem[]
}

type BadgeAchievementModalProps = {
  userBadgeId: number
  badgeVersionId: number
  accessToken: string
  onClose: () => void
}

/*
 * 이번 인증에서 실제로 신규 배지를
 * 획득했는지 확인한다.
 */
export function hasNewBadgeAward(
  completion: ChallengeCompletionResult | null | undefined,
): completion is ChallengeCompletionResult & {
  userBadgeId: number
  badgeVersionId: number
} {
  return (
    completion?.justCompleted === true &&
    completion.badgeAwarded === true &&
    typeof completion.userBadgeId === 'number' &&
    typeof completion.badgeVersionId === 'number'
  )
}

/*
 * 기존 배지 장식장과 동일한 SVG 모양
 */
function getBadgeSvgPath(shape: BadgeShape) {
  switch (shape) {
    case 'CIRCLE':
      return 'M100 12 A88 88 0 1 1 99.99 12 Z'

    case 'TRIANGLE':
      return 'M100 14 L184 170 L16 170 Z'

    case 'DIAMOND':
      return 'M100 10 L190 100 L100 190 L10 100 Z'

    case 'PENTAGON':
      return 'M100 10 L186 73 L153 175 L47 175 L14 73 Z'

    case 'HEXAGON':
      return 'M50 14 L150 14 L190 100 L150 186 L50 186 L10 100 Z'

    case 'SHIELD':
      return 'M100 10 L178 38 L168 122 C160 158 132 181 100 190 C68 181 40 158 32 122 L22 38 Z'
  }
}

/*
 * 기존 배지 장식장과 동일한 기본 아이콘
 */
function getBadgeIcon(icon: string | null) {
  switch (icon) {
    case 'PALACE':
      return '🏯'

    case 'BICYCLE':
      return '🚲'

    case 'MOUNTAIN':
      return '⛰️'

    case 'SEA':
      return '🌊'

    default:
      return '🏅'
  }
}

/*
 * 실제 지급된 BadgeVersion 렌더링
 */
function BadgeVisual({ badge }: { badge: UserBadgeItem['badge'] }) {
  const uniqueId = useId()

  const clipId = `achievement-badge-${uniqueId.replace(/[^a-zA-Z0-9_-]/g, '')}`

  const path = getBadgeSvgPath(badge.shape)

  const baseImageSize = 176

  const scaledImageSize = baseImageSize * (badge.imageScale / 100)

  const movableSpace = baseImageSize - scaledImageSize

  const imageX = 12 + movableSpace * (badge.imagePositionX / 100)

  const imageY = 12 + movableSpace * (badge.imagePositionY / 100)

  return (
    <div className="relative h-52 w-52 shrink-0 sm:h-64 sm:w-64">
      <svg
        viewBox="0 0 200 200"
        className="h-full w-full drop-shadow-xl"
        role="img"
        aria-label={`${badge.name} 배지`}
      >
        <defs>
          <clipPath id={clipId}>
            <path d={path} />
          </clipPath>
        </defs>

        <path d={path} fill="#FFFFFF" />

        {badge.centerType === 'IMAGE' && badge.centerImageUrl && (
          <image
            href={badge.centerImageUrl}
            x={imageX}
            y={imageY}
            width={scaledImageSize}
            height={scaledImageSize}
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#${clipId})`}
          />
        )}

        <path
          d={path}
          fill="none"
          stroke={badge.borderColor}
          strokeWidth="12"
          strokeLinejoin="round"
        />
      </svg>

      {badge.centerType === 'ICON' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="text-6xl sm:text-7xl" aria-hidden="true">
            {getBadgeIcon(badge.icon)}
          </span>
        </div>
      )}
    </div>
  )
}

/*
 * 축하용 색종이 효과
 */
const CONFETTI_COLORS = [
  '#38BDF8',
  '#FBBF24',
  '#34D399',
  '#A78BFA',
  '#FB7185',
  '#F97316',
]

function CelebrationConfetti() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {Array.from({ length: 36 }, (_, index) => {
        const left = (index * 37 + 11) % 100

        const delay = (index % 9) * 0.1

        const duration = 2.4 + (index % 5) * 0.25

        const rotation = index * 47

        return (
          <span
            key={index}
            className="achievement-confetti absolute -top-5"
            style={{
              left: `${left}%`,

              width: index % 2 === 0 ? 7 : 5,

              height: index % 2 === 0 ? 11 : 7,

              borderRadius: index % 3 === 0 ? '50%' : '2px',

              backgroundColor: CONFETTI_COLORS[index % CONFETTI_COLORS.length],

              animationDelay: `${delay}s`,

              animationDuration: `${duration}s`,

              transform: `rotate(${rotation}deg)`,
            }}
          />
        )
      })}
    </div>
  )
}

/*
 * 배지 획득 축하 팝업
 */
export default function BadgeAchievementModal({
  userBadgeId,
  badgeVersionId,
  accessToken,
  onClose,
}: BadgeAchievementModalProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null)

  const titleId = useId()

  const [item, setItem] = useState<UserBadgeItem | null>(null)

  const [loading, setLoading] = useState(true)

  const [error, setError] = useState('')

  const [retryCount, setRetryCount] = useState(0)

  /*
   * 네이티브 dialog를 사용하여
   * 다른 화면보다 위에 팝업을 표시한다.
   */
  useEffect(() => {
    const dialog = dialogRef.current

    if (dialog && !dialog.open) {
      dialog.showModal()
    }

    return () => {
      if (dialog?.open) {
        dialog.close()
      }
    }
  }, [])

  /*
   * 실제 사용자에게 지급된 배지를 조회한다.
   *
   * UserBadge ID와 BadgeVersion ID를 모두 비교하여
   * 정확히 이번에 지급된 배지만 표시한다.
   */
  useEffect(() => {
    const controller = new AbortController()

    let disposed = false

    async function loadAwardedBadge() {
      setLoading(true)
      setError('')
      setItem(null)

      try {
        const response = await fetch(`${API_BASE_URL}/user-badges/me`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },

          cache: 'no-store',

          signal: controller.signal,
        })

        const data = (await response
          .json()
          .catch(() => null)) as UserBadgesResponse | null

        if (!response.ok) {
          throw new Error(
            data?.message ?? '획득한 배지 정보를 불러오지 못했습니다.',
          )
        }

        const badges = Array.isArray(data?.badges) ? data.badges : []

        const awardedBadge = badges.find(
          (badge) =>
            badge.id === userBadgeId && badge.badgeVersionId === badgeVersionId,
        )

        if (!awardedBadge) {
          throw new Error('획득한 배지 정보를 확인하지 못했습니다.')
        }

        if (!disposed) {
          setItem(awardedBadge)
        }
      } catch (err) {
        if (disposed || controller.signal.aborted) {
          return
        }

        setError(
          err instanceof Error
            ? err.message
            : '배지 정보를 불러오는 중 오류가 발생했습니다.',
        )
      } finally {
        if (!disposed) {
          setLoading(false)
        }
      }
    }

    void loadAwardedBadge()

    return () => {
      disposed = true
      controller.abort()
    }
  }, [accessToken, userBadgeId, badgeVersionId, retryCount])

  const difficulty = item
    ? Math.min(5, Math.max(0, Math.floor(item.badge.difficulty)))
    : 0

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      className="fixed inset-0 m-auto max-h-[92dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-3xl border-0 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/70 backdrop:backdrop-blur-sm"
    >
      <div className="achievement-modal-enter relative overflow-hidden rounded-3xl bg-white">
        {/* 닫기 버튼 */}
        <button
          type="button"
          autoFocus
          onClick={onClose}
          aria-label="배지 획득 팝업 닫기"
          className="absolute right-4 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-2xl font-bold text-slate-500 shadow-sm transition hover:bg-slate-100 hover:text-slate-900"
        >
          ×
        </button>

        {/* 상단 배경 및 축하 문구 */}
        <div className="relative overflow-hidden bg-linear-to-b from-sky-100 via-sky-50 to-white px-5 pb-6 pt-12 text-center sm:px-8">
          <div className="absolute -left-20 -top-20 h-48 w-48 rounded-full bg-sky-200/40 blur-2xl" />

          <div className="absolute -right-20 top-20 h-48 w-48 rounded-full bg-cyan-200/40 blur-2xl" />

          {item && <CelebrationConfetti />}

          <div className="relative z-10">
            <p className="text-xs font-black tracking-[0.22em] text-sky-600 sm:text-sm">
              CHALLENGE COMPLETED!
            </p>

            <h2
              id={titleId}
              className="mt-3 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl"
            >
              새로운 배지를 획득했어요!
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-500">
              모든 Mission을 완료하신 것을 축하합니다.
            </p>
          </div>

          {/* 배지 로딩 */}
          {loading && (
            <div
              role="status"
              className="relative flex min-h-64 flex-col items-center justify-center"
            >
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-sky-200 border-t-sky-600 motion-reduce:animate-none" />

              <p className="mt-5 text-sm font-bold text-slate-500">
                획득한 배지를 불러오는 중...
              </p>
            </div>
          )}

          {/* 실제 획득 배지 */}
          {!loading && item && (
            <div className="relative mt-5 flex min-h-64 items-center justify-center">
              {/* 배지 뒤쪽 빛 효과 */}
              <div
                aria-hidden="true"
                className="achievement-glow absolute h-52 w-52 rounded-full bg-sky-300/40 blur-3xl sm:h-64 sm:w-64"
              />

              <span
                aria-hidden="true"
                className="achievement-sparkle absolute left-[13%] top-[20%] text-3xl text-amber-400"
              >
                ✦
              </span>

              <span
                aria-hidden="true"
                className="achievement-sparkle absolute right-[13%] top-[18%] text-2xl text-sky-400"
                style={{
                  animationDelay: '0.4s',
                }}
              >
                ✦
              </span>

              <span
                aria-hidden="true"
                className="achievement-sparkle absolute bottom-[18%] left-[16%] text-xl text-sky-400"
                style={{
                  animationDelay: '0.8s',
                }}
              >
                ✧
              </span>

              <span
                aria-hidden="true"
                className="achievement-sparkle absolute bottom-[14%] right-[15%] text-3xl text-amber-400"
                style={{
                  animationDelay: '0.6s',
                }}
              >
                ✦
              </span>

              <div className="achievement-badge-enter relative z-10">
                <BadgeVisual badge={item.badge} />
              </div>
            </div>
          )}

          {/* 배지 이름 및 난이도 */}
          {!loading && item && (
            <div className="achievement-text-enter relative z-10 mt-3">
              <p className="text-xs font-black tracking-[0.2em] text-sky-500">
                NEW BADGE
              </p>

              <h3 className="mt-2 wrap-break-words text-2xl font-black text-slate-900 sm:text-3xl">
                {item.badge.name}
              </h3>

              <div
                aria-label={`난이도 ${difficulty}점`}
                className="mt-3 flex items-center justify-center gap-1 text-2xl"
              >
                {Array.from({ length: 5 }, (_, index) => (
                  <span
                    key={index}
                    className={
                      index < difficulty ? 'text-amber-400' : 'text-slate-200'
                    }
                  >
                    ★
                  </span>
                ))}
              </div>

              <p className="mt-3 text-sm font-bold text-slate-500">
                {item.challenge.title}
              </p>

              {item.badge.description && (
                <p className="mx-auto mt-3 max-w-sm whitespace-pre-wrap wrap-break-words text-sm leading-6 text-slate-600">
                  {item.badge.description}
                </p>
              )}
            </div>
          )}

          {/* 배지 조회 실패 */}
          {!loading && error && (
            <div
              role="alert"
              className="relative mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5"
            >
              <div className="text-4xl">🏅</div>

              <p className="mt-3 font-bold text-amber-800">
                배지는 정상적으로 지급되었습니다.
              </p>

              <p className="mt-2 text-sm leading-6 text-amber-700">
                현재 배지 디자인 정보를 불러오지 못했습니다.
              </p>

              <p className="mt-2 text-xs text-amber-600">{error}</p>

              <button
                type="button"
                onClick={() => setRetryCount((current) => current + 1)}
                className="mt-4 rounded-xl border border-amber-300 bg-white px-5 py-2.5 text-sm font-bold text-amber-800 transition hover:bg-amber-100"
              >
                다시 불러오기
              </button>
            </div>
          )}
        </div>

        {/* 하단 이동 버튼 */}
        <div className="relative z-20 px-5 pb-6 sm:px-8 sm:pb-8">
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-4 text-center">
            <span
              aria-hidden="true"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-600 text-xs font-black text-white"
            >
              ✓
            </span>

            <p className="text-sm font-bold text-sky-700">
              내 배지 장식장에 추가되었습니다.
            </p>
          </div>

          <Link
            href="/my/badges"
            onClick={onClose}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-600 px-5 py-4 text-sm font-black text-white shadow-lg shadow-sky-200/70 transition hover:bg-sky-700 sm:text-base"
          >
            <span aria-hidden="true">🏅</span>

            <span>내 배지 장식장 보기</span>

            <span aria-hidden="true">→</span>
          </Link>

          <button
            type="button"
            onClick={onClose}
            className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
          >
            계속 둘러보기
          </button>
        </div>
      </div>

      {/* 배지 획득 애니메이션 */}
      <style jsx>{`
        .achievement-modal-enter {
          animation: modalEnter 0.35s ease-out both;
        }

        .achievement-badge-enter {
          animation: badgeEnter 0.85s cubic-bezier(0.2, 0.8, 0.3, 1.2) both;
        }

        .achievement-text-enter {
          animation: textEnter 0.6s 0.35s ease-out both;
        }

        .achievement-glow {
          animation: glowPulse 2.5s ease-in-out infinite;
        }

        .achievement-sparkle {
          animation: sparkle 1.8s ease-in-out infinite;
        }

        .achievement-confetti {
          animation-name: confettiFall;
          animation-timing-function: linear;
          animation-fill-mode: both;
        }

        @keyframes modalEnter {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.96);
          }

          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes badgeEnter {
          0% {
            opacity: 0;
            transform: scale(0.15) rotate(-12deg);
          }

          65% {
            opacity: 1;
            transform: scale(1.12) rotate(3deg);
          }

          100% {
            opacity: 1;
            transform: scale(1) rotate(0deg);
          }
        }

        @keyframes textEnter {
          from {
            opacity: 0;
            transform: translateY(12px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes glowPulse {
          0%,
          100% {
            opacity: 0.45;
            transform: scale(0.9);
          }

          50% {
            opacity: 0.9;
            transform: scale(1.15);
          }
        }

        @keyframes sparkle {
          0%,
          100% {
            opacity: 0.25;
            transform: scale(0.65) rotate(0deg);
          }

          50% {
            opacity: 1;
            transform: scale(1.2) rotate(20deg);
          }
        }

        @keyframes confettiFall {
          0% {
            opacity: 0;
            translate: 0 -20px;
            rotate: 0deg;
          }

          10% {
            opacity: 1;
          }

          85% {
            opacity: 0.9;
          }

          100% {
            opacity: 0;
            translate: 20px 580px;
            rotate: 360deg;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .achievement-modal-enter,
          .achievement-badge-enter,
          .achievement-text-enter,
          .achievement-glow,
          .achievement-sparkle,
          .achievement-confetti {
            animation: none !important;
          }

          .achievement-confetti {
            display: none;
          }
        }
      `}</style>
    </dialog>
  )
}
