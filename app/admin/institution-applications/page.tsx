'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

type User = {
  id: number
  email: string
  nickname: string | null
  role: 'USER' | 'INSTITUTION' | 'ADMIN'
  status: string
  institutionId: number | null
}

type ApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

type FilterStatus = 'ALL' | ApplicationStatus

type InstitutionApplication = {
  id: number
  applicantId: number
  institutionName: string
  representativeName: string
  contactEmail: string
  contactPhone?: string | null
  address?: string | null
  website?: string | null
  description?: string | null
  status: ApplicationStatus
  rejectionReason?: string | null
  createdAt?: string
  reviewedAt?: string | null
}

function getMessage(message: string | string[] | undefined, fallback: string) {
  if (Array.isArray(message)) {
    return message.join(' ')
  }

  return message ?? fallback
}

function formatDate(value?: string) {
  if (!value) {
    return '-'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '-'
  }

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function statusLabel(status: ApplicationStatus) {
  if (status === 'APPROVED') {
    return '승인 완료'
  }

  if (status === 'REJECTED') {
    return '거절'
  }

  return '승인 대기'
}

function statusClass(status: ApplicationStatus) {
  if (status === 'APPROVED') {
    return 'bg-emerald-100 text-emerald-700'
  }

  if (status === 'REJECTED') {
    return 'bg-red-100 text-red-700'
  }

  return 'bg-amber-100 text-amber-800'
}

export default function InstitutionApplicationsAdminPage() {
  const router = useRouter()

  const [applications, setApplications] = useState<InstitutionApplication[]>([])

  const [search, setSearch] = useState('')

  const [selectedStatus, setSelectedStatus] = useState<FilterStatus>('ALL')

  const [loading, setLoading] = useState(true)

  const [error, setError] = useState('')

  useEffect(() => {
    async function loadApplications() {
      const accessToken = sessionStorage.getItem('accessToken')

      if (!accessToken) {
        router.replace('/login')
        return
      }

      try {
        const headers = {
          Authorization: `Bearer ${accessToken}`,
        }

        // 현재 로그인 사용자 확인
        const meResponse = await fetch('http://localhost:3001/auth/me', {
          headers,
        })

        if (meResponse.status === 401) {
          sessionStorage.removeItem('accessToken')

          sessionStorage.removeItem('user')

          router.replace('/login')
          return
        }

        if (!meResponse.ok) {
          throw new Error('로그인 사용자 정보를 확인할 수 없습니다.')
        }

        const meData = await meResponse.json()

        const currentUser: User = meData.user ?? meData

        if (currentUser.role !== 'ADMIN') {
          setError('관리자만 접근할 수 있는 페이지입니다.')

          return
        }

        sessionStorage.setItem('user', JSON.stringify(currentUser))

        // 전체 기관 신청 이력 조회
        const applicationResponse = await fetch(
          'http://localhost:3001/institution-applications/admin/all',
          {
            headers,
          },
        )

        const data = await applicationResponse.json().catch(() => null)

        if (!applicationResponse.ok) {
          throw new Error(
            getMessage(
              data?.message,
              '기관 가입 신청 목록을 불러오지 못했습니다.',
            ),
          )
        }

        let applicationList: InstitutionApplication[] = []

        if (Array.isArray(data)) {
          applicationList = data
        } else if (Array.isArray(data?.applications)) {
          applicationList = data.applications
        }

        // 가장 최근 신청을 위에 표시
        const sorted = [...applicationList].sort((a, b) => b.id - a.id)

        setApplications(sorted)
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message)
        } else {
          setError('기관 가입 신청 목록을 불러오는 중 오류가 발생했습니다.')
        }
      } finally {
        setLoading(false)
      }
    }

    loadApplications()
  }, [router])

  const counts = useMemo(() => {
    return {
      ALL: applications.length,

      PENDING: applications.filter(
        (application) => application.status === 'PENDING',
      ).length,

      APPROVED: applications.filter(
        (application) => application.status === 'APPROVED',
      ).length,

      REJECTED: applications.filter(
        (application) => application.status === 'REJECTED',
      ).length,
    }
  }, [applications])

  const filteredApplications = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    return applications.filter((application) => {
      // 상태 필터
      if (selectedStatus !== 'ALL' && application.status !== selectedStatus) {
        return false
      }

      // 검색어 없음
      if (!keyword) {
        return true
      }

      const institutionName = application.institutionName.toLowerCase()

      const representativeName = application.representativeName.toLowerCase()

      const contactEmail = application.contactEmail.toLowerCase()

      return (
        institutionName.includes(keyword) ||
        representativeName.includes(keyword) ||
        contactEmail.includes(keyword)
      )
    })
  }, [applications, search, selectedStatus])

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center bg-slate-50 px-6 py-20">
        <p className="font-semibold text-slate-500">
          기관 가입 신청을 불러오는 중...
        </p>
      </main>
    )
  }

  return (
    <main className="flex flex-1 justify-center bg-slate-50 px-6 py-12">
      <div className="w-full max-w-5xl">
        <div>
          <p className="text-sm font-bold tracking-widest text-red-600">
            KOREA TRIP QUEST ADMIN
          </p>

          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                기관 가입 신청 관리
              </h1>

              <p className="mt-2 text-slate-600">
                기관 가입 신청과 처리 이력을 확인할 수 있습니다.
              </p>
            </div>

            {!error && (
              <div className="rounded-full bg-slate-200 px-4 py-2 text-sm font-bold text-slate-700">
                전체 {counts.ALL}건
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-7 rounded-2xl bg-red-50 px-5 py-4 font-semibold text-red-700">
            {error}
          </div>
        )}

        {!error && (
          <>
            {/* 상태 탭 */}
            <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <button
                  type="button"
                  onClick={() => setSelectedStatus('ALL')}
                  className={`rounded-xl px-4 py-3 text-sm font-bold transition ${
                    selectedStatus === 'ALL'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  전체 {counts.ALL}
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedStatus('PENDING')}
                  className={`rounded-xl px-4 py-3 text-sm font-bold transition ${
                    selectedStatus === 'PENDING'
                      ? 'bg-amber-500 text-white'
                      : 'text-slate-600 hover:bg-amber-50'
                  }`}
                >
                  승인 대기 {counts.PENDING}
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedStatus('APPROVED')}
                  className={`rounded-xl px-4 py-3 text-sm font-bold transition ${
                    selectedStatus === 'APPROVED'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-600 hover:bg-emerald-50'
                  }`}
                >
                  승인 완료 {counts.APPROVED}
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedStatus('REJECTED')}
                  className={`rounded-xl px-4 py-3 text-sm font-bold transition ${
                    selectedStatus === 'REJECTED'
                      ? 'bg-red-600 text-white'
                      : 'text-slate-600 hover:bg-red-50'
                  }`}
                >
                  거절 {counts.REJECTED}
                </button>
              </div>
            </section>

            {/* 검색 */}
            <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <label
                htmlFor="application-search"
                className="block text-sm font-bold text-slate-800"
              >
                기관 신청 검색
              </label>

              <div className="mt-3 flex items-center rounded-xl border border-slate-300 bg-white px-4 focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-100">
                <span className="mr-3 text-lg text-slate-400">🔍</span>

                <input
                  id="application-search"
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="기관명, 담당자명, 이메일 검색"
                  className="w-full bg-transparent py-3 text-slate-900 outline-none placeholder:text-slate-400"
                />
              </div>

              <p className="mt-3 text-sm text-slate-500">
                현재 목록{' '}
                <span className="font-bold text-slate-900">
                  {filteredApplications.length}
                </span>
                건
              </p>
            </section>

            {/* 결과 없음 */}
            {filteredApplications.length === 0 && (
              <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                <p className="font-bold text-slate-900">
                  표시할 기관 가입 신청이 없습니다.
                </p>

                <p className="mt-2 text-sm text-slate-500">
                  다른 상태 탭이나 검색어를 확인해주세요.
                </p>
              </section>
            )}

            {/* 신청 목록 */}
            {filteredApplications.length > 0 && (
              <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="hidden grid-cols-[80px_2fr_1fr_1.5fr_120px_120px_40px] gap-4 border-b border-slate-200 bg-slate-50 px-6 py-4 text-xs font-bold text-slate-500 md:grid">
                  <div>신청번호</div>
                  <div>기관명</div>
                  <div>담당자</div>
                  <div>담당자 이메일</div>
                  <div>신청일</div>
                  <div>상태</div>
                  <div />
                </div>

                <div className="divide-y divide-slate-200">
                  {filteredApplications.map((application) => (
                    <Link
                      key={application.id}
                      href={`/admin/institution-applications/${application.id}`}
                      className="block px-6 py-5 transition hover:bg-sky-50"
                    >
                      {/* PC */}
                      <div className="hidden grid-cols-[80px_2fr_1fr_1.5fr_120px_120px_40px] items-center gap-4 md:grid">
                        <div className="text-sm font-semibold text-slate-500">
                          #{application.id}
                        </div>

                        <div className="font-bold text-slate-900">
                          {application.institutionName}
                        </div>

                        <div className="text-sm font-medium text-slate-700">
                          {application.representativeName}
                        </div>

                        <div className="break-all text-sm text-slate-600">
                          {application.contactEmail}
                        </div>

                        <div className="text-sm text-slate-500">
                          {formatDate(application.createdAt)}
                        </div>

                        <div>
                          <span
                            className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${statusClass(
                              application.status,
                            )}`}
                          >
                            {statusLabel(application.status)}
                          </span>
                        </div>

                        <div className="text-right text-xl font-bold text-slate-400">
                          ›
                        </div>
                      </div>

                      {/* 모바일 */}
                      <div className="md:hidden">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-xs font-semibold text-slate-500">
                              신청번호 #{application.id}
                            </p>

                            <h2 className="mt-1 text-lg font-bold text-slate-900">
                              {application.institutionName}
                            </h2>
                          </div>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass(
                              application.status,
                            )}`}
                          >
                            {statusLabel(application.status)}
                          </span>
                        </div>

                        <div className="mt-4 grid gap-2 text-sm text-slate-600">
                          <p>
                            담당자:{' '}
                            <span className="font-semibold text-slate-800">
                              {application.representativeName}
                            </span>
                          </p>

                          <p className="break-all">
                            {application.contactEmail}
                          </p>

                          <p>신청일: {formatDate(application.createdAt)}</p>
                        </div>

                        <p className="mt-4 text-sm font-bold text-sky-600">
                          상세 검토하기 →
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        <div className="mt-8">
          <Link href="/" className="font-bold text-sky-600 hover:text-sky-700">
            ← 홈으로 돌아가기
          </Link>
        </div>
      </div>
    </main>
  )
}
