import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'

import ChallengeRating from './components/challenge-rating'

import { API_BASE_URL } from './lib/api'

type Challenge = {
  id: number
  title: string
  description: string | null
  region: string | null
  status: string
  startAt: string | null
  endAt: string | null

  hasCoverImage: boolean
  coverImageUrl: string | null

  coverPositionX: number
  coverPositionY: number

  institutionId: number

  averageRating?: number
  reviewCount?: number
}

type ChallengesResponse = {
  challenges: Challenge[]
}

async function getChallenges(): Promise<Challenge[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/challenges`, {
      cache: 'no-store',
    })

    if (!response.ok) {
      return []
    }

    const data = (await response.json()) as ChallengesResponse

    return Array.isArray(data.challenges)
      ? data.challenges.map((challenge) => ({
          ...challenge,

          hasCoverImage: Boolean(challenge.hasCoverImage),

          coverImageUrl: challenge.coverImageUrl ?? null,

          coverPositionX:
            typeof challenge.coverPositionX === 'number'
              ? challenge.coverPositionX
              : 50,

          coverPositionY:
            typeof challenge.coverPositionY === 'number'
              ? challenge.coverPositionY
              : 50,

          averageRating:
            typeof challenge.averageRating === 'number'
              ? challenge.averageRating
              : 0,

          reviewCount:
            typeof challenge.reviewCount === 'number'
              ? challenge.reviewCount
              : 0,
        }))
      : []
  } catch {
    return []
  }
}

function getDateLocale(locale: string) {
  switch (locale) {
    case 'en':
      return 'en-US'

    case 'ja':
      return 'ja-JP'

    case 'zh-CN':
      return 'zh-CN'

    default:
      return 'ko-KR'
  }
}

function formatDate(
  date: string | null,
  locale: string,
  undecidedLabel: string,
) {
  if (!date) {
    return undecidedLabel
  }

  return new Intl.DateTimeFormat(getDateLocale(locale), {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date))
}

export default async function Home() {
  const challenges = await getChallenges()

  const locale = await getLocale()
  const t = await getTranslations('Home')

  function getStatusLabel(status: string) {
    switch (status) {
      case 'ACTIVE':
        return t('status.active')

      case 'PAUSED':
        return t('status.paused')

      case 'ENDED':
        return t('status.ended')

      default:
        return status
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Hero */}
      <section className="relative overflow-hidden bg-sky-600 px-6 py-16 text-white">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-white/10" />

        <div className="absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-white/10" />

        <div className="relative mx-auto max-w-6xl">
          <p className="mb-3 text-sm font-semibold tracking-widest text-sky-100">
            TRIP QUEST KOREA
          </p>

          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
            {t('hero.title')}
          </h1>

          <p className="mt-5 max-w-2xl text-lg leading-8 text-sky-100">
            {t('hero.description')}
          </p>
        </div>
      </section>

      {/* Challenge 목록 */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-sky-600">
              {t('challengeSection.eyebrow')}
            </p>

            <h2 className="mt-1 text-2xl font-black text-slate-900">
              {t('challengeSection.title')}
            </h2>

            <p className="mt-2 text-slate-600">
              {t('challengeSection.description')}
            </p>
          </div>

          {challenges.length > 0 && (
            <span className="rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-500 shadow-sm">
              {t('challengeSection.count', {
                count: challenges.length,
              })}
            </span>
          )}
        </div>

        {challenges.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <p className="font-semibold text-slate-800">{t('empty.title')}</p>

            <p className="mt-2 text-sm text-slate-500">
              {t('empty.description')}
            </p>
          </div>
        ) : (
          <div className="grid gap-7 md:grid-cols-2 lg:grid-cols-3">
            {challenges.map((challenge) => (
              <article
                key={challenge.id}
                className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg"
              >
                {/* Challenge 대표사진 */}
                <Link href={`/challenges/${challenge.id}`} className="block">
                  <div className="relative h-52 overflow-hidden bg-slate-100">
                    {challenge.coverImageUrl ? (
                      <img
                        src={challenge.coverImageUrl}
                        alt={challenge.title}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        style={{
                          objectPosition: `${challenge.coverPositionX}% ${challenge.coverPositionY}%`,
                        }}
                      />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                        <span className="text-5xl" aria-hidden="true">
                          🧭
                        </span>

                        <p className="mt-3 text-sm font-bold text-slate-500">
                          {t('card.noCoverImage')}
                        </p>
                      </div>
                    )}

                    {challenge.coverImageUrl && (
                      <div className="absolute inset-0 bg-linear-to-t from-black/35 via-transparent to-transparent" />
                    )}

                    <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-sky-700 shadow-sm backdrop-blur">
                      📍 {challenge.region ?? t('card.undecidedRegion')}
                    </span>

                    <span className="absolute right-4 top-4 rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm">
                      {getStatusLabel(challenge.status)}
                    </span>
                  </div>
                </Link>

                {/* Challenge 정보 */}
                <div className="flex min-h-72 flex-col p-6">
                  <div className="flex-1">
                    <p className="text-xs font-bold uppercase tracking-widest text-sky-500">
                      {t('card.type')}
                    </p>

                    {/*
                      기관이 작성한 동적 데이터이므로
                      현재 단계에서는 원문 그대로 표시한다.
                    */}
                    <h3 className="mt-2 line-clamp-2 text-xl font-black text-slate-900">
                      {challenge.title}
                    </h3>

                    {/* Challenge 평균 별점 및 후기 개수 */}
                    <div className="mt-2">
                      <ChallengeRating
                        averageRating={challenge.averageRating}
                        reviewCount={challenge.reviewCount}
                        variant="card"
                      />
                    </div>

                    <p className="mt-3 line-clamp-3 min-h-18 text-sm leading-6 text-slate-600">
                      {challenge.description ?? t('card.noDescription')}
                    </p>

                    <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                      <div className="space-y-2 text-sm text-slate-500">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold text-slate-400">
                            {t('card.start')}
                          </span>

                          <span className="text-right font-semibold text-slate-700">
                            {formatDate(
                              challenge.startAt,
                              locale,
                              t('card.undecidedDate'),
                            )}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold text-slate-400">
                            {t('card.end')}
                          </span>

                          <span className="text-right font-semibold text-slate-700">
                            {formatDate(
                              challenge.endAt,
                              locale,
                              t('card.undecidedDate'),
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Link
                    href={`/challenges/${challenge.id}`}
                    className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 font-bold text-white transition hover:bg-sky-700"
                  >
                    <span>{t('card.viewChallenge')}</span>

                    <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
