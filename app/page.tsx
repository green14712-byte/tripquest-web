import Link from 'next/link'

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
}

type ChallengesResponse = {
  challenges: Challenge[]
}

async function getChallenges(): Promise<Challenge[]> {
  try {
    const response = await fetch('http://localhost:3001/challenges', {
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
        }))
      : []
  } catch {
    return []
  }
}

function formatDate(date: string | null) {
  if (!date) {
    return '미정'
  }

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date))
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'ACTIVE':
      return '운영 중'

    case 'PAUSED':
      return '운영 중단'

    case 'ENDED':
      return '종료'

    default:
      return status
  }
}

export default async function Home() {
  const challenges = await getChallenges()

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Hero */}
      <section className="relative overflow-hidden bg-sky-600 px-6 py-16 text-white">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-white/10" />

        <div className="absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-white/10" />

        <div className="relative mx-auto max-w-6xl">
          <p className="mb-3 text-sm font-semibold tracking-widest text-sky-100">
            KOREA TRIP QUEST
          </p>

          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
            여행을 퀘스트처럼 즐겨보세요
          </h1>

          <p className="mt-5 max-w-2xl text-lg leading-8 text-sky-100">
            한국의 관광지를 방문하고 미션을 완료해 여행 기록과 배지를
            모아보세요.
          </p>
        </div>
      </section>

      {/* Challenge 목록 */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-sky-600">AVAILABLE QUESTS</p>

            <h2 className="mt-1 text-2xl font-black text-slate-900">
              진행 가능한 Challenge
            </h2>

            <p className="mt-2 text-slate-600">
              현재 공개된 여행 Challenge를 확인해보세요.
            </p>
          </div>

          {challenges.length > 0 && (
            <span className="rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-500 shadow-sm">
              총 {challenges.length}개
            </span>
          )}
        </div>

        {challenges.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <p className="font-semibold text-slate-800">
              현재 표시할 Challenge가 없습니다.
            </p>

            <p className="mt-2 text-sm text-slate-500">
              백엔드 서버가 실행 중인지 확인해주세요.
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
                        alt={`${challenge.title} Challenge 대표사진`}
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
                          등록된 대표사진이 없습니다.
                        </p>
                      </div>
                    )}

                    {challenge.coverImageUrl && (
                      <div className="absolute inset-0 bg-linear-to-t from-black/35 via-transparent to-transparent" />
                    )}

                    <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-sky-700 shadow-sm backdrop-blur">
                      📍 {challenge.region ?? '지역 미정'}
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
                      Trip Challenge
                    </p>

                    <h3 className="mt-2 line-clamp-2 text-xl font-black text-slate-900">
                      {challenge.title}
                    </h3>

                    <p className="mt-3 line-clamp-3 min-h-18 text-sm leading-6 text-slate-600">
                      {challenge.description ?? 'Challenge 설명이 없습니다.'}
                    </p>

                    <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                      <div className="space-y-2 text-sm text-slate-500">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold text-slate-400">
                            시작
                          </span>

                          <span className="text-right font-semibold text-slate-700">
                            {formatDate(challenge.startAt)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold text-slate-400">
                            종료
                          </span>

                          <span className="text-right font-semibold text-slate-700">
                            {formatDate(challenge.endAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Link
                    href={`/challenges/${challenge.id}`}
                    className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 font-bold text-white transition hover:bg-sky-700"
                  >
                    <span>Challenge 보기</span>

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
