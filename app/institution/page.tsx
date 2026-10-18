'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

type User = {
  id: number
  email: string
  nickname: string | null
  role: 'USER' | 'INSTITUTION' | 'ADMIN'
  status: string
  institutionId: number | null
}

type InstitutionApplication = {
  id: number
  institutionName: string
  representativeName: string
  contactEmail: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
}

export default function InstitutionPage() {
  const router = useRouter()

  const [user, setUser] = useState<User | null>(null)

  const [institutionName, setInstitutionName] = useState('')

  const [loading, setLoading] = useState(true)

  const [error, setError] = useState('')

  useEffect(() => {
    async function loadInstitutionPage() {
      const accessToken = sessionStorage.getItem('accessToken')

      if (!accessToken) {
        router.replace('/login')
        return
      }

      try {
        const headers = {
          Authorization: `Bearer ${accessToken}`,
        }

        // 현재 로그인 계정 확인
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
          throw new Error('계정 정보를 확인할 수 없습니다.')
        }

        const meData = await meResponse.json()

        const currentUser: User = meData.user ?? meData

        if (currentUser.role !== 'INSTITUTION') {
          setError('기관 계정만 접근할 수 있는 페이지입니다.')

          return
        }

        if (currentUser.institutionId === null) {
          setError('연결된 기관 정보를 확인할 수 없습니다.')

          return
        }

        setUser(currentUser)

        sessionStorage.setItem('user', JSON.stringify(currentUser))

        // 승인된 기관 신청에서 기관명 확인
        const applicationResponse = await fetch(
          'http://localhost:3001/institution-applications/me',
          {
            headers,
          },
        )

        if (!applicationResponse.ok) {
          throw new Error('기관 정보를 불러오지 못했습니다.')
        }

        const applicationData = await applicationResponse.json()

        if (Array.isArray(applicationData)) {
          const approvedApplications = applicationData
            .filter(
              (application: InstitutionApplication) =>
                application.status === 'APPROVED',
            )
            .sort(
              (a: InstitutionApplication, b: InstitutionApplication) =>
                b.id - a.id,
            )

          if (approvedApplications.length > 0) {
            setInstitutionName(approvedApplications[0].institutionName)
          } else {
            setInstitutionName('승인된 기관')
          }
        }
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message)
        } else {
          setError('기관 정보를 불러오는 중 오류가 발생했습니다.')
        }
      } finally {
        setLoading(false)
      }
    }

    loadInstitutionPage()
  }, [router])

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center bg-slate-50 px-6 py-20">
        <p className="font-semibold text-slate-500">
          기관 관리 정보를 불러오는 중...
        </p>
      </main>
    )
  }

  if (error) {
    return (
      <main className="flex flex-1 items-center justify-center bg-slate-50 px-6 py-20">
        <div className="w-full max-w-xl rounded-3xl border border-red-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">
            기관 관리 페이지에 접근할 수 없습니다.
          </h1>

          <p className="mt-3 text-red-600">{error}</p>

          <Link href="/" className="mt-6 inline-block font-bold text-sky-600">
            ← 홈으로 돌아가기
          </Link>
        </div>
      </main>
    )
  }

  if (!user) {
    return null
  }

  return (
    <main className="flex flex-1 justify-center bg-slate-50 px-6 py-12">
      <div className="w-full max-w-5xl">
        {/* 제목 */}
        <div>
          <p className="text-sm font-bold tracking-widest text-violet-600">
            KOREA TRIP QUEST
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-900">기관 관리</h1>

          <p className="mt-2 text-slate-600">
            기관에서 운영하는 여행 Challenge를 관리할 수 있습니다.
          </p>
        </div>

        {/* 기관 정보 */}
        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-500">기관</p>

              <h2 className="mt-1 text-2xl font-bold text-slate-900">
                {institutionName}
              </h2>

              <p className="mt-3 text-sm font-semibold text-slate-700">
                {user.nickname ?? user.email}님
              </p>

              <p className="mt-1 text-sm text-slate-500">{user.email}</p>
            </div>

            <span className="rounded-full bg-violet-100 px-4 py-2 text-sm font-bold text-violet-700">
              기관 계정
            </span>
          </div>
        </section>

        {/* 기관 운영 */}
        <section className="mt-8">
          <h2 className="text-xl font-bold text-slate-900">기관 운영</h2>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            {/* Challenge 관리 */}
            <Link
              href="/institution/challenges"
              className="group rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition hover:border-sky-300 hover:bg-sky-50"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-100 text-2xl">
                🗺️
              </div>

              <h3 className="mt-5 text-xl font-bold text-slate-900 group-hover:text-sky-700">
                Challenge 관리
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                새로운 Challenge를 만들거나 기존 Challenge의 제목, 설명,
                Mission, 장소, 사진, QR 등을 관리합니다.
              </p>

              <p className="mt-6 font-bold text-sky-600">Challenge 관리 →</p>
            </Link>

            {/* My */}
            <Link
              href="/my"
              className="group rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-2xl">
                👤
              </div>

              <h3 className="mt-5 text-xl font-bold text-slate-900">내 계정</h3>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                내 계정 정보와 기관 가입 승인 상태를 확인합니다.
              </p>

              <p className="mt-6 font-bold text-slate-700">My로 이동 →</p>
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
