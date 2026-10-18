'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

type User = {
  id: number
  email: string
  nickname: string | null
  role: 'USER' | 'INSTITUTION' | 'ADMIN'
  status: string
  institutionId: number | null
}

type InstitutionApplicationProof = {
  id: number
  applicationId: number
  originalName: string
  mimeType: string
  fileSize: number
  createdAt: string
}

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

  /*
   * 기존 단일 증빙자료 호환용
   */
  proofFileKey?: string | null

  /*
   * 새로운 다중 증빙자료
   */
  proofs?: InstitutionApplicationProof[]

  status: 'PENDING' | 'APPROVED' | 'REJECTED'

  rejectionReason?: string | null
  reviewerId?: number | null
  reviewedAt?: string | null
  createdAt?: string
  updatedAt?: string
}

type ProofUrlResponse = {
  signedUrl?: string
  expiresIn?: number

  proof?: {
    id: number
    originalName: string
    mimeType: string
    fileSize: number
  }

  message?: string | string[]
}

function getMessage(message: string | string[] | undefined, fallback: string) {
  if (Array.isArray(message)) {
    return message.join(' ')
  }

  return message ?? fallback
}

function formatDateTime(value?: string | null) {
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
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function statusLabel(status: InstitutionApplication['status']) {
  if (status === 'APPROVED') {
    return '승인 완료'
  }

  if (status === 'REJECTED') {
    return '승인 거절'
  }

  return '검토 대기'
}

function mimeTypeLabel(mimeType: string) {
  if (mimeType === 'application/pdf') {
    return 'PDF'
  }

  if (mimeType === 'image/jpeg') {
    return 'JPG / JPEG'
  }

  if (mimeType === 'image/png') {
    return 'PNG'
  }

  return mimeType
}

export default function InstitutionApplicationDetailPage() {
  const router = useRouter()

  const params = useParams<{
    id: string
  }>()

  const applicationId = Number(params.id)

  const [application, setApplication] = useState<InstitutionApplication | null>(
    null,
  )

  const [rejectionReason, setRejectionReason] = useState('')

  const [loading, setLoading] = useState(true)

  const [processing, setProcessing] = useState<'approve' | 'reject' | null>(
    null,
  )

  const [openingProofId, setOpeningProofId] = useState<
    number | 'legacy' | null
  >(null)

  const [error, setError] = useState('')

  useEffect(() => {
    async function loadApplication() {
      if (!Number.isInteger(applicationId) || applicationId <= 0) {
        setError('올바르지 않은 신청 번호입니다.')

        setLoading(false)

        return
      }

      const accessToken = sessionStorage.getItem('accessToken')

      if (!accessToken) {
        router.replace('/login')

        return
      }

      try {
        const headers = {
          Authorization: `Bearer ${accessToken}`,
        }

        /*
         * 관리자 권한 확인
         */
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

        /*
         * 기관 가입 신청 상세 조회
         *
         * 여기서 proofs[]도 함께 받는다.
         */
        const response = await fetch(
          `http://localhost:3001/institution-applications/admin/${applicationId}`,
          {
            headers,
          },
        )

        const data = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(
            getMessage(
              data?.message,
              '기관 가입 신청 정보를 불러오지 못했습니다.',
            ),
          )
        }

        setApplication({
          ...data,

          proofs: Array.isArray(data?.proofs) ? data.proofs : [],
        })

        if (data.rejectionReason) {
          setRejectionReason(data.rejectionReason)
        }
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message)
        } else {
          setError('기관 가입 신청 정보를 불러오는 중 오류가 발생했습니다.')
        }
      } finally {
        setLoading(false)
      }
    }

    loadApplication()
  }, [applicationId, router])

  /*
   * 새로운 다중 증빙자료 열기
   */
  async function openProofFile(proofId: number) {
    if (!application) {
      return
    }

    const accessToken = sessionStorage.getItem('accessToken')

    if (!accessToken) {
      router.replace('/login')

      return
    }

    setError('')
    setOpeningProofId(proofId)

    /*
     * fetch 이후 새 창을 열면
     * 브라우저 팝업 차단이 발생할 수 있으므로
     * 클릭 즉시 빈 탭을 먼저 연다.
     */
    const proofWindow = window.open('', '_blank')

    if (!proofWindow) {
      setOpeningProofId(null)

      setError(
        '증빙자료 창을 열 수 없습니다. 브라우저의 팝업 차단 설정을 확인해주세요.',
      )

      return
    }

    proofWindow.document.title = '기관 증빙자료'

    proofWindow.document.body.innerHTML = `
        <div style="
          font-family: sans-serif;
          padding: 32px;
          color: #334155;
        ">
          증빙자료를 불러오는 중입니다...
        </div>
      `

    try {
      const response = await fetch(
        `http://localhost:3001/institution-applications/admin/${application.id}/proofs/${proofId}/url`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      )

      if (response.status === 401) {
        proofWindow.close()

        sessionStorage.removeItem('accessToken')

        sessionStorage.removeItem('user')

        router.replace('/login')

        return
      }

      const data = (await response.json().catch(() => ({}))) as ProofUrlResponse

      if (!response.ok) {
        proofWindow.close()

        setError(getMessage(data.message, '증빙자료를 열 수 없습니다.'))

        return
      }

      if (!data.signedUrl) {
        proofWindow.close()

        setError('증빙자료 열람 주소를 발급받지 못했습니다.')

        return
      }

      proofWindow.opener = null

      proofWindow.location.href = data.signedUrl
    } catch {
      proofWindow.close()

      setError('증빙자료를 불러오는 중 서버 연결 오류가 발생했습니다.')
    } finally {
      setOpeningProofId(null)
    }
  }

  /*
   * 기존 proofFileKey 방식의
   * 과거 테스트 데이터 열기
   */
  async function openLegacyProofFile() {
    if (!application) {
      return
    }

    const accessToken = sessionStorage.getItem('accessToken')

    if (!accessToken) {
      router.replace('/login')

      return
    }

    setError('')
    setOpeningProofId('legacy')

    const proofWindow = window.open('', '_blank')

    if (!proofWindow) {
      setOpeningProofId(null)

      setError(
        '증빙자료 창을 열 수 없습니다. 브라우저의 팝업 차단 설정을 확인해주세요.',
      )

      return
    }

    proofWindow.document.title = '기관 증빙자료'

    proofWindow.document.body.innerHTML = `
        <div style="
          font-family: sans-serif;
          padding: 32px;
          color: #334155;
        ">
          증빙자료를 불러오는 중입니다...
        </div>
      `

    try {
      const response = await fetch(
        `http://localhost:3001/institution-applications/admin/${application.id}/proof-url`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      )

      const data = (await response.json().catch(() => ({}))) as ProofUrlResponse

      if (!response.ok) {
        proofWindow.close()

        setError(getMessage(data.message, '기존 증빙자료를 열 수 없습니다.'))

        return
      }

      if (!data.signedUrl) {
        proofWindow.close()

        setError('증빙자료 열람 주소를 발급받지 못했습니다.')

        return
      }

      proofWindow.opener = null

      proofWindow.location.href = data.signedUrl
    } catch {
      proofWindow.close()

      setError('증빙자료를 불러오는 중 서버 연결 오류가 발생했습니다.')
    } finally {
      setOpeningProofId(null)
    }
  }

  async function approveApplication() {
    if (!application) {
      return
    }

    const confirmed = window.confirm(
      `${application.institutionName}의 기관 가입 신청을 승인하시겠습니까?`,
    )

    if (!confirmed) {
      return
    }

    const accessToken = sessionStorage.getItem('accessToken')

    if (!accessToken) {
      router.replace('/login')

      return
    }

    setError('')

    setProcessing('approve')

    try {
      const response = await fetch(
        `http://localhost:3001/institution-applications/${application.id}/approve`,
        {
          method: 'POST',

          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      )

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        setError(getMessage(data?.message, '기관 가입 승인에 실패했습니다.'))

        return
      }

      window.alert('기관 가입 신청을 승인했습니다.')

      router.push('/admin/institution-applications')

      router.refresh()
    } catch {
      setError('서버에 연결할 수 없습니다.')
    } finally {
      setProcessing(null)
    }
  }

  async function rejectApplication() {
    if (!application) {
      return
    }

    const reason = rejectionReason.trim()

    if (reason.length < 2) {
      setError('거절 사유를 2자 이상 입력해주세요.')

      return
    }

    const confirmed = window.confirm(
      `${application.institutionName}의 기관 가입 신청을 거절하시겠습니까?`,
    )

    if (!confirmed) {
      return
    }

    const accessToken = sessionStorage.getItem('accessToken')

    if (!accessToken) {
      router.replace('/login')

      return
    }

    setError('')

    setProcessing('reject')

    try {
      const response = await fetch(
        `http://localhost:3001/institution-applications/${application.id}/reject`,
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',

            Authorization: `Bearer ${accessToken}`,
          },

          body: JSON.stringify({
            reason,
          }),
        },
      )

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        setError(getMessage(data?.message, '기관 가입 거절에 실패했습니다.'))

        return
      }

      window.alert('기관 가입 신청을 거절했습니다.')

      router.push('/admin/institution-applications')

      router.refresh()
    } catch {
      setError('서버에 연결할 수 없습니다.')
    } finally {
      setProcessing(null)
    }
  }

  const proofs = application?.proofs ?? []

  const totalProofSize = proofs.reduce(
    (total, proof) => total + proof.fileSize,
    0,
  )

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center bg-slate-50 px-6 py-20">
        <p className="font-semibold text-slate-500">
          기관 가입 신청 정보를 불러오는 중...
        </p>
      </main>
    )
  }

  if (error && !application) {
    return (
      <main className="flex flex-1 justify-center bg-slate-50 px-6 py-12">
        <div className="w-full max-w-3xl">
          <div className="rounded-3xl border border-red-200 bg-white p-8 shadow-sm">
            <h1 className="text-xl font-bold text-slate-900">
              신청 정보를 불러올 수 없습니다.
            </h1>

            <p className="mt-3 text-red-600">{error}</p>

            <Link
              href="/admin/institution-applications"
              className="mt-6 inline-block font-bold text-sky-600"
            >
              ← 기관 가입 신청 목록으로 돌아가기
            </Link>
          </div>
        </div>
      </main>
    )
  }

  if (!application) {
    return null
  }

  return (
    <main className="flex flex-1 justify-center bg-slate-50 px-6 py-12">
      <div className="w-full max-w-4xl">
        <Link
          href="/admin/institution-applications"
          className="font-bold text-sky-600 hover:text-sky-700"
        >
          ← 기관 가입 신청 목록
        </Link>

        <div className="mt-7">
          <p className="text-sm font-bold tracking-widest text-red-600">
            KOREA TRIP QUEST ADMIN
          </p>

          <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-500">
                신청 번호 #{application.id}
              </p>

              <h1 className="mt-1 text-3xl font-bold text-slate-900">
                {application.institutionName}
              </h1>

              <p className="mt-2 text-slate-600">
                기관 정보와 증빙자료를 확인한 후 가입 신청을 승인하거나 거절할
                수 있습니다.
              </p>
            </div>

            <span
              className={`rounded-full px-4 py-2 text-sm font-bold ${
                application.status === 'APPROVED'
                  ? 'bg-emerald-100 text-emerald-700'
                  : application.status === 'REJECTED'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-amber-100 text-amber-800'
              }`}
            >
              {statusLabel(application.status)}
            </span>
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        {/* 신청 정보 */}
        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">신청 정보</h2>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-bold text-slate-500">기관명</p>

              <p className="mt-1 font-semibold text-slate-900">
                {application.institutionName}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-bold text-slate-500">담당자</p>

              <p className="mt-1 font-semibold text-slate-900">
                {application.representativeName}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-bold text-slate-500">담당자 이메일</p>

              <p className="mt-1 break-all font-semibold text-slate-900">
                {application.contactEmail}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-bold text-slate-500">연락처</p>

              <p className="mt-1 font-semibold text-slate-900">
                {application.contactPhone ?? '-'}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-4 md:col-span-2">
              <p className="text-xs font-bold text-slate-500">기관 주소</p>

              <p className="mt-1 font-semibold text-slate-900">
                {application.address ?? '-'}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-4 md:col-span-2">
              <p className="text-xs font-bold text-slate-500">공식 웹사이트</p>

              {application.website ? (
                <a
                  href={application.website}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block break-all font-semibold text-sky-600 hover:underline"
                >
                  {application.website}
                </a>
              ) : (
                <p className="mt-1 font-semibold text-slate-900">-</p>
              )}
            </div>
          </div>
        </section>

        {/* 기관 설명 */}
        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">기관 설명</h2>

          <p className="mt-4 whitespace-pre-wrap leading-7 text-slate-700">
            {application.description || '등록된 기관 설명이 없습니다.'}
          </p>
        </section>

        {/* 기관 증빙자료 */}
        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                기관 증빙자료
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                등록 파일 {proofs.length}개
                {proofs.length > 0 && ` · 총 ${formatFileSize(totalProofSize)}`}
              </p>
            </div>

            <span className="rounded-full bg-violet-100 px-3 py-2 text-xs font-bold text-violet-700">
              Private Storage
            </span>
          </div>

          {proofs.length > 0 ? (
            <div className="mt-6 space-y-3">
              {proofs.map((proof, index) => (
                <div
                  key={proof.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-bold text-slate-600">
                          #{index + 1}
                        </span>

                        <span className="rounded-full bg-violet-100 px-2 py-1 text-xs font-bold text-violet-700">
                          {mimeTypeLabel(proof.mimeType)}
                        </span>
                      </div>

                      <p className="mt-3 break-all font-bold text-slate-900">
                        {proof.originalName}
                      </p>

                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                        <span>크기: {formatFileSize(proof.fileSize)}</span>

                        <span>등록: {formatDateTime(proof.createdAt)}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => openProofFile(proof.id)}
                      disabled={openingProofId !== null}
                      className="rounded-xl bg-violet-600 px-5 py-3 font-bold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {openingProofId === proof.id
                        ? '여는 중...'
                        : '증빙자료 열기'}
                    </button>
                  </div>
                </div>
              ))}

              <div className="rounded-xl bg-violet-50 px-4 py-3 text-xs font-semibold leading-6 text-violet-700">
                각 증빙자료는 관리자 인증 후 열람할 수 있으며, 발급된 열람
                주소는 40분 동안 유효합니다.
              </div>
            </div>
          ) : application.proofFileKey ? (
            /*
             * 기존 단일 증빙자료 호환
             */
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex flex-wrap items-center justify-between gap-5">
                <div>
                  <p className="font-bold text-amber-900">
                    기존 방식으로 등록된 증빙자료가 있습니다.
                  </p>

                  <p className="mt-2 text-sm leading-6 text-amber-800">
                    다중 증빙자료 기능 도입 전에 등록된 신청입니다.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={openLegacyProofFile}
                  disabled={openingProofId !== null}
                  className="rounded-xl bg-amber-600 px-5 py-3 font-bold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {openingProofId === 'legacy'
                    ? '여는 중...'
                    : '기존 증빙자료 열기'}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5">
              <p className="font-semibold text-slate-700">
                등록된 증빙자료가 없습니다.
              </p>
            </div>
          )}
        </section>

        {/* 처리 정보 */}
        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">처리 정보</h2>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-bold text-slate-500">신청일</p>

              <p className="mt-1 font-medium text-slate-900">
                {formatDateTime(application.createdAt)}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-bold text-slate-500">현재 상태</p>

              <p className="mt-1 font-medium text-slate-900">
                {statusLabel(application.status)}
              </p>
            </div>
          </div>
        </section>

        {/* 승인 / 거절 */}
        {application.status === 'PENDING' && (
          <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">신청 처리</h2>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              기관 정보와 증빙자료를 확인한 뒤 승인 또는 거절해주세요. 승인하면
              신청자의 권한이 INSTITUTION으로 변경되고 해당 기관과 연결됩니다.
            </p>

            <button
              type="button"
              onClick={approveApplication}
              disabled={processing !== null}
              className="mt-6 w-full rounded-xl bg-emerald-600 px-5 py-4 font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {processing === 'approve' ? '승인 처리 중...' : '기관 가입 승인'}
            </button>

            <div className="my-7 border-t border-slate-200" />

            <label
              htmlFor="rejection-reason"
              className="block text-sm font-bold text-slate-800"
            >
              거절 사유
            </label>

            <textarea
              id="rejection-reason"
              value={rejectionReason}
              onChange={(event) => setRejectionReason(event.target.value)}
              rows={4}
              maxLength={1000}
              placeholder="거절하는 경우 신청자에게 보여줄 사유를 입력해주세요."
              className="mt-2 w-full resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none placeholder:text-slate-400 focus:border-red-500 focus:ring-2 focus:ring-red-100"
            />

            <button
              type="button"
              onClick={rejectApplication}
              disabled={processing !== null}
              className="mt-4 w-full rounded-xl bg-red-600 px-5 py-4 font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {processing === 'reject' ? '거절 처리 중...' : '기관 가입 거절'}
            </button>
          </section>
        )}

        {/* 처리 완료 */}
        {application.status !== 'PENDING' && (
          <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">처리 완료</h2>

            <p className="mt-3 text-slate-600">
              이 기관 가입 신청은 이미{' '}
              <strong>{statusLabel(application.status)}</strong> 상태입니다.
            </p>

            {application.rejectionReason && (
              <div className="mt-5 rounded-xl bg-red-50 p-4">
                <p className="text-xs font-bold text-red-700">거절 사유</p>

                <p className="mt-2 text-sm text-slate-700">
                  {application.rejectionReason}
                </p>
              </div>
            )}

            {application.reviewedAt && (
              <p className="mt-4 text-sm text-slate-500">
                처리 시각: {formatDateTime(application.reviewedAt)}
              </p>
            )}
          </section>
        )}
      </div>
    </main>
  )
}
