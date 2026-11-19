'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { API_BASE_URL } from '../../lib/api'

type User = {
  id: number
  email: string
  nickname: string | null
  role: 'USER' | 'INSTITUTION' | 'ADMIN'
  status: 'ACTIVE' | 'SUSPENDED' | 'DELETED'
  institutionId: number | null
  googleConnected: boolean
}

type BadgeShape =
  | 'CIRCLE'
  | 'TRIANGLE'
  | 'DIAMOND'
  | 'PENTAGON'
  | 'HEXAGON'
  | 'SHIELD'

type BadgeCenterType = 'IMAGE' | 'ICON'

type SortKey = 'COMPLETED_AT' | 'DIFFICULTY' | 'SHAPE'

type SortDirection = 'ASC' | 'DESC'

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

const BADGE_SHAPE_ORDER: Record<BadgeShape, number> = {
  CIRCLE: 1,
  TRIANGLE: 2,
  DIAMOND: 3,
  PENTAGON: 4,
  HEXAGON: 5,
  SHIELD: 6,
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date))
}

function getBadgeShapeLabel(shape: BadgeShape) {
  switch (shape) {
    case 'CIRCLE':
      return '원형'

    case 'TRIANGLE':
      return '삼각형'

    case 'DIAMOND':
      return '마름모'

    case 'PENTAGON':
      return '오각형'

    case 'HEXAGON':
      return '육각형'

    case 'SHIELD':
      return '방패형'
  }
}

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

function BadgeVisual({
  badge,
  size = 'normal',
}: {
  badge: UserBadgeItem['badge']
  size?: 'normal' | 'large'
}) {
  const path = getBadgeSvgPath(badge.shape)

  const baseImageSize = 176

  const scaledImageSize = baseImageSize * (badge.imageScale / 100)

  const movableSpace = baseImageSize - scaledImageSize

  const imageX = 12 + movableSpace * (badge.imagePositionX / 100)

  const imageY = 12 + movableSpace * (badge.imagePositionY / 100)

  const clipId = `badge-clip-${badge.id}-${size}`

  const sizeClass =
    size === 'large' ? 'h-56 w-56 sm:h-64 sm:w-64' : 'h-32 w-32 sm:h-36 sm:w-36'

  return (
    <div className={`relative shrink-0 ${sizeClass}`}>
      <svg
        viewBox="0 0 200 200"
        className="h-full w-full drop-shadow-lg"
        role="img"
        aria-label={`${badge.name} ${getBadgeShapeLabel(badge.shape)} 배지`}
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
          <span
            className={size === 'large' ? 'text-7xl' : 'text-5xl'}
            aria-hidden="true"
          >
            {getBadgeIcon(badge.icon)}
          </span>
        </div>
      )}
    </div>
  )
}

function OwnershipBar({ ownershipRate }: { ownershipRate: number }) {
  const safeRate = Math.min(100, Math.max(0, ownershipRate))

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-bold text-slate-500">보유율</span>

        <span className="text-sm font-black text-sky-700">
          {ownershipRate.toFixed(1)}%
        </span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-sky-500 transition-all"
          style={{
            width: `${safeRate}%`,
          }}
        />
      </div>
    </div>
  )
}

export default function MyBadgesPage() {
  const router = useRouter()

  const [user, setUser] = useState<User | null>(null)

  const [badges, setBadges] = useState<UserBadgeItem[]>([])

  const [selectedBadgeId, setSelectedBadgeId] = useState<number | null>(null)

  const [restoredBadgeCount, setRestoredBadgeCount] = useState(0)

  const [loading, setLoading] = useState(true)

  const [error, setError] = useState('')

  /*
   * 검색
   */
  const [searchQuery, setSearchQuery] = useState('')

  /*
   * 정렬
   */
  const [sortKey, setSortKey] = useState<SortKey>('COMPLETED_AT')

  const [sortDirection, setSortDirection] = useState<SortDirection>('DESC')

  useEffect(() => {
    async function loadBadges() {
      const accessToken = sessionStorage.getItem('accessToken')

      if (!accessToken) {
        router.replace('/login')
        return
      }

      try {
        /*
         * 현재 로그인 사용자 확인
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
          throw new Error('사용자 정보를 불러오지 못했습니다.')
        }

        const meData = await meResponse.json()

        const currentUser: User = meData.user ?? meData

        /*
         * 배지 장식장은 일반 USER만 사용
         */
        if (currentUser.role !== 'USER') {
          router.replace('/my')
          return
        }

        setUser(currentUser)

        /*
         * 배지 조회
         */
        const badgeResponse = await fetch(`${API_BASE_URL}/user-badges/me`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },

          cache: 'no-store',
        })

        const badgeData = (await badgeResponse
          .json()
          .catch(() => null)) as UserBadgesResponse | null

        if (!badgeResponse.ok) {
          throw new Error(
            badgeData?.message ?? '내 배지를 불러오지 못했습니다.',
          )
        }

        const receivedBadges = Array.isArray(badgeData?.badges)
          ? badgeData.badges
          : []

        setBadges(receivedBadges)

        setRestoredBadgeCount(
          typeof badgeData?.restoredBadgeCount === 'number'
            ? badgeData.restoredBadgeCount
            : 0,
        )
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message)
        } else {
          setError('배지를 불러오는 중 오류가 발생했습니다.')
        }
      } finally {
        setLoading(false)
      }
    }

    void loadBadges()
  }, [router])

  /*
   * 모달이 열렸을 때 ESC 키로 닫기
   */
  useEffect(() => {
    if (selectedBadgeId === null) {
      return
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSelectedBadgeId(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [selectedBadgeId])

  const selectedBadge = useMemo(() => {
    if (selectedBadgeId === null) {
      return null
    }

    return badges.find((badge) => badge.id === selectedBadgeId) ?? null
  }, [badges, selectedBadgeId])

  /*
   * 검색 + 정렬 적용
   */
  const visibleBadges = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()

    const filtered =
      normalizedQuery.length === 0
        ? [...badges]
        : badges.filter((item) => {
            const badgeName = item.badge.name.toLowerCase()

            const challengeTitle = item.challenge.title.toLowerCase()

            return (
              badgeName.includes(normalizedQuery) ||
              challengeTitle.includes(normalizedQuery)
            )
          })

    filtered.sort((a, b) => {
      let result = 0

      if (sortKey === 'COMPLETED_AT') {
        result =
          new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime()
      }

      if (sortKey === 'DIFFICULTY') {
        result = a.badge.difficulty - b.badge.difficulty
      }

      if (sortKey === 'SHAPE') {
        result =
          BADGE_SHAPE_ORDER[a.badge.shape] - BADGE_SHAPE_ORDER[b.badge.shape]
      }

      if (result === 0) {
        result = a.badge.name.localeCompare(b.badge.name, 'ko')
      }

      return sortDirection === 'ASC' ? result : -result
    })

    return filtered
  }, [badges, searchQuery, sortDirection, sortKey])

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-20">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-sky-200 border-t-sky-600" />

          <p className="mt-4 font-semibold text-slate-500">
            배지 장식장을 불러오는 중...
          </p>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-20">
        <div className="w-full max-w-xl rounded-3xl border border-red-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-bold tracking-widest text-red-500">
            BADGE CABINET
          </p>

          <h1 className="mt-2 text-2xl font-black text-slate-900">
            배지를 불러오지 못했습니다.
          </h1>

          <p className="mt-4 text-sm leading-6 text-red-600">{error}</p>

          <Link
            href="/my"
            className="mt-6 inline-flex rounded-xl bg-sky-600 px-5 py-3 font-bold text-white transition hover:bg-sky-700"
          >
            My로 돌아가기
          </Link>
        </div>
      </main>
    )
  }

  if (!user) {
    return null
  }

  return (
    <main className="min-h-screen bg-slate-50">
      {/* 상단 Hero */}
      <section className="relative overflow-hidden bg-sky-600 px-6 py-12 text-white sm:py-16">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-white/10" />

        <div className="absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-white/10" />

        <div className="relative mx-auto max-w-7xl">
          <Link
            href="/my"
            className="inline-flex items-center gap-2 text-sm font-bold text-sky-100 transition hover:text-white"
          >
            <span aria-hidden="true">←</span>
            <span>My로 돌아가기</span>
          </Link>

          <div className="mt-8 flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-sm font-bold tracking-[0.25em] text-sky-100">
                TRIP QUEST KOREA
              </p>

              <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
                My Badge Cabinet
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-7 text-sky-100 sm:text-lg">
                여행을 완주하며 획득한 배지를 나만의 장식장에 모아보세요. 획득
                당시의 디자인과 버전은 이후 Challenge가 바뀌어도 그대로
                보존됩니다.
              </p>
            </div>

            <div className="rounded-3xl bg-white/15 px-6 py-5 backdrop-blur">
              <p className="text-xs font-bold tracking-widest text-sky-100">
                OWNED BADGES
              </p>

              <p className="mt-1 text-4xl font-black">{badges.length}</p>

              <p className="mt-1 text-sm text-sky-100">보유 배지</p>
            </div>
          </div>

          {restoredBadgeCount > 0 && (
            <div className="mt-8 rounded-2xl border border-white/20 bg-white/10 px-5 py-4">
              <p className="font-bold text-white">
                과거 완료 기록에서 배지 {restoredBadgeCount}개를 복원했습니다.
              </p>
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 py-10 sm:py-12">
        {/* 검색 / 정렬 */}
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <label
                htmlFor="badge-search"
                className="text-sm font-bold text-slate-700"
              >
                배지 검색
              </label>

              <div className="relative mt-2">
                <span
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                >
                  🔎
                </span>

                <input
                  id="badge-search"
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="배지 이름 또는 Challenge 이름 검색"
                  className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-[220px_120px]">
              <div>
                <label
                  htmlFor="badge-sort"
                  className="text-sm font-bold text-slate-700"
                >
                  정렬 기준
                </label>

                <select
                  id="badge-sort"
                  value={sortKey}
                  onChange={(event) =>
                    setSortKey(event.target.value as SortKey)
                  }
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                >
                  <option value="COMPLETED_AT">취득일</option>

                  <option value="DIFFICULTY">난이도</option>

                  <option value="SHAPE">배지 모양</option>
                </select>
              </div>

              <div>
                <p className="text-sm font-bold text-slate-700">순서</p>

                <button
                  type="button"
                  onClick={() =>
                    setSortDirection((current) =>
                      current === 'ASC' ? 'DESC' : 'ASC',
                    )
                  }
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  <span aria-hidden="true">
                    {sortDirection === 'ASC' ? '↑' : '↓'}
                  </span>

                  <span>
                    {sortDirection === 'ASC' ? '오름차순' : '내림차순'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <p className="text-sm text-slate-500">
              총{' '}
              <span className="font-bold text-slate-800">{badges.length}</span>
              개 중{' '}
              <span className="font-bold text-sky-600">
                {visibleBadges.length}
              </span>
              개 표시
            </p>

            {(searchQuery ||
              sortKey !== 'COMPLETED_AT' ||
              sortDirection !== 'DESC') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  setSortKey('COMPLETED_AT')
                  setSortDirection('DESC')
                }}
                className="text-sm font-bold text-sky-600 transition hover:text-sky-700"
              >
                검색·정렬 초기화
              </button>
            )}
          </div>
        </section>

        {badges.length === 0 ? (
          <section className="mt-8 rounded-4xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-sky-50 text-5xl">
              🏅
            </div>

            <h2 className="mt-6 text-2xl font-black text-slate-900">
              아직 장식장이 비어 있습니다.
            </h2>

            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-500">
              Challenge의 모든 ACTIVE Mission을 완료하면 해당 Challenge의 완료
              배지를 획득할 수 있습니다.
            </p>

            <Link
              href="/"
              className="mt-7 inline-flex rounded-xl bg-sky-600 px-6 py-3 font-bold text-white transition hover:bg-sky-700"
            >
              Challenge 찾아보기
            </Link>
          </section>
        ) : visibleBadges.length === 0 ? (
          <section className="mt-8 rounded-4xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-4xl">
              🔎
            </div>

            <h2 className="mt-5 text-xl font-black text-slate-900">
              검색 결과가 없습니다.
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              다른 배지 이름이나 Challenge 이름으로 검색해보세요.
            </p>

            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="mt-5 rounded-xl bg-sky-600 px-5 py-3 font-bold text-white transition hover:bg-sky-700"
            >
              검색 초기화
            </button>
          </section>
        ) : (
          <section className="mt-8">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm font-bold tracking-widest text-sky-600">
                  COLLECTION
                </p>

                <h2 className="mt-1 text-2xl font-black text-slate-900">
                  나의 배지 장식장
                </h2>
              </div>

              <p className="text-sm text-slate-500">
                배지를 클릭하면 상세 정보를 확인할 수 있습니다.
              </p>
            </div>

            <div className="rounded-4xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
              <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {visibleBadges.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedBadgeId(item.id)}
                    className="group text-left"
                  >
                    <div className="relative flex min-h-64 flex-col items-center overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 p-4 transition duration-200 hover:-translate-y-1 hover:border-sky-300 hover:bg-sky-50 hover:shadow-md">
                      <div className="flex min-h-40 flex-1 items-center justify-center">
                        <BadgeVisual badge={item.badge} />
                      </div>

                      <div className="mt-2 w-full border-t border-slate-200 pt-4 text-center">
                        <p className="line-clamp-2 min-h-10 font-black text-slate-900">
                          {item.badge.name}
                        </p>

                        <p
                          className="mt-1 text-sm tracking-wide text-amber-500"
                          aria-label={`난이도 ${item.badge.difficulty}점`}
                        >
                          {'★'.repeat(item.badge.difficulty)}
                        </p>

                        <p className="mt-2 text-xs font-bold text-sky-700">
                          보유율 {item.badge.ownershipRate.toFixed(1)}%
                        </p>
                      </div>

                      <div className="absolute inset-x-3 bottom-0 h-2 rounded-t-full bg-linear-to-b from-slate-300 to-slate-400 shadow-sm transition group-hover:from-sky-300 group-hover:to-sky-400" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>

      {/* 배지 상세 모달 */}
      {selectedBadge && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedBadgeId(null)
            }
          }}
        >
          <div className="relative max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <button
              type="button"
              onClick={() => setSelectedBadgeId(null)}
              className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-xl font-bold text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
              aria-label="배지 상세 닫기"
            >
              ×
            </button>

            <div className="grid lg:grid-cols-[330px_minmax(0,1fr)]">
              {/* 왼쪽 */}
              <div className="relative flex min-h-96 items-center justify-center overflow-hidden bg-linear-to-br from-sky-50 via-white to-cyan-50 p-8 lg:min-h-full">
                <div className="absolute h-72 w-72 rounded-full bg-sky-200/30 blur-3xl" />

                <div className="relative text-center">
                  <BadgeVisual badge={selectedBadge.badge} size="large" />

                  <div className="mx-auto mt-6 h-3 w-64 max-w-full rounded-full bg-linear-to-b from-slate-200 to-slate-400 shadow-md" />

                  <p className="mt-5 text-xs font-bold tracking-[0.2em] text-slate-400">
                    BADGE VERSION {selectedBadge.badge.version}
                  </p>
                </div>
              </div>

              {/* 오른쪽 */}
              <div className="p-6 sm:p-8">
                <div className="pr-10">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-bold text-sky-700">
                      V{selectedBadge.badge.version}
                    </span>

                    {selectedBadge.badge.isCurrentVersion ? (
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                        현재 지급 버전
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                        과거 버전
                      </span>
                    )}

                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                      {getBadgeShapeLabel(selectedBadge.badge.shape)}
                    </span>
                  </div>

                  <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-900">
                    {selectedBadge.badge.name}
                  </h2>

                  <p
                    className="mt-3 text-2xl tracking-wider text-amber-500"
                    aria-label={`난이도 ${selectedBadge.badge.difficulty}점`}
                  >
                    {'★'.repeat(selectedBadge.badge.difficulty)}
                  </p>
                </div>

                {selectedBadge.badge.description && (
                  <p className="mt-6 text-sm leading-7 text-slate-600">
                    {selectedBadge.badge.description}
                  </p>
                )}

                {/* 보유율 */}
                <div className="mt-7 rounded-2xl border border-sky-100 bg-sky-50 p-5">
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold text-sky-700">
                        이 버전의 보유율
                      </p>

                      <p className="mt-1 text-4xl font-black text-slate-900">
                        {selectedBadge.badge.ownershipRate.toFixed(1)}%
                      </p>
                    </div>

                    <p className="text-sm text-slate-500">
                      {selectedBadge.badge.ownershipCount}명 / 전체 참여자{' '}
                      {selectedBadge.badge.participantCount}명
                    </p>
                  </div>

                  <div className="mt-5">
                    <OwnershipBar
                      ownershipRate={selectedBadge.badge.ownershipRate}
                    />
                  </div>

                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    해당 Challenge 전체 참여자 중 이 BadgeVersion을 보유한
                    사용자 비율입니다.
                  </p>
                </div>

                {/* 상세 */}
                <div className="mt-7 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-bold text-slate-400">
                      Challenge
                    </p>

                    <p className="mt-2 font-bold text-slate-900">
                      {selectedBadge.challenge.title}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-bold text-slate-400">획득일</p>

                    <p className="mt-2 font-bold text-slate-900">
                      {formatDate(selectedBadge.completedAt)}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-bold text-slate-400">
                      획득 당시 Mission 수
                    </p>

                    <p className="mt-2 font-bold text-slate-900">
                      {selectedBadge.badge.missionCount}개
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-bold text-slate-400">
                      배지 형태
                    </p>

                    <p className="mt-2 font-bold text-slate-900">
                      {getBadgeShapeLabel(selectedBadge.badge.shape)}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-bold text-slate-400">
                      배지 버전
                    </p>

                    <p className="mt-2 font-bold text-slate-900">
                      V{selectedBadge.badge.version}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-bold text-slate-400">
                      발급 기록 생성일
                    </p>

                    <p className="mt-2 font-bold text-slate-900">
                      {formatDate(selectedBadge.issuedAt)}
                    </p>
                  </div>
                </div>

                <div className="mt-7 flex flex-wrap gap-3">
                  <Link
                    href={`/challenges/${selectedBadge.challengeId}`}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-5 py-3 font-bold text-white transition hover:bg-sky-700"
                  >
                    <span>Challenge 보기</span>

                    <span aria-hidden="true">→</span>
                  </Link>

                  <button
                    type="button"
                    onClick={() => setSelectedBadgeId(null)}
                    className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    닫기
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
