'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { API_BASE_URL } from '../../lib/api'

type ChallengeStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ENDED' | 'ARCHIVED'

type Challenge = {
  id: number
  title: string
  description: string | null
  region: string | null
  status: ChallengeStatus
  startAt: string | null
  endAt: string | null

  hasCoverImage: boolean
  coverImageUrl: string | null

  institutionId: number
  createdAt: string
  updatedAt: string
}

type FilterType = 'ALL' | 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ENDED'

export default function InstitutionChallengesPage() {
  const router = useRouter()

  const [challenges, setChallenges] = useState<Challenge[]>([])

  const [loading, setLoading] = useState(true)

  const [error, setError] = useState('')

  const [searchKeyword, setSearchKeyword] = useState('')

  const [selectedFilter, setSelectedFilter] = useState<FilterType>('ALL')

  useEffect(() => {
    async function loadChallenges() {
      const accessToken = sessionStorage.getItem('accessToken')

      if (!accessToken) {
        router.replace('/login')
        return
      }

      try {
        /*
         * 현재 로그인한 기관 계정 확인
         */
        const meResponse = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })

        if (meResponse.status === 401) {
          sessionStorage.removeItem('accessToken')

          sessionStorage.removeItem('user')

          router.replace('/login')
          return
        }

        if (!meResponse.ok) {
          throw new Error('로그인 정보를 확인할 수 없습니다.')
        }

        const meData = await meResponse.json()

        const currentUser = meData.user ?? meData

        if (currentUser.role !== 'INSTITUTION') {
          throw new Error('기관 계정만 접근할 수 있습니다.')
        }

        /*
         * 현재 로그인한 기관에서 만든
         * Challenge 전체 조회
         */
        const response = await fetch(
          `${API_BASE_URL}/challenges/institution/me`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        )

        if (response.status === 401) {
          sessionStorage.removeItem('accessToken')

          sessionStorage.removeItem('user')

          router.replace('/login')
          return
        }

        const data = await response.json().catch(() => null)

        if (!response.ok) {
          const message = Array.isArray(data?.message)
            ? data.message.join(', ')
            : data?.message

          throw new Error(message ?? 'Challenge 목록을 불러오지 못했습니다.')
        }

        setChallenges(Array.isArray(data.challenges) ? data.challenges : [])
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message)
        } else {
          setError('Challenge 목록을 불러오는 중 오류가 발생했습니다.')
        }
      } finally {
        setLoading(false)
      }
    }

    loadChallenges()
  }, [router])

  /*
   * 상태별 Challenge 개수
   *
   * ARCHIVED는 종료 탭에 포함한다.
   */
  const counts = useMemo(() => {
    return {
      ALL: challenges.length,

      DRAFT: challenges.filter((challenge) => challenge.status === 'DRAFT')
        .length,

      ACTIVE: challenges.filter((challenge) => challenge.status === 'ACTIVE')
        .length,

      PAUSED: challenges.filter((challenge) => challenge.status === 'PAUSED')
        .length,

      ENDED: challenges.filter(
        (challenge) =>
          challenge.status === 'ENDED' || challenge.status === 'ARCHIVED',
      ).length,
    }
  }, [challenges])

  /*
   * 상태 필터 + 검색어 필터
   */
  const filteredChallenges = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase()

    return challenges.filter((challenge) => {
      let matchesStatus = false

      switch (selectedFilter) {
        case 'ALL':
          matchesStatus = true
          break

        case 'DRAFT':
          matchesStatus = challenge.status === 'DRAFT'
          break

        case 'ACTIVE':
          matchesStatus = challenge.status === 'ACTIVE'
          break

        case 'PAUSED':
          matchesStatus = challenge.status === 'PAUSED'
          break

        case 'ENDED':
          matchesStatus =
            challenge.status === 'ENDED' || challenge.status === 'ARCHIVED'
          break
      }

      if (!matchesStatus) {
        return false
      }

      if (!keyword) {
        return true
      }

      const title = challenge.title.toLowerCase()

      const region = challenge.region?.toLowerCase() ?? ''

      const description = challenge.description?.toLowerCase() ?? ''

      return (
        title.includes(keyword) ||
        region.includes(keyword) ||
        description.includes(keyword)
      )
    })
  }, [challenges, searchKeyword, selectedFilter])

  function getStatusLabel(status: ChallengeStatus) {
    switch (status) {
      case 'DRAFT':
        return '진행 전'

      case 'ACTIVE':
        return '진행 중'

      case 'PAUSED':
        return '운영 중단'

      case 'ENDED':
        return '종료'

      case 'ARCHIVED':
        return '보관'

      default:
        return status
    }
  }

  function getStatusStyle(status: ChallengeStatus) {
    switch (status) {
      case 'DRAFT':
        return 'bg-slate-100 text-slate-700'

      case 'ACTIVE':
        return 'bg-emerald-100 text-emerald-700'

      case 'PAUSED':
        return 'bg-amber-100 text-amber-700'

      case 'ENDED':
        return 'bg-red-100 text-red-700'

      case 'ARCHIVED':
        return 'bg-slate-200 text-slate-600'

      default:
        return 'bg-slate-100 text-slate-700'
    }
  }

  function formatDate(value: string | null) {
    if (!value) {
      return '미설정'
    }

    return new Date(value).toLocaleDateString('ko-KR')
  }

  const filters: {
    key: FilterType
    label: string
    count: number
  }[] = [
    {
      key: 'ALL',
      label: '전체',
      count: counts.ALL,
    },
    {
      key: 'DRAFT',
      label: '진행 전',
      count: counts.DRAFT,
    },
    {
      key: 'ACTIVE',
      label: '진행 중',
      count: counts.ACTIVE,
    },
    {
      key: 'PAUSED',
      label: '운영 중단',
      count: counts.PAUSED,
    },
    {
      key: 'ENDED',
      label: '종료',
      count: counts.ENDED,
    },
  ]

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center bg-slate-50 px-6 py-20">
        <p className="font-semibold text-slate-500">
          Challenge 목록을 불러오는 중...
        </p>
      </main>
    )
  }

  return (
    <main className="flex flex-1 justify-center bg-slate-50 px-6 py-12">
      <div className="w-full max-w-5xl">
        {/* 상단 */}
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <Link
              href="/institution"
              className="text-sm font-bold text-slate-500 transition hover:text-slate-800"
            >
              ← 기관 관리
            </Link>

            <p className="mt-6 text-sm font-bold tracking-widest text-sky-600">
              CHALLENGE MANAGEMENT
            </p>

            <h1 className="mt-2 text-3xl font-bold text-slate-900">
              Challenge 관리
            </h1>

            <p className="mt-2 text-slate-600">
              기관에서 만든 Challenge를 검색하고 상태별로 관리합니다.
            </p>
          </div>

          <Link
            href="/institution/challenges/new"
            className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-sky-700"
          >
            + 새 Challenge 만들기
          </Link>
        </div>

        {/* 오류 */}
        {error && (
          <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        {!error && (
          <>
            {/* 검색 */}
            <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="relative flex-1">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    🔍
                  </span>

                  <input
                    type="text"
                    value={searchKeyword}
                    onChange={(event) => setSearchKeyword(event.target.value)}
                    placeholder="Challenge 제목, 지역, 설명 검색"
                    className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  />
                </div>

                {searchKeyword && (
                  <button
                    type="button"
                    onClick={() => setSearchKeyword('')}
                    className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
                  >
                    검색 초기화
                  </button>
                )}
              </div>
            </section>

            {/* 상태 탭 */}
            <div className="mt-6 overflow-x-auto">
              <div className="flex min-w-max gap-2">
                {filters.map((filter) => {
                  const selected = selectedFilter === filter.key

                  return (
                    <button
                      key={filter.key}
                      type="button"
                      onClick={() => setSelectedFilter(filter.key)}
                      className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition ${
                        selected
                          ? 'border-sky-600 bg-sky-600 text-white'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700'
                      }`}
                    >
                      <span>{filter.label}</span>

                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          selected
                            ? 'bg-white/20 text-white'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {filter.count}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 목록 헤더 */}
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  내 Challenge
                </h2>

                {(searchKeyword || selectedFilter !== 'ALL') && (
                  <p className="mt-1 text-sm text-slate-500">
                    현재 조건에 맞는 Challenge를 표시합니다.
                  </p>
                )}
              </div>

              <p className="text-sm font-semibold text-slate-500">
                검색 결과 {filteredChallenges.length}개 / 전체{' '}
                {challenges.length}개
              </p>
            </div>

            {/* Challenge가 없는 경우 */}
            {challenges.length === 0 ? (
              <section className="mt-5 rounded-3xl border border-dashed border-slate-300 bg-white px-8 py-16 text-center">
                <div className="text-5xl">🧭</div>

                <h2 className="mt-5 text-xl font-bold text-slate-900">
                  아직 만든 Challenge가 없습니다.
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  새로운 여행 Challenge를 만든 뒤 Mission과 인증 정보를 관리할
                  수 있습니다.
                </p>

                <Link
                  href="/institution/challenges/new"
                  className="mt-7 inline-block rounded-xl bg-sky-600 px-6 py-3 font-bold text-white transition hover:bg-sky-700"
                >
                  + 첫 Challenge 만들기
                </Link>
              </section>
            ) : filteredChallenges.length === 0 ? (
              <section className="mt-5 rounded-3xl border border-dashed border-slate-300 bg-white px-8 py-14 text-center">
                <div className="text-5xl">🔎</div>

                <h2 className="mt-5 text-xl font-bold text-slate-900">
                  조건에 맞는 Challenge가 없습니다.
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  검색어를 변경하거나 다른 상태를 선택해보세요.
                </p>

                <button
                  type="button"
                  onClick={() => {
                    setSearchKeyword('')

                    setSelectedFilter('ALL')
                  }}
                  className="mt-6 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  전체 Challenge 보기
                </button>
              </section>
            ) : (
              /* Challenge 목록 */
              <div className="mt-5 space-y-5">
                {filteredChallenges.map((challenge) => (
                  <Link
                    key={challenge.id}
                    href={`/institution/challenges/${challenge.id}`}
                    className="group block overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:border-sky-300 hover:shadow-md"
                  >
                    <div className="grid md:grid-cols-[240px_1fr]">
                      {/* 대표사진 */}
                      <div className="relative min-h-48 overflow-hidden bg-slate-100 md:min-h-full">
                        {challenge.coverImageUrl ? (
                          <img
                            src={challenge.coverImageUrl}
                            alt={`${challenge.title} 대표사진`}
                            className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-linear-to-br from-sky-50 to-slate-100 px-5 text-center">
                            <span className="text-4xl">🏞️</span>

                            <p className="mt-3 text-xs font-bold text-slate-400">
                              대표사진 없음
                            </p>
                          </div>
                        )}

                        <div className="absolute left-4 top-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold shadow-sm ${getStatusStyle(
                              challenge.status,
                            )}`}
                          >
                            {getStatusLabel(challenge.status)}
                          </span>
                        </div>
                      </div>

                      {/* Challenge 정보 */}
                      <div className="p-6">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <h3 className="text-xl font-bold text-slate-900 transition group-hover:text-sky-700">
                              {challenge.title}
                            </h3>

                            {challenge.region && (
                              <p className="mt-2 text-sm font-semibold text-slate-500">
                                📍 {challenge.region}
                              </p>
                            )}

                            {challenge.description ? (
                              <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">
                                {challenge.description}
                              </p>
                            ) : (
                              <p className="mt-3 text-sm text-slate-400">
                                등록된 설명이 없습니다.
                              </p>
                            )}
                          </div>

                          <span className="shrink-0 font-bold text-sky-600">
                            관리 →
                          </span>
                        </div>

                        <div className="mt-5 grid gap-3 border-t border-slate-100 pt-5 text-sm sm:grid-cols-2">
                          <div>
                            <p className="font-semibold text-slate-400">
                              시작일
                            </p>

                            <p className="mt-1 font-semibold text-slate-700">
                              {formatDate(challenge.startAt)}
                            </p>
                          </div>

                          <div>
                            <p className="font-semibold text-slate-400">
                              종료일
                            </p>

                            <p className="mt-1 font-semibold text-slate-700">
                              {formatDate(challenge.endAt)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-slate-400">
                          <span>
                            {challenge.hasCoverImage
                              ? '📷 대표사진 등록됨'
                              : '📷 대표사진 미등록'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
