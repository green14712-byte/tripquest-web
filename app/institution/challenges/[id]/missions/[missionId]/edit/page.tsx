'use client'

import Link from 'next/link'
import QRCode from 'qrcode'
import {
  ChangeEvent,
  FormEvent,
  MouseEvent as ReactMouseEvent,
  useEffect,
  useState,
} from 'react'
import { useParams, useRouter } from 'next/navigation'

import MissionLocationMap from '../../../../../../components/mission-location-map'
import { API_BASE_URL } from '../../../../../../lib/api'

type VerificationMode = 'LOCATION_ONLY' | 'LOCATION_AND_QR' | 'LOCATION_OR_QR'

type ChallengeStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ENDED' | 'ARCHIVED'

type Challenge = {
  id: number
  title: string
  status: ChallengeStatus
}

type Mission = {
  id: number
  title: string
  description: string | null
  address: string | null
  latitude: number
  longitude: number
  verificationRadius: number
  verificationMode: VerificationMode
  qrLocationNote: string | null
  qrActive: boolean
  qrAvailable: boolean
  photoPositionX: number
  photoPositionY: number
  sortOrder: number
  challengeId: number
  createdAt: string
  updatedAt: string
}

type UpdatedMission = {
  id: number
  title: string
  verificationMode: VerificationMode
}

const MAX_PHOTO_SIZE = 10 * 1024 * 1024

const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export default function EditMissionPage() {
  const router = useRouter()

  const params = useParams()

  const challengeId = Array.isArray(params.id) ? params.id[0] : params.id

  const missionId = Array.isArray(params.missionId)
    ? params.missionId[0]
    : params.missionId

  const [challenge, setChallenge] = useState<Challenge | null>(null)

  const [mission, setMission] = useState<Mission | null>(null)

  const [title, setTitle] = useState('')

  const [description, setDescription] = useState('')

  const [address, setAddress] = useState('')

  const [latitude, setLatitude] = useState<number | null>(null)

  const [longitude, setLongitude] = useState<number | null>(null)

  const [verificationRadius, setVerificationRadius] = useState(100)

  const [verificationMode, setVerificationMode] =
    useState<VerificationMode>('LOCATION_AND_QR')

  const [originalVerificationMode, setOriginalVerificationMode] =
    useState<VerificationMode>('LOCATION_AND_QR')

  const [qrLocationNote, setQrLocationNote] = useState('')

  const [sortOrder, setSortOrder] = useState(0)

  const [pageLoading, setPageLoading] = useState(true)

  const [saving, setSaving] = useState(false)

  const [error, setError] = useState('')

  const [updatedMission, setUpdatedMission] = useState<UpdatedMission | null>(
    null,
  )

  const [qrImageUrl, setQrImageUrl] = useState('')

  const [qrPath, setQrPath] = useState('')

  /*
   * Mission 관광지 대표사진 상태
   */
  const [hasPhotoImage, setHasPhotoImage] = useState(false)

  const [currentPhotoUrl, setCurrentPhotoUrl] = useState('')

  const [photoFile, setPhotoFile] = useState<File | null>(null)

  const [photoPreviewUrl, setPhotoPreviewUrl] = useState('')

  const [photoSaving, setPhotoSaving] = useState(false)

  const [photoDeleting, setPhotoDeleting] = useState(false)

  const [photoError, setPhotoError] = useState('')

  const [photoMessage, setPhotoMessage] = useState('')

  /*
   * 관광지 대표사진 초점 위치
   */
  const [photoPositionX, setPhotoPositionX] = useState(50)

  const [photoPositionY, setPhotoPositionY] = useState(50)

  /*
   * 서버에 마지막으로 저장된 초점 위치.
   *
   * 새 사진 선택을 취소했을 때
   * 기존 사진의 초점으로 되돌리기 위해 사용한다.
   */
  const [savedPhotoPositionX, setSavedPhotoPositionX] = useState(50)

  const [savedPhotoPositionY, setSavedPhotoPositionY] = useState(50)

  const [photoPositionSaving, setPhotoPositionSaving] = useState(false)

  /*
   * 새 대표사진을 선택했을 때
   * 로컬 미리보기 URL 생성
   */
  useEffect(() => {
    if (!photoFile) {
      setPhotoPreviewUrl('')

      return
    }

    const url = URL.createObjectURL(photoFile)

    setPhotoPreviewUrl(url)

    return () => {
      URL.revokeObjectURL(url)
    }
  }, [photoFile])

  /*
   * 현재 Mission 대표사진 조회
   *
   * 사진이 등록되어 있지 않은 경우의 404는
   * 정상적인 "사진 없음" 상태로 처리한다.
   */
  async function loadCurrentPhoto(
    targetMissionId: string,
    accessToken: string,
  ) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/missions/${targetMissionId}/photo`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      )

      if (response.status === 404) {
        setHasPhotoImage(false)

        setCurrentPhotoUrl('')

        setPhotoPositionX(50)

        setPhotoPositionY(50)

        setSavedPhotoPositionX(50)

        setSavedPhotoPositionY(50)

        return
      }

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

        throw new Error(message ?? 'Mission 대표사진을 불러오지 못했습니다.')
      }

      setHasPhotoImage(Boolean(data?.mission?.hasPhotoImage))

      setCurrentPhotoUrl(
        typeof data?.mission?.photoImageUrl === 'string'
          ? data.mission.photoImageUrl
          : '',
      )

      const loadedPhotoPositionX =
        typeof data?.mission?.photoPositionX === 'number'
          ? data.mission.photoPositionX
          : 50

      const loadedPhotoPositionY =
        typeof data?.mission?.photoPositionY === 'number'
          ? data.mission.photoPositionY
          : 50

      setPhotoPositionX(loadedPhotoPositionX)

      setPhotoPositionY(loadedPhotoPositionY)

      setSavedPhotoPositionX(loadedPhotoPositionX)

      setSavedPhotoPositionY(loadedPhotoPositionY)
    } catch (err) {
      setPhotoError(
        err instanceof Error
          ? err.message
          : 'Mission 대표사진을 확인하는 중 오류가 발생했습니다.',
      )
    }
  }

  /*
   * 현재 Challenge와 Mission 정보 조회
   */
  useEffect(() => {
    async function loadMission() {
      const accessToken = sessionStorage.getItem('accessToken')

      if (!accessToken) {
        router.replace('/login')

        return
      }

      if (!challengeId || !missionId) {
        setError('Mission 정보를 확인할 수 없습니다.')

        setPageLoading(false)

        return
      }

      try {
        const response = await fetch(
          `${API_BASE_URL}/challenges/institution/${challengeId}`,
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

        const loadedChallenge: Challenge = data.challenge

        const missions: Mission[] = Array.isArray(data.missions)
          ? data.missions
          : []

        const numericMissionId = Number(missionId)

        const loadedMission = missions.find(
          (item) => item.id === numericMissionId,
        )

        if (!loadedMission) {
          throw new Error('Mission을 찾을 수 없습니다.')
        }

        if (
          loadedChallenge.status !== 'DRAFT' &&
          loadedChallenge.status !== 'PAUSED'
        ) {
          throw new Error(
            'Mission을 수정하려면 Challenge가 준비 중 또는 운영 중단 상태여야 합니다.',
          )
        }

        setChallenge(loadedChallenge)

        setMission(loadedMission)

        setTitle(loadedMission.title)

        setDescription(loadedMission.description ?? '')

        setAddress(loadedMission.address ?? '')

        setLatitude(loadedMission.latitude)

        setLongitude(loadedMission.longitude)

        setVerificationRadius(loadedMission.verificationRadius)

        setVerificationMode(loadedMission.verificationMode)

        setOriginalVerificationMode(loadedMission.verificationMode)

        setQrLocationNote(loadedMission.qrLocationNote ?? '')

        setSortOrder(loadedMission.sortOrder)

        /*
         * Mission 기본정보를 정상적으로 불러온 뒤
         * 대표사진을 별도 API로 조회한다.
         */
        await loadCurrentPhoto(missionId, accessToken)
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message)
        } else {
          setError('Mission 정보를 불러오는 중 오류가 발생했습니다.')
        }
      } finally {
        setPageLoading(false)
      }
    }

    loadMission()
  }, [challengeId, missionId, router])

  function handleLocationChange(newLatitude: number, newLongitude: number) {
    setLatitude(newLatitude)

    setLongitude(newLongitude)
  }

  function handleRadiusChange(value: number) {
    const normalizedRadius = Math.min(1000, Math.max(10, value))

    setVerificationRadius(normalizedRadius)
  }

  function requiresQr(mode: VerificationMode) {
    return mode === 'LOCATION_AND_QR' || mode === 'LOCATION_OR_QR'
  }

  /*
   * 새 대표사진 선택
   *
   * 실제 최종 파일 검증은 Backend에서 다시 수행한다.
   */
  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    /*
     * 같은 파일을 다시 선택하는 경우에도
     * change 이벤트가 발생할 수 있도록 초기화한다.
     */
    event.target.value = ''

    setPhotoError('')

    setPhotoMessage('')

    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      setPhotoFile(null)

      setPhotoError(
        '대표사진은 JPG, JPEG, PNG, WEBP 형식만 업로드할 수 있습니다.',
      )

      return
    }

    if (file.size <= 0) {
      setPhotoFile(null)

      setPhotoError('빈 파일은 대표사진으로 등록할 수 없습니다.')

      return
    }

    if (file.size > MAX_PHOTO_SIZE) {
      setPhotoFile(null)

      setPhotoError('대표사진 크기는 10MB 이하여야 합니다.')

      return
    }

    setPhotoFile(file)

    /*
     * 새 사진을 선택하면
     * 기존 사진 초점을 가져오지 않고 중앙에서 시작한다.
     */
    setPhotoPositionX(50)

    setPhotoPositionY(50)
  }

  /*
   * 사진에서 클릭한 위치를
   * 0 ~ 100% 좌표로 변환한다.
   */
  function handlePhotoFocusClick(event: ReactMouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect()

    if (rect.width <= 0 || rect.height <= 0) {
      return
    }

    const rawX = ((event.clientX - rect.left) / rect.width) * 100

    const rawY = ((event.clientY - rect.top) / rect.height) * 100

    const nextX = Math.min(100, Math.max(0, rawX))

    const nextY = Math.min(100, Math.max(0, rawY))

    setPhotoPositionX(Number(nextX.toFixed(2)))

    setPhotoPositionY(Number(nextY.toFixed(2)))

    setPhotoError('')

    setPhotoMessage('')
  }

  function resetPhotoFocus() {
    setPhotoPositionX(50)

    setPhotoPositionY(50)

    setPhotoError('')

    setPhotoMessage('')
  }

  /*
   * 기존 사진 파일은 그대로 두고
   * 초점 위치만 저장한다.
   */
  async function handleSavePhotoPosition() {
    if (!missionId) {
      setPhotoError('Mission 정보를 확인할 수 없습니다.')

      return
    }

    if (!hasPhotoImage) {
      setPhotoError('초점 위치를 저장할 Mission 대표사진이 없습니다.')

      return
    }

    if (photoFile) {
      setPhotoError(
        '새 대표사진을 선택한 상태입니다. 대표사진 교체 버튼으로 사진과 초점을 함께 저장해주세요.',
      )

      return
    }

    const accessToken = sessionStorage.getItem('accessToken')

    if (!accessToken) {
      router.replace('/login')

      return
    }

    setPhotoPositionSaving(true)

    setPhotoError('')

    setPhotoMessage('')

    try {
      const response = await fetch(`${API_BASE_URL}/missions/${missionId}`, {
        method: 'PATCH',

        headers: {
          'Content-Type': 'application/json',

          Authorization: `Bearer ${accessToken}`,
        },

        body: JSON.stringify({
          photoPositionX,
          photoPositionY,
        }),
      })

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

        throw new Error(
          message ?? 'Mission 대표사진 초점 위치 저장에 실패했습니다.',
        )
      }

      setSavedPhotoPositionX(photoPositionX)

      setSavedPhotoPositionY(photoPositionY)

      setPhotoMessage('Mission 대표사진 초점 위치가 저장되었습니다.')
    } catch (err) {
      setPhotoError(
        err instanceof Error
          ? err.message
          : 'Mission 대표사진 초점 위치 저장 중 오류가 발생했습니다.',
      )
    } finally {
      setPhotoPositionSaving(false)
    }
  }

  /*
   * 대표사진 신규 등록 / 교체
   *
   * 사진을 먼저 저장하고,
   * 성공하면 선택한 초점 위치를 별도 PATCH로 저장한다.
   */
  async function handleSavePhoto() {
    if (!missionId) {
      setPhotoError('Mission 정보를 확인할 수 없습니다.')

      return
    }

    if (!photoFile) {
      setPhotoError('등록하거나 교체할 대표사진을 선택해주세요.')

      return
    }

    const accessToken = sessionStorage.getItem('accessToken')

    if (!accessToken) {
      router.replace('/login')

      return
    }

    const wasReplacingPhoto = hasPhotoImage

    setPhotoSaving(true)

    setPhotoError('')

    setPhotoMessage('')

    try {
      const formData = new FormData()

      formData.append('photoImage', photoFile)

      /*
       * 1. 기존 대표사진 등록 / 교체
       */
      const response = await fetch(
        `${API_BASE_URL}/missions/${missionId}/photo`,
        {
          method: 'POST',

          headers: {
            Authorization: `Bearer ${accessToken}`,
          },

          body: formData,
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

        throw new Error(message ?? 'Mission 대표사진 저장에 실패했습니다.')
      }

      setHasPhotoImage(true)

      setCurrentPhotoUrl(
        typeof data?.mission?.photoImageUrl === 'string'
          ? data.mission.photoImageUrl
          : '',
      )

      /*
       * 2. 새 대표사진의 초점 위치 저장
       */
      const positionResponse = await fetch(
        `${API_BASE_URL}/missions/${missionId}`,
        {
          method: 'PATCH',

          headers: {
            'Content-Type': 'application/json',

            Authorization: `Bearer ${accessToken}`,
          },

          body: JSON.stringify({
            photoPositionX,
            photoPositionY,
          }),
        },
      )

      if (positionResponse.status === 401) {
        sessionStorage.removeItem('accessToken')

        sessionStorage.removeItem('user')

        setPhotoFile(null)

        router.replace('/login')

        return
      }

      const positionData = await positionResponse.json().catch(() => null)

      if (!positionResponse.ok) {
        const message = Array.isArray(positionData?.message)
          ? positionData.message.join(', ')
          : positionData?.message

        /*
         * 여기까지 왔다면 사진 파일 자체는 이미 저장된 상태다.
         */
        setPhotoFile(null)

        setPhotoError(
          `대표사진은 저장되었지만 초점 위치 저장에 실패했습니다.${
            message ? ` ${message}` : ''
          }`,
        )

        return
      }

      setSavedPhotoPositionX(photoPositionX)

      setSavedPhotoPositionY(photoPositionY)

      setPhotoFile(null)

      setPhotoMessage(
        wasReplacingPhoto
          ? 'Mission 대표사진과 초점 위치가 교체되었습니다.'
          : 'Mission 대표사진과 초점 위치가 등록되었습니다.',
      )
    } catch (err) {
      setPhotoError(
        err instanceof Error
          ? err.message
          : 'Mission 대표사진 저장 중 오류가 발생했습니다.',
      )
    } finally {
      setPhotoSaving(false)
    }
  }

  /*
   * 대표사진 삭제
   */
  async function handleDeletePhoto() {
    if (!missionId) {
      setPhotoError('Mission 정보를 확인할 수 없습니다.')

      return
    }

    if (!hasPhotoImage) {
      setPhotoError('삭제할 Mission 대표사진이 없습니다.')

      return
    }

    const confirmed = window.confirm(
      '현재 Mission 대표사진을 삭제하시겠습니까?\n\n삭제 후에는 관광객 화면에서도 이 사진이 표시되지 않습니다.',
    )

    if (!confirmed) {
      return
    }

    const accessToken = sessionStorage.getItem('accessToken')

    if (!accessToken) {
      router.replace('/login')

      return
    }

    setPhotoDeleting(true)

    setPhotoError('')

    setPhotoMessage('')

    try {
      const response = await fetch(
        `${API_BASE_URL}/missions/${missionId}/photo`,
        {
          method: 'DELETE',

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

        throw new Error(message ?? 'Mission 대표사진 삭제에 실패했습니다.')
      }

      setHasPhotoImage(false)

      setCurrentPhotoUrl('')

      setPhotoFile(null)

      setPhotoPositionX(50)

      setPhotoPositionY(50)

      setSavedPhotoPositionX(50)

      setSavedPhotoPositionY(50)

      setPhotoMessage('Mission 대표사진이 삭제되었습니다.')
    } catch (err) {
      setPhotoError(
        err instanceof Error
          ? err.message
          : 'Mission 대표사진 삭제 중 오류가 발생했습니다.',
      )
    } finally {
      setPhotoDeleting(false)
    }
  }

  /*
   * Mission 기본정보 수정
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!challengeId || !missionId) {
      setError('Mission 정보를 확인할 수 없습니다.')

      return
    }

    if (!title.trim()) {
      setError('Mission 제목을 입력해주세요.')

      return
    }

    if (latitude === null || longitude === null) {
      setError('지도에서 Mission 위치를 선택해주세요.')

      return
    }

    const nextRequiresQr = requiresQr(verificationMode)

    if (nextRequiresQr && !qrLocationNote.trim()) {
      setError('QR을 사용하는 Mission은 QR 설치 위치를 입력해주세요.')

      return
    }

    if (
      requiresQr(originalVerificationMode) &&
      verificationMode === 'LOCATION_ONLY'
    ) {
      const confirmed = window.confirm(
        '인증 방식을 위치 인증 전용으로 변경하시겠습니까?\n\n현재 Mission의 기존 QR은 완전히 무효화되며 다시 사용할 수 없습니다.',
      )

      if (!confirmed) {
        return
      }
    }

    if (originalVerificationMode === 'LOCATION_ONLY' && nextRequiresQr) {
      const confirmed = window.confirm(
        'QR 인증을 사용하는 방식으로 변경하시겠습니까?\n\n저장과 동시에 새로운 Mission QR이 자동 발급됩니다.',
      )

      if (!confirmed) {
        return
      }
    }

    const accessToken = sessionStorage.getItem('accessToken')

    if (!accessToken) {
      router.replace('/login')

      return
    }

    setSaving(true)

    setError('')

    try {
      const body: {
        title: string
        description: string
        address: string
        latitude: number
        longitude: number
        verificationRadius: number
        verificationMode: VerificationMode
        qrLocationNote?: string
        sortOrder: number
      } = {
        title: title.trim(),

        description: description.trim(),

        address: address.trim(),

        latitude,

        longitude,

        verificationRadius,

        verificationMode,

        sortOrder,
      }

      if (nextRequiresQr) {
        body.qrLocationNote = qrLocationNote.trim()
      }

      const response = await fetch(`${API_BASE_URL}/missions/${missionId}`, {
        method: 'PATCH',

        headers: {
          'Content-Type': 'application/json',

          Authorization: `Bearer ${accessToken}`,
        },

        body: JSON.stringify(body),
      })

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

        throw new Error(message ?? 'Mission 수정에 실패했습니다.')
      }

      if (data?.qrToken) {
        const missionQrPath: string = data.qrPath

        const absoluteQrUrl = new URL(
          missionQrPath,
          window.location.origin,
        ).toString()

        const generatedQrImage = await QRCode.toDataURL(absoluteQrUrl, {
          width: 320,

          margin: 2,

          errorCorrectionLevel: 'M',
        })

        setUpdatedMission({
          id: data.mission.id,

          title: data.mission.title,

          verificationMode: data.mission.verificationMode,
        })

        setQrPath(absoluteQrUrl)

        setQrImageUrl(generatedQrImage)

        return
      }

      router.push(`/institution/challenges/${challengeId}`)

      router.refresh()
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Mission 수정 중 오류가 발생했습니다.')
      }
    } finally {
      setSaving(false)
    }
  }

  if (pageLoading) {
    return (
      <main className="flex flex-1 items-center justify-center bg-slate-50 px-6 py-20">
        <p className="font-semibold text-slate-500">
          Mission 수정 화면을 준비하는 중...
        </p>
      </main>
    )
  }

  if (error && (!challenge || !mission)) {
    return (
      <main className="flex flex-1 items-center justify-center bg-slate-50 px-6 py-20">
        <div className="w-full max-w-xl rounded-3xl border border-red-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">
            Mission을 수정할 수 없습니다.
          </h1>

          <p className="mt-3 text-red-600">{error}</p>

          <Link
            href={
              challengeId
                ? `/institution/challenges/${challengeId}`
                : '/institution/challenges'
            }
            className="mt-6 inline-block font-bold text-sky-600"
          >
            ← Challenge 관리
          </Link>
        </div>
      </main>
    )
  }

  if (updatedMission && qrImageUrl) {
    return (
      <main className="flex flex-1 justify-center bg-slate-50 px-6 py-12">
        <div className="w-full max-w-2xl">
          <div className="rounded-3xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
            <div className="text-5xl">✅</div>

            <h1 className="mt-5 text-2xl font-bold text-slate-900">
              Mission이 수정되었습니다.
            </h1>

            <p className="mt-2 text-slate-600">{updatedMission.title}</p>

            <div className="mt-5 rounded-2xl bg-violet-50 p-5 text-left">
              <p className="font-bold text-violet-800">
                새로운 QR이 발급되었습니다.
              </p>

              <p className="mt-2 text-sm leading-6 text-violet-700">
                위치 인증 전용 Mission에서 QR을 사용하는 인증 방식으로 변경되어
                새로운 QR이 자동 발급되었습니다. 이 QR은 이후 Challenge 관리
                화면에서도 다시 확인할 수 있습니다.
              </p>
            </div>

            <div className="mx-auto mt-8 max-w-sm rounded-3xl border border-slate-200 bg-white p-6">
              <img
                src={qrImageUrl}
                alt="Mission QR Code"
                className="mx-auto h-auto w-full"
              />
            </div>

            <div className="mt-6 rounded-xl bg-slate-50 p-4 text-left">
              <p className="text-xs font-bold text-slate-400">QR 연결 주소</p>

              <p className="mt-2 break-all text-sm text-slate-600">{qrPath}</p>
            </div>

            <Link
              href={`/institution/challenges/${challengeId}`}
              className="mt-8 inline-block rounded-xl bg-sky-600 px-6 py-3 font-bold text-white transition hover:bg-sky-700"
            >
              Challenge 관리로 돌아가기
            </Link>
          </div>
        </div>
      </main>
    )
  }

  if (!challenge || !mission) {
    return null
  }

  const qrRequired = requiresQr(verificationMode)

  return (
    <main className="flex flex-1 justify-center bg-slate-50 px-6 py-12">
      <div className="w-full max-w-7xl">
        <Link
          href={`/institution/challenges/${challengeId}`}
          className="text-sm font-bold text-slate-500 hover:text-slate-800"
        >
          ← {challenge.title}
        </Link>

        <div className="mt-6">
          <p className="text-sm font-bold tracking-widest text-sky-600">
            EDIT MISSION
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            Mission 수정
          </h1>

          <p className="mt-2 text-slate-600">
            Mission의 장소와 인증 설정을 수정합니다.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-8 grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]"
        >
          <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">Mission 정보</h2>

            <div className="mt-6">
              <label
                htmlFor="mission-title"
                className="text-sm font-bold text-slate-800"
              >
                Mission 제목
                <span className="ml-1 text-red-500">*</span>
              </label>

              <input
                id="mission-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                minLength={2}
                maxLength={100}
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500"
                required
              />
            </div>

            <div className="mt-5">
              <label
                htmlFor="mission-description"
                className="text-sm font-bold text-slate-800"
              >
                Mission 설명
              </label>

              <textarea
                id="mission-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                maxLength={2000}
                className="mt-2 w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500"
              />
            </div>

            <div className="mt-5">
              <label
                htmlFor="mission-address"
                className="text-sm font-bold text-slate-800"
              >
                장소 / 주소
              </label>

              <input
                id="mission-address"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                maxLength={200}
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500"
              />

              <p className="mt-2 text-xs text-slate-400">
                주소를 수정한 경우 오른쪽 지도 위치도 함께 확인해주세요.
              </p>
            </div>

            {/* Mission 관광지 대표사진 */}
            <div className="mt-7 border-t border-slate-100 pt-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-800">
                    관광지 대표사진
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    JPG / JPEG / PNG / WEBP, 최대 10MB
                  </p>
                </div>

                <span
                  className={
                    hasPhotoImage
                      ? 'rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700'
                      : 'rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500'
                  }
                >
                  {hasPhotoImage ? '등록됨' : '미등록'}
                </span>
              </div>

              {hasPhotoImage && currentPhotoUrl ? (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-bold text-slate-500">
                    현재 대표사진
                  </p>

                  {!photoFile && (
                    <p className="mb-2 text-xs font-semibold text-sky-700">
                      사진에서 중요하게 보여줄 위치를 클릭한 뒤 초점 위치를
                      저장해주세요.
                    </p>
                  )}

                  <div
                    role={!photoFile ? 'button' : undefined}
                    tabIndex={!photoFile ? 0 : -1}
                    aria-label={
                      !photoFile
                        ? '현재 관광지 대표사진 초점 위치 선택'
                        : undefined
                    }
                    onClick={!photoFile ? handlePhotoFocusClick : undefined}
                    onKeyDown={(event) => {
                      if (
                        !photoFile &&
                        (event.key === 'Enter' || event.key === ' ')
                      ) {
                        event.preventDefault()

                        resetPhotoFocus()
                      }
                    }}
                    className={`relative aspect-video w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 outline-none ring-sky-400 ${
                      photoFile
                        ? 'cursor-default'
                        : 'cursor-crosshair focus:ring-2'
                    }`}
                  >
                    <img
                      src={currentPhotoUrl}
                      alt="현재 Mission 관광지 대표사진"
                      className="h-full w-full select-none object-cover"
                      draggable={false}
                      style={{
                        objectPosition: `${
                          photoFile ? savedPhotoPositionX : photoPositionX
                        }% ${
                          photoFile ? savedPhotoPositionY : photoPositionY
                        }%`,
                      }}
                    />

                    {!photoFile && (
                      <div
                        className="pointer-events-none absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-sky-500 shadow-lg"
                        style={{
                          left: `${photoPositionX}%`,
                          top: `${photoPositionY}%`,
                        }}
                      >
                        <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
                      </div>
                    )}
                  </div>

                  {!photoFile && (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs font-semibold text-slate-600">
                        초점 X {photoPositionX.toFixed(0)}% · Y{' '}
                        {photoPositionY.toFixed(0)}%
                      </p>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={resetPhotoFocus}
                          disabled={
                            photoSaving || photoDeleting || photoPositionSaving
                          }
                          className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          가운데로 초기화
                        </button>

                        <button
                          type="button"
                          onClick={() => void handleSavePhotoPosition()}
                          disabled={
                            photoSaving || photoDeleting || photoPositionSaving
                          }
                          className="rounded-xl bg-sky-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                          {photoPositionSaving
                            ? '초점 저장 중...'
                            : '초점 위치 저장'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-4 flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 text-center">
                  <div>
                    <p className="font-bold text-slate-600">
                      등록된 대표사진이 없습니다.
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      아래에서 새로운 관광지 사진을 선택해주세요.
                    </p>
                  </div>
                </div>
              )}

              <div className="mt-5">
                <label
                  htmlFor="mission-photo"
                  className="text-sm font-bold text-slate-700"
                >
                  {hasPhotoImage ? '새 대표사진 선택' : '대표사진 선택'}
                </label>

                <input
                  id="mission-photo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoChange}
                  disabled={photoSaving || photoDeleting || photoPositionSaving}
                  className="mt-3 block w-full text-sm text-slate-700 file:mr-4 file:rounded-xl file:border-0 file:bg-sky-50 file:px-4 file:py-2 file:font-bold file:text-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>

              {photoPreviewUrl && (
                <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4">
                  <p className="text-xs font-bold text-sky-700">
                    변경될 대표사진 미리보기
                  </p>

                  <p className="mt-2 text-xs font-semibold text-sky-700">
                    사진에서 중요하게 보여줄 위치를 클릭해주세요.
                  </p>

                  <div
                    role="button"
                    tabIndex={0}
                    aria-label="새 관광지 대표사진 초점 위치 선택"
                    onClick={handlePhotoFocusClick}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()

                        resetPhotoFocus()
                      }
                    }}
                    className="relative mt-3 aspect-video w-full cursor-crosshair overflow-hidden rounded-2xl border border-sky-200 bg-white outline-none ring-sky-400 focus:ring-2"
                  >
                    <img
                      src={photoPreviewUrl}
                      alt="새 Mission 관광지 대표사진 미리보기"
                      className="h-full w-full select-none object-cover"
                      draggable={false}
                      style={{
                        objectPosition: `${photoPositionX}% ${photoPositionY}%`,
                      }}
                    />

                    <div
                      className="pointer-events-none absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-sky-500 shadow-lg"
                      style={{
                        left: `${photoPositionX}%`,
                        top: `${photoPositionY}%`,
                      }}
                    >
                      <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="break-all text-xs text-slate-500">
                        {photoFile?.name}
                      </p>

                      <p className="mt-1 text-xs font-semibold text-slate-600">
                        초점 X {photoPositionX.toFixed(0)}% · Y{' '}
                        {photoPositionY.toFixed(0)}%
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={resetPhotoFocus}
                      disabled={photoSaving}
                      className="rounded-xl border border-sky-200 bg-white px-3 py-2 text-xs font-bold text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      가운데로 초기화
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setPhotoFile(null)

                      setPhotoPositionX(savedPhotoPositionX)

                      setPhotoPositionY(savedPhotoPositionY)

                      setPhotoError('')

                      setPhotoMessage('')
                    }}
                    disabled={photoSaving}
                    className="mt-3 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    새 사진 선택 취소
                  </button>
                </div>
              )}

              {photoError && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
                  {photoError}
                </div>
              )}

              {photoMessage && (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
                  {photoMessage}
                </div>
              )}

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void handleSavePhoto()}
                  disabled={
                    !photoFile ||
                    photoSaving ||
                    photoDeleting ||
                    photoPositionSaving
                  }
                  className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {photoSaving
                    ? '사진 저장 중...'
                    : hasPhotoImage
                      ? '대표사진 교체'
                      : '대표사진 등록'}
                </button>

                {hasPhotoImage && (
                  <button
                    type="button"
                    onClick={() => void handleDeletePhoto()}
                    disabled={
                      photoSaving || photoDeleting || photoPositionSaving
                    }
                    className="rounded-xl border border-red-300 bg-white px-4 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {photoDeleting ? '삭제 중...' : '대표사진 삭제'}
                  </button>
                )}
              </div>

              <p className="mt-3 text-xs leading-5 text-slate-400">
                대표사진 변경과 초점 위치 저장은 Mission 기본정보 수정과 별도로
                즉시 저장됩니다.
              </p>
            </div>

            {/* 인증 방식 */}
            <div className="mt-7 border-t border-slate-100 pt-6">
              <p className="text-sm font-bold text-slate-800">인증 방식</p>

              <div className="mt-3 space-y-3">
                <label className="flex cursor-pointer gap-3 rounded-2xl border border-slate-200 p-4 transition hover:border-sky-300">
                  <input
                    type="radio"
                    name="verificationMode"
                    value="LOCATION_ONLY"
                    checked={verificationMode === 'LOCATION_ONLY'}
                    onChange={() => setVerificationMode('LOCATION_ONLY')}
                    className="mt-1"
                  />

                  <div>
                    <p className="font-bold text-slate-900">위치 인증만</p>

                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      설정한 GPS 반경 안에 있으면 Mission을 완료할 수 있습니다.
                    </p>
                  </div>
                </label>

                <label className="flex cursor-pointer gap-3 rounded-2xl border border-slate-200 p-4 transition hover:border-sky-300">
                  <input
                    type="radio"
                    name="verificationMode"
                    value="LOCATION_AND_QR"
                    checked={verificationMode === 'LOCATION_AND_QR'}
                    onChange={() => setVerificationMode('LOCATION_AND_QR')}
                    className="mt-1"
                  />

                  <div>
                    <p className="font-bold text-slate-900">위치 + QR 둘 다</p>

                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      GPS 반경 안에 있으면서 해당 장소의 QR까지 인증해야
                      완료됩니다.
                    </p>
                  </div>
                </label>

                <label className="flex cursor-pointer gap-3 rounded-2xl border border-slate-200 p-4 transition hover:border-sky-300">
                  <input
                    type="radio"
                    name="verificationMode"
                    value="LOCATION_OR_QR"
                    checked={verificationMode === 'LOCATION_OR_QR'}
                    onChange={() => setVerificationMode('LOCATION_OR_QR')}
                    className="mt-1"
                  />

                  <div>
                    <p className="font-bold text-slate-900">위치 또는 QR</p>

                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      GPS 위치 인증이나 QR 인증 중 하나만 성공해도 완료됩니다.
                    </p>
                  </div>
                </label>
              </div>

              {requiresQr(originalVerificationMode) &&
                verificationMode === 'LOCATION_ONLY' && (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
                    <p className="text-sm font-bold text-red-700">
                      기존 QR이 무효화됩니다.
                    </p>

                    <p className="mt-1 text-xs leading-5 text-red-600">
                      위치 인증 전용으로 변경하면 현재 QR의 Hash와 암호화
                      데이터가 삭제됩니다.
                    </p>
                  </div>
                )}

              {originalVerificationMode === 'LOCATION_ONLY' && qrRequired && (
                <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-4">
                  <p className="text-sm font-bold text-violet-700">
                    새로운 QR이 발급됩니다.
                  </p>

                  <p className="mt-1 text-xs leading-5 text-violet-600">
                    저장하면 이 Mission을 위한 새로운 QR이 자동으로 생성됩니다.
                  </p>
                </div>
              )}
            </div>

            {/* 인증 반경 */}
            <div className="mt-7 border-t border-slate-100 pt-6">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-slate-800">
                    위치 인증 반경
                  </p>

                  <p className="mt-1 text-xs text-slate-500">10m ~ 1000m</p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={10}
                    max={1000}
                    value={verificationRadius}
                    onChange={(event) =>
                      handleRadiusChange(Number(event.target.value))
                    }
                    className="w-24 rounded-xl border border-slate-300 px-3 py-2 text-right font-bold text-slate-900"
                  />

                  <span className="font-bold text-slate-500">m</span>
                </div>
              </div>

              <input
                type="range"
                min={10}
                max={1000}
                step={10}
                value={verificationRadius}
                onChange={(event) =>
                  handleRadiusChange(Number(event.target.value))
                }
                className="mt-4 w-full"
              />
            </div>

            {/* QR 설치 위치 */}
            {qrRequired && (
              <div className="mt-7 border-t border-slate-100 pt-6">
                <label
                  htmlFor="qr-location-note"
                  className="text-sm font-bold text-slate-800"
                >
                  QR 설치 위치
                  <span className="ml-1 text-red-500">*</span>
                </label>

                <textarea
                  id="qr-location-note"
                  value={qrLocationNote}
                  onChange={(event) => setQrLocationNote(event.target.value)}
                  maxLength={300}
                  rows={3}
                  placeholder="예: 정문 안내판 오른쪽"
                  className="mt-2 w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500"
                  required
                />

                <p className="mt-2 text-xs text-slate-400">
                  기존 QR 방식끼리 변경하는 경우 현재 QR은 그대로 유지됩니다.
                </p>
              </div>
            )}

            {/* Mission 정렬 */}
            <div className="mt-7 border-t border-slate-100 pt-6">
              <label
                htmlFor="sort-order"
                className="text-sm font-bold text-slate-800"
              >
                Mission 정렬 순서
              </label>

              <input
                id="sort-order"
                type="number"
                min={0}
                value={sortOrder}
                onChange={(event) =>
                  setSortOrder(Math.max(0, Number(event.target.value)))
                }
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500"
              />

              <p className="mt-2 text-xs text-slate-400">
                숫자가 작은 Mission이 먼저 표시됩니다.
              </p>
            </div>

            {error && (
              <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
                {error}
              </div>
            )}

            <div className="mt-8 flex justify-end gap-3">
              <Link
                href={`/institution/challenges/${challengeId}`}
                className="rounded-xl border border-slate-300 px-5 py-3 font-bold text-slate-700 transition hover:bg-slate-50"
              >
                취소
              </Link>

              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-sky-600 px-6 py-3 font-bold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {saving ? '수정 중...' : 'Mission 수정 저장'}
              </button>
            </div>
          </div>

          {/* 오른쪽: 지도 */}
          <div className="lg:sticky lg:top-24">
            <div className="mb-3">
              <h2 className="text-xl font-bold text-slate-900">Mission 위치</h2>

              <p className="mt-1 text-sm text-slate-500">
                기존 위치를 확인하거나 지도를 클릭해서 새로운 위치를
                선택해주세요.
              </p>
            </div>

            <MissionLocationMap
              latitude={latitude}
              longitude={longitude}
              radius={verificationRadius}
              onLocationChange={handleLocationChange}
            />

            {latitude !== null && longitude !== null && (
              <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-slate-400">
                      현재 중심 좌표
                    </p>

                    <p className="mt-1 text-sm font-semibold text-slate-700">
                      위도 {latitude}
                    </p>

                    <p className="mt-1 text-sm font-semibold text-slate-700">
                      경도 {longitude}
                    </p>

                    <p className="mt-3 text-lg font-bold text-sky-700">
                      중심 위치 기준 {verificationRadius}m
                    </p>
                  </div>

                  <span className="rounded-full bg-sky-100 px-4 py-2 text-sm font-bold text-sky-700">
                    GPS
                  </span>
                </div>
              </div>
            )}
          </div>
        </form>
      </div>
    </main>
  )
}
