'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  ChangeEvent,
  FormEvent,
  MouseEvent as ReactMouseEvent,
  useEffect,
  useState,
} from 'react'

const MAX_COVER_IMAGE_SIZE = 10 * 1024 * 1024

const ALLOWED_COVER_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
])

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

  coverPositionX: number
  coverPositionY: number

  institutionId: number
  createdAt: string
  updatedAt: string
}

type ChallengeDetailResponse = {
  challenge: Challenge
}

export default function EditInstitutionChallengePage() {
  const router = useRouter()

  const params = useParams()

  const challengeId = Array.isArray(params.id) ? params.id[0] : params.id

  const [challenge, setChallenge] = useState<Challenge | null>(null)

  const [title, setTitle] = useState('')

  const [description, setDescription] = useState('')

  const [region, setRegion] = useState('')

  const [startAt, setStartAt] = useState('')

  const [endAt, setEndAt] = useState('')

  const [selectedCoverImage, setSelectedCoverImage] = useState<File | null>(
    null,
  )

  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null)

  /*
   * 대표사진 초점 위치
   */
  const [coverPositionX, setCoverPositionX] = useState(50)

  const [coverPositionY, setCoverPositionY] = useState(50)

  const [loading, setLoading] = useState(true)

  const [saving, setSaving] = useState(false)

  const [coverSaving, setCoverSaving] = useState(false)

  const [coverDeleting, setCoverDeleting] = useState(false)

  const [coverPositionSaving, setCoverPositionSaving] = useState(false)

  const [error, setError] = useState('')

  const [saveError, setSaveError] = useState('')

  const [coverError, setCoverError] = useState('')

  const [coverMessage, setCoverMessage] = useState('')

  useEffect(() => {
    async function loadChallenge() {
      if (!challengeId) {
        setError('Challenge 정보를 확인할 수 없습니다.')

        setLoading(false)
        return
      }

      const accessToken = sessionStorage.getItem('accessToken')

      if (!accessToken) {
        router.replace('/login')
        return
      }

      try {
        const response = await fetch(
          `http://localhost:3001/challenges/institution/${challengeId}`,
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

          throw new Error(message ?? 'Challenge 정보를 불러오지 못했습니다.')
        }

        const challengeData = (data as ChallengeDetailResponse).challenge

        setChallenge(challengeData)

        setTitle(challengeData.title)

        setDescription(challengeData.description ?? '')

        setRegion(challengeData.region ?? '')

        setStartAt(toDateTimeLocal(challengeData.startAt))

        setEndAt(toDateTimeLocal(challengeData.endAt))

        setCoverPositionX(challengeData.coverPositionX ?? 50)

        setCoverPositionY(challengeData.coverPositionY ?? 50)
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message)
        } else {
          setError('Challenge 정보를 불러오는 중 오류가 발생했습니다.')
        }
      } finally {
        setLoading(false)
      }
    }

    loadChallenge()
  }, [challengeId, router])

  /*
   * 선택한 로컬 이미지의 미리보기 URL 정리
   */
  useEffect(() => {
    return () => {
      if (coverPreviewUrl) {
        URL.revokeObjectURL(coverPreviewUrl)
      }
    }
  }, [coverPreviewUrl])

  function handleUnauthorized() {
    sessionStorage.removeItem('accessToken')

    sessionStorage.removeItem('user')

    router.replace('/login')
  }

  function getAccessToken() {
    const accessToken = sessionStorage.getItem('accessToken')

    if (!accessToken) {
      router.replace('/login')
      return null
    }

    return accessToken
  }

  /*
   * 사진 미리보기 클릭 위치를
   * 0 ~ 100 범위의 초점 좌표로 변환한다.
   */
  function handleCoverFocusClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (!challenge) {
      return
    }

    const coverEditable =
      challenge.status === 'DRAFT' ||
      challenge.status === 'ACTIVE' ||
      challenge.status === 'PAUSED'

    if (!coverEditable) {
      return
    }

    const rect = event.currentTarget.getBoundingClientRect()

    if (rect.width <= 0 || rect.height <= 0) {
      return
    }

    const rawX = ((event.clientX - rect.left) / rect.width) * 100

    const rawY = ((event.clientY - rect.top) / rect.height) * 100

    const nextX = Math.min(100, Math.max(0, rawX))

    const nextY = Math.min(100, Math.max(0, rawY))

    setCoverPositionX(Number(nextX.toFixed(2)))

    setCoverPositionY(Number(nextY.toFixed(2)))

    setCoverError('')

    setCoverMessage('')
  }

  function resetCoverFocus() {
    setCoverPositionX(50)

    setCoverPositionY(50)

    setCoverError('')

    setCoverMessage('')
  }

  function handleCoverImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    setCoverError('')
    setCoverMessage('')

    if (!file) {
      return
    }

    /*
     * 프론트 1차 검사.
     *
     * 실제 MIME / 파일 시그니처 검사는
     * 서버에서 다시 수행한다.
     */
    if (!ALLOWED_COVER_IMAGE_TYPES.has(file.type)) {
      event.target.value = ''

      setSelectedCoverImage(null)
      setCoverPreviewUrl(null)

      setCoverError(
        '대표사진은 JPG, JPEG, PNG, WEBP 파일만 선택할 수 있습니다.',
      )

      return
    }

    if (file.size <= 0) {
      event.target.value = ''

      setSelectedCoverImage(null)
      setCoverPreviewUrl(null)

      setCoverError('비어 있는 이미지는 선택할 수 없습니다.')

      return
    }

    if (file.size > MAX_COVER_IMAGE_SIZE) {
      event.target.value = ''

      setSelectedCoverImage(null)
      setCoverPreviewUrl(null)

      setCoverError('Challenge 대표사진은 최대 10MB까지 등록할 수 있습니다.')

      return
    }

    if (coverPreviewUrl) {
      URL.revokeObjectURL(coverPreviewUrl)
    }

    const previewUrl = URL.createObjectURL(file)

    setSelectedCoverImage(file)

    setCoverPreviewUrl(previewUrl)

    /*
     * 새 사진을 선택하면
     * 초점을 중앙으로 초기화한다.
     */
    setCoverPositionX(50)

    setCoverPositionY(50)
  }

  function handleCancelCoverSelection() {
    if (coverPreviewUrl) {
      URL.revokeObjectURL(coverPreviewUrl)
    }

    setSelectedCoverImage(null)

    setCoverPreviewUrl(null)

    /*
     * 새 사진 선택을 취소하면
     * 기존 저장된 사진의 초점으로 되돌린다.
     */
    setCoverPositionX(challenge?.coverPositionX ?? 50)

    setCoverPositionY(challenge?.coverPositionY ?? 50)

    setCoverError('')

    setCoverMessage('')

    const input = document.getElementById(
      'coverImage',
    ) as HTMLInputElement | null

    if (input) {
      input.value = ''
    }
  }

  /*
   * 대표사진 초점 위치만 저장한다.
   *
   * 사진 파일은 변경하지 않는다.
   */
  async function handleSaveCoverPosition() {
    if (!challenge || !challengeId) {
      return
    }

    if (!challenge.hasCoverImage) {
      setCoverError('초점을 설정할 대표사진이 없습니다.')

      return
    }

    if (selectedCoverImage) {
      setCoverError(
        '새 대표사진을 선택한 경우 대표사진 등록 또는 교체 버튼을 눌러주세요. 사진과 초점이 함께 저장됩니다.',
      )

      return
    }

    const coverEditable =
      challenge.status === 'DRAFT' ||
      challenge.status === 'ACTIVE' ||
      challenge.status === 'PAUSED'

    if (!coverEditable) {
      setCoverError(
        '종료되거나 보관된 Challenge의 대표사진 초점은 변경할 수 없습니다.',
      )

      return
    }

    const accessToken = getAccessToken()

    if (!accessToken) {
      return
    }

    setCoverPositionSaving(true)

    setCoverError('')

    setCoverMessage('')

    try {
      const response = await fetch(
        `http://localhost:3001/challenges/${challengeId}`,
        {
          method: 'PATCH',

          headers: {
            'Content-Type': 'application/json',

            Authorization: `Bearer ${accessToken}`,
          },

          body: JSON.stringify({
            coverPositionX,
            coverPositionY,
          }),
        },
      )

      if (response.status === 401) {
        handleUnauthorized()
        return
      }

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        const message = Array.isArray(data?.message)
          ? data.message.join(', ')
          : data?.message

        throw new Error(
          message ?? 'Challenge 대표사진 초점 저장에 실패했습니다.',
        )
      }

      if (data?.challenge) {
        setChallenge(data.challenge)

        setCoverPositionX(data.challenge.coverPositionX ?? 50)

        setCoverPositionY(data.challenge.coverPositionY ?? 50)
      }

      setCoverMessage('Challenge 대표사진 초점이 저장되었습니다.')
    } catch (err) {
      if (err instanceof Error) {
        setCoverError(err.message)
      } else {
        setCoverError('Challenge 대표사진 초점 저장 중 오류가 발생했습니다.')
      }
    } finally {
      setCoverPositionSaving(false)
    }
  }

  /*
   * 새 대표사진 등록 또는 기존 사진 교체
   *
   * 기존 사진 업로드 API는 그대로 사용한다.
   *
   * 사진 업로드가 성공하면
   * 현재 선택한 초점도 PATCH API로 저장한다.
   */
  async function handleSaveCoverImage() {
    if (!challenge || !challengeId || !selectedCoverImage) {
      setCoverError('등록할 대표사진을 선택해주세요.')

      return
    }

    const coverEditable =
      challenge.status === 'DRAFT' ||
      challenge.status === 'ACTIVE' ||
      challenge.status === 'PAUSED'

    if (!coverEditable) {
      setCoverError(
        '종료되거나 보관된 Challenge의 대표사진은 변경할 수 없습니다.',
      )

      return
    }

    const accessToken = getAccessToken()

    if (!accessToken) {
      return
    }

    setCoverSaving(true)

    setCoverError('')

    setCoverMessage('')

    try {
      const formData = new FormData()

      formData.append('coverImage', selectedCoverImage)

      /*
       * 기존 대표사진 업로드/교체 API
       */
      const response = await fetch(
        `http://localhost:3001/challenges/${challengeId}/cover`,
        {
          method: 'POST',

          headers: {
            Authorization: `Bearer ${accessToken}`,
          },

          body: formData,
        },
      )

      if (response.status === 401) {
        handleUnauthorized()
        return
      }

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        const message = Array.isArray(data?.message)
          ? data.message.join(', ')
          : data?.message

        throw new Error(message ?? 'Challenge 대표사진 저장에 실패했습니다.')
      }

      /*
       * 사진 저장 자체는 이미 성공했다.
       *
       * 먼저 새 사진 상태를 화면에 반영한다.
       */
      if (data?.challenge) {
        setChallenge(data.challenge)
      }

      if (coverPreviewUrl) {
        URL.revokeObjectURL(coverPreviewUrl)
      }

      setSelectedCoverImage(null)

      setCoverPreviewUrl(null)

      const input = document.getElementById(
        'coverImage',
      ) as HTMLInputElement | null

      if (input) {
        input.value = ''
      }

      /*
       * 새 대표사진에 대해 사용자가 설정한
       * 초점 위치도 이어서 저장한다.
       */
      const positionResponse = await fetch(
        `http://localhost:3001/challenges/${challengeId}`,
        {
          method: 'PATCH',

          headers: {
            'Content-Type': 'application/json',

            Authorization: `Bearer ${accessToken}`,
          },

          body: JSON.stringify({
            coverPositionX,
            coverPositionY,
          }),
        },
      )

      if (positionResponse.status === 401) {
        handleUnauthorized()
        return
      }

      const positionData = await positionResponse.json().catch(() => null)

      if (!positionResponse.ok) {
        const message = Array.isArray(positionData?.message)
          ? positionData.message.join(', ')
          : positionData?.message

        setCoverMessage(
          data?.message ?? 'Challenge 대표사진은 정상적으로 저장되었습니다.',
        )

        setCoverError(
          message
            ? `대표사진은 저장되었지만 초점 저장에 실패했습니다. ${message}`
            : '대표사진은 저장되었지만 초점 저장에 실패했습니다. 사진을 다시 선택할 필요 없이 초점만 다시 저장해주세요.',
        )

        return
      }

      if (positionData?.challenge) {
        setChallenge(positionData.challenge)

        setCoverPositionX(positionData.challenge.coverPositionX ?? 50)

        setCoverPositionY(positionData.challenge.coverPositionY ?? 50)
      }

      setCoverMessage(
        challenge.hasCoverImage
          ? 'Challenge 대표사진과 초점이 교체되었습니다.'
          : 'Challenge 대표사진과 초점이 등록되었습니다.',
      )
    } catch (err) {
      if (err instanceof Error) {
        setCoverError(err.message)
      } else {
        setCoverError('Challenge 대표사진 저장 중 오류가 발생했습니다.')
      }
    } finally {
      setCoverSaving(false)
    }
  }

  /*
   * 현재 등록된 대표사진 삭제
   */
  async function handleDeleteCoverImage() {
    if (!challenge || !challengeId) {
      return
    }

    if (!challenge.hasCoverImage) {
      setCoverError('삭제할 대표사진이 없습니다.')

      return
    }

    const coverEditable =
      challenge.status === 'DRAFT' ||
      challenge.status === 'ACTIVE' ||
      challenge.status === 'PAUSED'

    if (!coverEditable) {
      setCoverError(
        '종료되거나 보관된 Challenge의 대표사진은 삭제할 수 없습니다.',
      )

      return
    }

    const confirmed = window.confirm(
      '현재 등록된 Challenge 대표사진을 삭제하시겠습니까?',
    )

    if (!confirmed) {
      return
    }

    const accessToken = getAccessToken()

    if (!accessToken) {
      return
    }

    setCoverDeleting(true)

    setCoverError('')

    setCoverMessage('')

    try {
      const response = await fetch(
        `http://localhost:3001/challenges/${challengeId}/cover`,
        {
          method: 'DELETE',

          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      )

      if (response.status === 401) {
        handleUnauthorized()
        return
      }

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        const message = Array.isArray(data?.message)
          ? data.message.join(', ')
          : data?.message

        throw new Error(message ?? 'Challenge 대표사진 삭제에 실패했습니다.')
      }

      if (data?.challenge) {
        setChallenge(data.challenge)
      }

      if (coverPreviewUrl) {
        URL.revokeObjectURL(coverPreviewUrl)
      }

      setSelectedCoverImage(null)

      setCoverPreviewUrl(null)

      setCoverPositionX(50)

      setCoverPositionY(50)

      const input = document.getElementById(
        'coverImage',
      ) as HTMLInputElement | null

      if (input) {
        input.value = ''
      }

      setCoverMessage(data?.message ?? 'Challenge 대표사진이 삭제되었습니다.')
    } catch (err) {
      if (err instanceof Error) {
        setCoverError(err.message)
      } else {
        setCoverError('Challenge 대표사진 삭제 중 오류가 발생했습니다.')
      }
    } finally {
      setCoverDeleting(false)
    }
  }

  /*
   * 기본 정보 저장
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!challenge || !challengeId) {
      return
    }

    const challengeEditable =
      challenge.status === 'DRAFT' ||
      challenge.status === 'ACTIVE' ||
      challenge.status === 'PAUSED'

    if (!challengeEditable) {
      setSaveError('종료되거나 보관된 Challenge는 수정할 수 없습니다.')

      return
    }

    const trimmedTitle = title.trim()

    if (trimmedTitle.length < 2) {
      setSaveError('Challenge 제목은 최소 2자 이상 입력해주세요.')

      return
    }

    const datesEditable =
      challenge.status === 'DRAFT' || challenge.status === 'PAUSED'

    if (
      datesEditable &&
      startAt &&
      endAt &&
      new Date(startAt) >= new Date(endAt)
    ) {
      setSaveError('운영 종료 일시는 운영 시작 일시보다 이후여야 합니다.')

      return
    }

    if (
      challenge.status === 'PAUSED' &&
      endAt &&
      new Date(endAt) <= new Date()
    ) {
      setSaveError(
        '운영을 다시 시작하려면 운영 종료 일시는 현재보다 이후여야 합니다.',
      )

      return
    }

    const accessToken = getAccessToken()

    if (!accessToken) {
      return
    }

    setSaving(true)

    setSaveError('')

    try {
      const body: {
        title: string
        description: string | null
        region: string | null
        startAt?: string | null
        endAt?: string | null
      } = {
        title: trimmedTitle,

        description: description.trim() || null,

        region: region.trim() || null,
      }

      /*
       * DRAFT와 PAUSED에서만
       * 운영기간을 서버로 전송한다.
       *
       * ACTIVE에서는 기간 필드를
       * 전송하지 않는다.
       */
      if (datesEditable) {
        body.startAt = startAt ? new Date(startAt).toISOString() : null

        body.endAt = endAt ? new Date(endAt).toISOString() : null
      }

      const response = await fetch(
        `http://localhost:3001/challenges/${challengeId}`,
        {
          method: 'PATCH',

          headers: {
            'Content-Type': 'application/json',

            Authorization: `Bearer ${accessToken}`,
          },

          body: JSON.stringify(body),
        },
      )

      if (response.status === 401) {
        handleUnauthorized()
        return
      }

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        const message = Array.isArray(data?.message)
          ? data.message.join(', ')
          : data?.message

        throw new Error(message ?? 'Challenge 수정에 실패했습니다.')
      }

      router.push(`/institution/challenges/${challengeId}`)
    } catch (err) {
      if (err instanceof Error) {
        setSaveError(err.message)
      } else {
        setSaveError('Challenge 수정 중 오류가 발생했습니다.')
      }
    } finally {
      setSaving(false)
    }
  }

  function getStatusLabel(status: ChallengeStatus) {
    switch (status) {
      case 'DRAFT':
        return '준비 중'

      case 'ACTIVE':
        return '운영 중'

      case 'PAUSED':
        return '운영 중단'

      case 'ENDED':
        return '운영 종료'

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

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <p className="font-semibold text-slate-500">
          Challenge 정보를 불러오는 중...
        </p>
      </main>
    )
  }

  if (error || !challenge) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="w-full max-w-xl rounded-3xl border border-red-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">
            Challenge를 수정할 수 없습니다.
          </h1>

          <p className="mt-3 text-red-600">
            {error || 'Challenge 정보를 확인할 수 없습니다.'}
          </p>

          <Link
            href="/institution/challenges"
            className="mt-6 inline-block font-bold text-sky-600"
          >
            ← Challenge 관리로 돌아가기
          </Link>
        </div>
      </main>
    )
  }

  const challengeEditable =
    challenge.status === 'DRAFT' ||
    challenge.status === 'ACTIVE' ||
    challenge.status === 'PAUSED'

  const datesEditable =
    challenge.status === 'DRAFT' || challenge.status === 'PAUSED'

  const coverEditable =
    challenge.status === 'DRAFT' ||
    challenge.status === 'ACTIVE' ||
    challenge.status === 'PAUSED'

  const coverBusy =
    coverSaving || coverDeleting || coverPositionSaving || saving

  const displayedCoverImageUrl = coverPreviewUrl ?? challenge.coverImageUrl

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">
      <div className="mx-auto w-full max-w-3xl">
        <Link
          href={`/institution/challenges/${challenge.id}`}
          className="text-sm font-bold text-slate-500 transition hover:text-slate-800"
        >
          ← Challenge 상세로 돌아가기
        </Link>

        <div className="mt-6">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-bold tracking-widest text-sky-600">
              EDIT CHALLENGE
            </p>

            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${getStatusStyle(
                challenge.status,
              )}`}
            >
              {getStatusLabel(challenge.status)}
            </span>
          </div>

          <h1 className="mt-3 text-3xl font-bold text-slate-900">
            Challenge 기본 정보 수정
          </h1>

          <p className="mt-2 leading-7 text-slate-600">
            Challenge 대표사진, 표시 초점, 제목, 설명, 지역 및 운영 일시를
            관리합니다.
          </p>
        </div>

        {challenge.status === 'ACTIVE' && (
          <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <p className="font-bold text-emerald-700">
              현재 운영 중인 Challenge입니다.
            </p>

            <p className="mt-2 text-sm leading-6 text-emerald-700">
              제목, 설명, 지역, 대표사진과 대표사진 초점은 수정할 수 있지만 운영
              시작 및 종료 일시는 변경할 수 없습니다. 운영기간을 변경하려면 먼저
              Challenge 운영을 중단해주세요.
            </p>
          </div>
        )}

        {challenge.status === 'PAUSED' && (
          <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="font-bold text-amber-800">
              Challenge 운영이 일시 중단되어 있습니다.
            </p>

            <p className="mt-2 text-sm leading-6 text-amber-700">
              운영 중단 상태에서는 대표사진과 운영기간을 포함한 기본 정보를
              수정할 수 있습니다. 수정이 끝나면 Challenge 상세 화면에서 다시
              운영할 수 있습니다.
            </p>
          </div>
        )}

        {(challenge.status === 'ENDED' || challenge.status === 'ARCHIVED') && (
          <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5">
            <p className="font-bold text-red-700">
              이 Challenge는 수정할 수 없습니다.
            </p>

            <p className="mt-2 text-sm leading-6 text-red-700">
              최종 종료되거나 보관된 Challenge의 정보와 대표사진은 기록 보존을
              위해 변경할 수 없습니다.
            </p>
          </div>
        )}

        {/* 대표사진 관리 */}
        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold tracking-widest text-sky-600">
                COVER IMAGE
              </p>

              <h2 className="mt-2 text-xl font-bold text-slate-900">
                Challenge 대표사진
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Challenge 목록과 상세 화면에 표시되는 대표사진입니다.
              </p>
            </div>

            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
              {challenge.hasCoverImage ? '등록됨' : '미등록'}
            </span>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
            <div
              className={`relative aspect-16/7 w-full overflow-hidden ${
                displayedCoverImageUrl && coverEditable
                  ? 'cursor-crosshair'
                  : ''
              }`}
              onClick={
                displayedCoverImageUrl && coverEditable
                  ? handleCoverFocusClick
                  : undefined
              }
              title={
                displayedCoverImageUrl && coverEditable
                  ? '사진에서 중심으로 보여줄 위치를 클릭하세요.'
                  : undefined
              }
            >
              {displayedCoverImageUrl ? (
                <>
                  <img
                    src={displayedCoverImageUrl}
                    alt={`${challenge.title} 대표사진`}
                    className="h-full w-full select-none object-cover"
                    style={{
                      objectPosition: `${coverPositionX}% ${coverPositionY}%`,
                    }}
                    draggable={false}
                  />

                  <div
                    className="pointer-events-none absolute z-20"
                    style={{
                      left: `${coverPositionX}%`,
                      top: `${coverPositionY}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-sky-600/90 shadow-lg">
                      <div className="h-2.5 w-2.5 rounded-full bg-white" />
                    </div>
                  </div>

                  {coverEditable && (
                    <div className="pointer-events-none absolute right-4 top-4 rounded-full bg-black/60 px-3 py-1.5 text-xs font-bold text-white backdrop-blur">
                      사진을 클릭해 초점 지정
                    </div>
                  )}
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-linear-to-br from-sky-50 to-slate-100 px-6 text-center">
                  <span className="text-5xl">🏞️</span>

                  <p className="mt-4 font-bold text-slate-500">
                    등록된 대표사진이 없습니다.
                  </p>

                  <p className="mt-1 text-sm text-slate-400">
                    아래에서 사진을 선택할 수 있습니다.
                  </p>
                </div>
              )}

              {coverPreviewUrl && (
                <div className="pointer-events-none absolute left-4 top-4 rounded-full bg-sky-600 px-3 py-1 text-xs font-bold text-white shadow">
                  새 사진 미리보기
                </div>
              )}
            </div>

            {displayedCoverImageUrl && (
              <div className="border-t border-slate-200 bg-white px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-slate-800">
                      대표사진 초점
                    </p>

                    <p className="mt-1 max-w-lg text-xs leading-5 text-slate-500">
                      사진에서 중요한 대상을 클릭하세요. Challenge 화면에서
                      사진이 잘릴 때 선택한 위치를 중심으로 표시합니다.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={resetCoverFocus}
                    disabled={!coverEditable || coverBusy}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    가운데로 초기화
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-lg bg-sky-50 px-3 py-2 text-xs font-bold text-sky-700">
                    가로 X {coverPositionX.toFixed(1)}%
                  </span>

                  <span className="rounded-lg bg-sky-50 px-3 py-2 text-xs font-bold text-sky-700">
                    세로 Y {coverPositionY.toFixed(1)}%
                  </span>
                </div>

                {selectedCoverImage ? (
                  <p className="mt-3 text-xs font-semibold leading-5 text-sky-600">
                    새 사진은 아래의 대표사진 등록 또는 교체 버튼을 누르면 현재
                    초점도 함께 저장됩니다.
                  </p>
                ) : (
                  challenge.hasCoverImage && (
                    <button
                      type="button"
                      onClick={handleSaveCoverPosition}
                      disabled={!coverEditable || coverBusy}
                      className="mt-4 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {coverPositionSaving
                        ? '초점 저장 중...'
                        : '초점 위치 저장'}
                    </button>
                  )
                )}
              </div>
            )}

            {selectedCoverImage && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-white px-4 py-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-700">
                    {selectedCoverImage.name}
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    {(selectedCoverImage.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleCancelCoverSelection}
                  disabled={coverBusy}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  선택 취소
                </button>
              </div>
            )}
          </div>

          <div className="mt-5">
            <input
              id="coverImage"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleCoverImageChange}
              disabled={!coverEditable || coverBusy}
              className="hidden"
            />

            <div className="flex flex-wrap gap-3">
              <label
                htmlFor="coverImage"
                className={`rounded-xl border px-5 py-3 text-sm font-bold transition ${
                  coverEditable && !coverBusy
                    ? 'cursor-pointer border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                }`}
              >
                {challenge.hasCoverImage ? '다른 사진 선택' : '대표사진 선택'}
              </label>

              {selectedCoverImage && (
                <button
                  type="button"
                  onClick={handleSaveCoverImage}
                  disabled={!coverEditable || coverBusy}
                  className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {coverSaving
                    ? '사진 저장 중...'
                    : challenge.hasCoverImage
                      ? '대표사진 교체'
                      : '대표사진 등록'}
                </button>
              )}

              {challenge.hasCoverImage && !selectedCoverImage && (
                <button
                  type="button"
                  onClick={handleDeleteCoverImage}
                  disabled={!coverEditable || coverBusy}
                  className="rounded-xl border border-red-200 bg-white px-5 py-3 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  {coverDeleting ? '사진 삭제 중...' : '대표사진 삭제'}
                </button>
              )}
            </div>

            <p className="mt-3 text-xs leading-5 text-slate-500">
              JPG, JPEG, PNG, WEBP · 최대 10MB
            </p>

            {challenge.status === 'ACTIVE' && (
              <p className="mt-2 text-xs font-semibold text-emerald-600">
                대표사진과 초점 위치는 운영 중에도 변경할 수 있습니다.
              </p>
            )}
          </div>

          {coverMessage && (
            <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-emerald-700">
                {coverMessage}
              </p>
            </div>
          )}

          {coverError && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-700">{coverError}</p>
            </div>
          )}
        </section>

        {/* 기본정보 수정 */}
        <form
          onSubmit={handleSubmit}
          className="mt-8 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm"
        >
          <div>
            <label htmlFor="title" className="text-sm font-bold text-slate-800">
              Challenge 제목
            </label>

            <input
              id="title"
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={!challengeEditable || saving}
              maxLength={100}
              required
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
            />

            <p className="mt-1 text-right text-xs text-slate-400">
              {title.length} / 100
            </p>
          </div>

          <div className="mt-6">
            <label
              htmlFor="description"
              className="text-sm font-bold text-slate-800"
            >
              설명
            </label>

            <textarea
              id="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={!challengeEditable || saving}
              maxLength={2000}
              rows={7}
              className="mt-2 w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
            />

            <p className="mt-1 text-right text-xs text-slate-400">
              {description.length} / 2000
            </p>
          </div>

          <div className="mt-6">
            <label
              htmlFor="region"
              className="text-sm font-bold text-slate-800"
            >
              지역
            </label>

            <input
              id="region"
              type="text"
              value={region}
              onChange={(event) => setRegion(event.target.value)}
              disabled={!challengeEditable || saving}
              maxLength={100}
              placeholder="예: 경기도"
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
            />
          </div>

          <div className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-bold text-slate-800">운영 기간</p>

              {challenge.status === 'ACTIVE' && (
                <span className="text-xs font-bold text-amber-600">
                  운영 중에는 변경할 수 없습니다.
                </span>
              )}

              {challenge.status === 'PAUSED' && (
                <span className="text-xs font-bold text-amber-700">
                  운영 중단 상태에서는 변경할 수 있습니다.
                </span>
              )}
            </div>

            <div className="mt-2 grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="startAt"
                  className="text-xs font-bold text-slate-600"
                >
                  운영 시작 일시
                </label>

                <input
                  id="startAt"
                  type="datetime-local"
                  value={startAt}
                  onChange={(event) => setStartAt(event.target.value)}
                  disabled={!datesEditable || saving}
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500"
                />
              </div>

              <div>
                <label
                  htmlFor="endAt"
                  className="text-xs font-bold text-slate-600"
                >
                  운영 종료 일시
                </label>

                <input
                  id="endAt"
                  type="datetime-local"
                  value={endAt}
                  onChange={(event) => setEndAt(event.target.value)}
                  disabled={!datesEditable || saving}
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500"
                />
              </div>
            </div>

            {datesEditable && (
              <p className="mt-3 text-xs leading-5 text-slate-500">
                운영 종료 일시를 비워두면 기관이 직접 최종 종료할 때까지 운영할
                수 있습니다.
              </p>
            )}
          </div>

          {saveError && (
            <div className="mt-6 rounded-xl bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-700">{saveError}</p>
            </div>
          )}

          <div className="mt-8 flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-6">
            <Link
              href={`/institution/challenges/${challenge.id}`}
              className="rounded-xl border border-slate-300 bg-white px-6 py-3 font-bold text-slate-700 transition hover:bg-slate-50"
            >
              취소
            </Link>

            <button
              type="submit"
              disabled={!challengeEditable || saving}
              className={`rounded-xl px-6 py-3 font-bold transition ${
                !challengeEditable || saving
                  ? 'cursor-not-allowed bg-slate-200 text-slate-500'
                  : 'bg-sky-600 text-white hover:bg-sky-700'
              }`}
            >
              {saving ? '저장 중...' : '변경사항 저장'}
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}

function toDateTimeLocal(value: string | null) {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  const timezoneOffset = date.getTimezoneOffset()

  const localDate = new Date(date.getTime() - timezoneOffset * 60 * 1000)

  return localDate.toISOString().slice(0, 16)
}
