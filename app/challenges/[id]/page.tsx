'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ChangeEvent, useCallback, useEffect, useState } from 'react'

import MissionLocationMap from '../../components/mission-location-map'
import { API_BASE_URL } from '../../lib/api'

type VerificationMode = 'LOCATION_ONLY' | 'LOCATION_AND_QR' | 'LOCATION_OR_QR'

type UserRole = 'USER' | 'INSTITUTION' | 'ADMIN'

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

type Mission = {
  id: number
  title: string
  description: string | null
  address: string | null

  hasPhotoImage: boolean
  photoImageUrl: string | null

  photoPositionX: number
  photoPositionY: number

  latitude: number
  longitude: number
  verificationRadius: number
  verificationMode: VerificationMode
  qrLocationNote: string | null
  qrActive: boolean
  qrAvailable: boolean
  sortOrder: number
  challengeId: number
}

type ChallengeDetailResponse = {
  challenge: Challenge
  missions: Mission[]
}

type Progress = {
  challengeId: number
  joined: boolean
  joinedAt: string | null
  totalMissionCount: number
  completedMissionCount: number
  progressPercent: number
  completed: boolean
  completedMissionIds: number[]
}

type AuthUser = {
  id: number
  role: UserRole
  nickname?: string
  email?: string
  institutionId?: number | null
}

type AuthMeResponse = {
  user: AuthUser
}

type MissionVerificationResult = {
  message?: string

  verification?: {
    missionId?: number
    challengeId?: number
    verificationMode?: VerificationMode
    method?: 'LOCATION' | 'QR' | 'BOTH'
    locationVerified?: boolean
    qrVerified?: boolean
    distanceMeters?: number | null
    allowedRadiusMeters?: number
  }
}

type CompletionPhotoResponse = {
  message?: string
  missionId: number
  completionId: number
  hasPhotoImage: boolean
  photoImageUrl: string | null
}

type CompletionPhotoState = {
  loading: boolean
  saving: boolean
  deleting: boolean

  hasPhotoImage: boolean
  photoImageUrl: string | null

  selectedFile: File | null
  previewUrl: string | null

  error: string
  message: string
}

const MAX_COMPLETION_PHOTO_SIZE = 10 * 1024 * 1024

const ALLOWED_COMPLETION_PHOTO_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
])

function createEmptyCompletionPhotoState(): CompletionPhotoState {
  return {
    loading: false,
    saving: false,
    deleting: false,

    hasPhotoImage: false,
    photoImageUrl: null,

    selectedFile: null,
    previewUrl: null,

    error: '',
    message: '',
  }
}

/*
 * Mission 관광지 대표사진
 */
function MissionPhoto({
  mission,
  completed,
}: {
  mission: Mission
  completed: boolean
}) {
  const [imageError, setImageError] = useState(false)

  useEffect(() => {
    setImageError(false)
  }, [mission.photoImageUrl])

  const canDisplay = Boolean(mission.photoImageUrl) && !imageError

  return (
    <div className="relative overflow-hidden bg-slate-100">
      {canDisplay ? (
        <img
          src={mission.photoImageUrl!}
          alt={`${mission.title} 관광지 대표사진`}
          onError={() => setImageError(true)}
          className={`h-64 w-full object-cover transition sm:h-72 lg:h-full lg:min-h-80 ${
            completed ? 'brightness-90' : ''
          }`}
          style={{
            objectPosition: `${mission.photoPositionX}% ${mission.photoPositionY}%`,
          }}
        />
      ) : (
        <div className="flex h-56 flex-col items-center justify-center px-5 text-center sm:h-64 lg:h-full lg:min-h-80">
          <span className="text-5xl" aria-hidden="true">
            🏞️
          </span>

          <p className="mt-3 text-sm font-bold text-slate-600">
            {!mission.hasPhotoImage
              ? '등록된 관광지 대표사진이 없습니다.'
              : '관광지 대표사진을 불러올 수 없습니다.'}
          </p>
        </div>
      )}

      <div className="absolute left-4 top-4 rounded-full bg-black/60 px-3 py-1.5 text-xs font-bold text-white backdrop-blur">
        관광지
      </div>

      {completed && (
        <div className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white shadow">
          <span>✓</span>
          <span>완료</span>
        </div>
      )}
    </div>
  )
}

/*
 * USER가 Mission 완료 후 등록한 개인 사진
 */
function CompletionPhotoPreview({
  missionTitle,
  photoImageUrl,
}: {
  missionTitle: string
  photoImageUrl: string
}) {
  const [imageError, setImageError] = useState(false)

  useEffect(() => {
    setImageError(false)
  }, [photoImageUrl])

  if (imageError) {
    return (
      <div className="flex h-52 items-center justify-center rounded-2xl bg-slate-100 px-6 text-center">
        <p className="text-sm font-semibold text-slate-500">
          완료 사진을 불러올 수 없습니다.
        </p>
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-slate-100">
      <img
        src={photoImageUrl}
        alt={`${missionTitle} Mission 완료 사진`}
        onError={() => setImageError(true)}
        className="h-64 w-full object-cover sm:h-80"
      />

      <div className="absolute left-4 top-4 rounded-full bg-black/60 px-3 py-1.5 text-xs font-bold text-white backdrop-blur">
        나의 여행 사진
      </div>
    </div>
  )
}

export default function ChallengeDetailPage() {
  const params = useParams()

  const router = useRouter()

  const challengeId = Array.isArray(params.id) ? params.id[0] : params.id

  const [challenge, setChallenge] = useState<Challenge | null>(null)

  const [missions, setMissions] = useState<Mission[]>([])

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)

  const [progress, setProgress] = useState<Progress | null>(null)

  const [loading, setLoading] = useState(true)

  const [progressLoading, setProgressLoading] = useState(false)

  const [joining, setJoining] = useState(false)

  const [error, setError] = useState('')

  const [joinError, setJoinError] = useState('')

  const [verifyingMissionId, setVerifyingMissionId] = useState<number | null>(
    null,
  )

  const [missionErrors, setMissionErrors] = useState<Record<number, string>>({})

  const [missionMessages, setMissionMessages] = useState<
    Record<number, string>
  >({})

  /*
   * 웹 내부 QR 스캐너
   */
  const [qrScannerMissionId, setQrScannerMissionId] = useState<number | null>(
    null,
  )

  const [qrScannerStarting, setQrScannerStarting] = useState(false)

  const [qrScannerError, setQrScannerError] = useState('')

  /*
   * Mission 지도 접기 / 펼치기
   */
  const [expandedMaps, setExpandedMaps] = useState<Record<number, boolean>>({})

  /*
   * USER Mission 완료사진 상태
   */
  const [completionPhotos, setCompletionPhotos] = useState<
    Record<number, CompletionPhotoState>
  >({})

  const updateCompletionPhotoState = useCallback(
    (missionId: number, patch: Partial<CompletionPhotoState>) => {
      setCompletionPhotos((current) => ({
        ...current,

        [missionId]: {
          ...(current[missionId] ?? createEmptyCompletionPhotoState()),
          ...patch,
        },
      }))
    },
    [],
  )

  /*
   * 완료된 Mission들의 USER 완료사진을 조회한다.
   */
  const loadCompletionPhotos = useCallback(
    async (accessToken: string, missionIds: number[]) => {
      if (missionIds.length === 0) {
        return
      }

      await Promise.all(
        missionIds.map(async (missionId) => {
          updateCompletionPhotoState(missionId, {
            loading: true,
            error: '',
          })

          try {
            const response = await fetch(
              `${API_BASE_URL}/mission-completions/${missionId}/photo`,
              {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                },

                cache: 'no-store',
              },
            )

            if (response.status === 401) {
              sessionStorage.removeItem('accessToken')
              sessionStorage.removeItem('user')

              updateCompletionPhotoState(missionId, {
                loading: false,
              })

              return
            }

            const data = (await response
              .json()
              .catch(() => null)) as CompletionPhotoResponse | null

            if (!response.ok) {
              const message =
                typeof data?.message === 'string'
                  ? data.message
                  : '완료사진 정보를 불러오지 못했습니다.'

              throw new Error(message)
            }

            updateCompletionPhotoState(missionId, {
              loading: false,

              hasPhotoImage: Boolean(data?.hasPhotoImage),

              photoImageUrl: data?.photoImageUrl ?? null,

              error: '',
            })
          } catch (err) {
            updateCompletionPhotoState(missionId, {
              loading: false,

              error:
                err instanceof Error
                  ? err.message
                  : '완료사진 정보를 불러오지 못했습니다.',
            })
          }
        }),
      )
    },
    [updateCompletionPhotoState],
  )

  const loadProgress = useCallback(
    async (accessToken: string, id: string) => {
      setProgressLoading(true)

      try {
        const response = await fetch(
          `${API_BASE_URL}/challenges/${id}/progress`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },

            cache: 'no-store',
          },
        )

        if (response.status === 401) {
          sessionStorage.removeItem('accessToken')
          sessionStorage.removeItem('user')

          setCurrentUser(null)
          setProgress(null)

          return
        }

        if (!response.ok) {
          return
        }

        const data = (await response.json()) as Progress

        setProgress(data)

        /*
         * Mission 완료 목록을 확인한 뒤
         * 완료사진도 함께 불러온다.
         */
        await loadCompletionPhotos(accessToken, data.completedMissionIds ?? [])
      } catch {
        /*
         * 공개 Challenge 화면 자체는 유지한다.
         */
      } finally {
        setProgressLoading(false)
      }
    },
    [loadCompletionPhotos],
  )

  useEffect(() => {
    async function loadPage() {
      if (!challengeId) {
        setError('Challenge 정보를 확인할 수 없습니다.')
        setLoading(false)

        return
      }

      try {
        /*
         * 공개 Challenge 상세 조회
         */
        const challengeResponse = await fetch(
          `${API_BASE_URL}/challenges/${challengeId}`,
          {
            cache: 'no-store',
          },
        )

        if (challengeResponse.status === 404) {
          setError('Challenge를 찾을 수 없습니다.')

          return
        }

        if (!challengeResponse.ok) {
          setError('Challenge 정보를 불러오지 못했습니다.')

          return
        }

        const challengeData =
          (await challengeResponse.json()) as ChallengeDetailResponse

        setChallenge({
          ...challengeData.challenge,

          hasCoverImage: Boolean(challengeData.challenge.hasCoverImage),

          coverImageUrl: challengeData.challenge.coverImageUrl ?? null,

          coverPositionX:
            typeof challengeData.challenge.coverPositionX === 'number'
              ? challengeData.challenge.coverPositionX
              : 50,

          coverPositionY:
            typeof challengeData.challenge.coverPositionY === 'number'
              ? challengeData.challenge.coverPositionY
              : 50,
        })

        setMissions(
          Array.isArray(challengeData.missions)
            ? challengeData.missions.map((mission) => ({
                ...mission,

                hasPhotoImage: Boolean(mission.hasPhotoImage),

                photoImageUrl: mission.photoImageUrl ?? null,

                photoPositionX:
                  typeof mission.photoPositionX === 'number'
                    ? mission.photoPositionX
                    : 50,

                photoPositionY:
                  typeof mission.photoPositionY === 'number'
                    ? mission.photoPositionY
                    : 50,
              }))
            : [],
        )

        /*
         * 로그인 상태 확인
         */
        const accessToken = sessionStorage.getItem('accessToken')

        if (!accessToken) {
          return
        }

        const meResponse = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })

        if (meResponse.status === 401) {
          sessionStorage.removeItem('accessToken')
          sessionStorage.removeItem('user')

          return
        }

        if (!meResponse.ok) {
          return
        }

        const meData = (await meResponse.json()) as AuthMeResponse

        const user = meData.user

        setCurrentUser(user)

        /*
         * USER일 때만 진행률 조회
         */
        if (user.role === 'USER') {
          await loadProgress(accessToken, challengeId)
        }
      } catch {
        setError('Challenge 정보를 불러오는 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }

    void loadPage()
  }, [challengeId, loadProgress])

  async function handleJoin() {
    if (!challengeId) {
      return
    }

    const accessToken = sessionStorage.getItem('accessToken')

    if (!accessToken) {
      router.push('/login')

      return
    }

    setJoining(true)
    setJoinError('')

    try {
      const response = await fetch(
        `${API_BASE_URL}/challenges/${challengeId}/join`,
        {
          method: 'POST',

          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      )

      if (response.status === 401) {
        sessionStorage.removeItem('accessToken')
        sessionStorage.removeItem('user')

        router.push('/login')

        return
      }

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        const message = Array.isArray(data?.message)
          ? data.message.join(', ')
          : data?.message

        throw new Error(message ?? 'Challenge 참여에 실패했습니다.')
      }

      await loadProgress(accessToken, challengeId)
    } catch (err) {
      if (err instanceof Error) {
        setJoinError(err.message)
      } else {
        setJoinError('Challenge 참여 중 오류가 발생했습니다.')
      }
    } finally {
      setJoining(false)
    }
  }

  function getCurrentPosition() {
    return new Promise<GeolocationPosition>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('현재 브라우저에서는 위치 정보를 사용할 수 없습니다.'))

        return
      }

      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,

        timeout: 15_000,

        maximumAge: 0,
      })
    })
  }

  function getGeolocationErrorMessage(error: unknown) {
    if (
      typeof GeolocationPositionError === 'undefined' ||
      !(error instanceof GeolocationPositionError)
    ) {
      if (error instanceof Error) {
        return error.message
      }

      return '현재 위치를 확인하지 못했습니다.'
    }

    switch (error.code) {
      case error.PERMISSION_DENIED:
        return '위치 권한이 거부되었습니다. 브라우저에서 위치 권한을 허용한 뒤 다시 시도해주세요.'

      case error.POSITION_UNAVAILABLE:
        return '현재 위치 정보를 확인할 수 없습니다. GPS 또는 위치 서비스를 확인해주세요.'

      case error.TIMEOUT:
        return '현재 위치를 확인하는 데 시간이 너무 오래 걸렸습니다. 잠시 후 다시 시도해주세요.'

      default:
        return '현재 위치를 확인하지 못했습니다.'
    }
  }

  function getResponseMessage(data: unknown, fallback: string) {
    if (typeof data === 'object' && data !== null && 'message' in data) {
      const message = (
        data as {
          message?: string | string[]
        }
      ).message

      if (Array.isArray(message)) {
        return message.join(', ')
      }

      if (typeof message === 'string') {
        return message
      }
    }

    return fallback
  }

  /*
   * QR 코드 안의 값에서 TripQuest 체크인 경로만 추출한다.
   *
   * 운영 주소, localhost 주소처럼 도메인이 달라도
   * /checkin/[token] 경로만 사용하므로 같은 로그인 탭에서 인증할 수 있다.
   */
  function getCheckinPathFromQr(decodedText: string) {
    const value = decodedText.trim()

    if (!value) {
      return null
    }

    try {
      const url = new URL(value, window.location.origin)

      const match = url.pathname.match(/^\/checkin\/([^/?#]+)\/?$/)

      if (!match?.[1]) {
        return null
      }

      return `/checkin/${match[1]}`
    } catch {
      return null
    }
  }

  function openQrScanner(mission: Mission) {
    if (!mission.qrActive || !mission.qrAvailable) {
      setMissionErrors((current) => ({
        ...current,

        [mission.id]: '현재 사용할 수 있는 Mission QR이 없습니다.',
      }))

      return
    }

    setMissionErrors((current) => ({
      ...current,

      [mission.id]: '',
    }))

    setQrScannerError('')
    setQrScannerMissionId(mission.id)
  }

  function closeQrScanner() {
    setQrScannerMissionId(null)
    setQrScannerStarting(false)
    setQrScannerError('')
  }

  useEffect(() => {
    if (qrScannerMissionId === null) {
      return
    }

    let disposed = false
    let handled = false
    let scanner: import('html5-qrcode').Html5Qrcode | null = null

    async function startScanner() {
      setQrScannerStarting(true)
      setQrScannerError('')

      try {
        const { Html5Qrcode } = await import('html5-qrcode')

        if (disposed) {
          return
        }

        scanner = new Html5Qrcode('tripquest-qr-reader')

        await scanner.start(
          {
            facingMode: 'environment',
          },
          {
            fps: 10,
            qrbox: {
              width: 240,
              height: 240,
            },
          },
          (decodedText) => {
            if (handled) {
              return
            }

            const checkinPath = getCheckinPathFromQr(decodedText)

            if (!checkinPath) {
              setQrScannerError(
                'TripQuest Mission QR이 아닙니다. 현장에 설치된 Mission QR을 화면 안에 맞춰주세요.',
              )

              return
            }

            handled = true

            void (async () => {
              try {
                await scanner?.stop()
              } catch {
                // 이미 중지된 경우는 무시한다.
              }

              try {
                scanner?.clear()
              } catch {
                // 정리 중 오류는 화면 이동을 막지 않는다.
              }

              if (disposed) {
                return
              }

              setQrScannerMissionId(null)
              setQrScannerStarting(false)
              setQrScannerError('')

              /*
               * 같은 브라우저 탭에서 이동하므로
               * 기존 sessionStorage 로그인 상태가 그대로 유지된다.
               */
              router.push(checkinPath)
            })()
          },
          () => {
            // 프레임마다 발생하는 QR 미검출 오류는 사용자에게 표시하지 않는다.
          },
        )

        if (!disposed) {
          setQrScannerStarting(false)
        }
      } catch (err) {
        if (disposed) {
          return
        }

        setQrScannerStarting(false)

        setQrScannerError(
          err instanceof Error
            ? `카메라를 시작하지 못했습니다. ${err.message}`
            : '카메라를 시작하지 못했습니다. 브라우저의 카메라 권한을 확인해주세요.',
        )
      }
    }

    void startScanner()

    return () => {
      disposed = true

      const activeScanner = scanner

      if (!activeScanner) {
        return
      }

      void activeScanner
        .stop()
        .catch(() => undefined)
        .finally(() => {
          try {
            activeScanner.clear()
          } catch {
            // 정리 중 오류는 무시한다.
          }
        })
    }
  }, [qrScannerMissionId, router])

  async function handleLocationVerification(mission: Mission) {
    if (!challengeId) {
      return
    }

    if (!currentUser) {
      router.push('/login')

      return
    }

    if (currentUser.role !== 'USER') {
      setMissionErrors((current) => ({
        ...current,

        [mission.id]: '여행자 계정에서만 Mission을 수행할 수 있습니다.',
      }))

      return
    }

    if (!progress?.joined) {
      setMissionErrors((current) => ({
        ...current,

        [mission.id]:
          '먼저 이 Challenge에 참여한 뒤 Mission 인증을 진행해주세요.',
      }))

      return
    }

    if (isMissionCompleted(mission.id)) {
      return
    }

    /*
     * LOCATION_AND_QR은
     * 현재 위치만으로 인증할 수 없다.
     */
    if (mission.verificationMode === 'LOCATION_AND_QR') {
      setMissionErrors((current) => ({
        ...current,

        [mission.id]:
          '이 Mission은 위치와 QR 인증이 모두 필요합니다. 현장 QR을 스캔해주세요.',
      }))

      return
    }

    const accessToken = sessionStorage.getItem('accessToken')

    if (!accessToken) {
      router.push('/login')

      return
    }

    setVerifyingMissionId(mission.id)

    setMissionErrors((current) => ({
      ...current,

      [mission.id]: '',
    }))

    setMissionMessages((current) => ({
      ...current,

      [mission.id]: '',
    }))

    try {
      const position = await getCurrentPosition()

      const latitude = position.coords.latitude
      const longitude = position.coords.longitude
      const accuracy = position.coords.accuracy

      const response = await fetch(
        `${API_BASE_URL}/mission-completions/verify`,
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',

            Authorization: `Bearer ${accessToken}`,
          },

          body: JSON.stringify({
            missionId: mission.id,

            latitude,

            longitude,

            accuracy,
          }),
        },
      )

      if (response.status === 401) {
        sessionStorage.removeItem('accessToken')
        sessionStorage.removeItem('user')

        router.push('/login')

        return
      }

      const data = (await response
        .json()
        .catch(() => null)) as MissionVerificationResult | null

      if (!response.ok) {
        throw new Error(
          getResponseMessage(data, 'Mission 위치 인증에 실패했습니다.'),
        )
      }

      const distanceMeters = data?.verification?.distanceMeters

      const successMessage =
        typeof distanceMeters === 'number'
          ? `Mission 인증이 완료되었습니다. Mission 장소와 약 ${distanceMeters}m 거리에서 인증되었습니다.`
          : getResponseMessage(data, 'Mission 인증이 완료되었습니다.')

      setMissionMessages((current) => ({
        ...current,

        [mission.id]: successMessage,
      }))

      /*
       * 인증 성공 후 진행률과 완료사진 상태를 다시 조회한다.
       */
      await loadProgress(accessToken, challengeId)
    } catch (err) {
      let message: string

      if (
        typeof GeolocationPositionError !== 'undefined' &&
        err instanceof GeolocationPositionError
      ) {
        message = getGeolocationErrorMessage(err)
      } else if (err instanceof Error) {
        message = err.message
      } else {
        message = 'Mission 인증 중 오류가 발생했습니다.'
      }

      setMissionErrors((current) => ({
        ...current,

        [mission.id]: message,
      }))
    } finally {
      setVerifyingMissionId(null)
    }
  }

  /*
   * 완료사진 선택
   */
  function handleCompletionPhotoSelect(
    missionId: number,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0]

    /*
     * 같은 파일을 다시 선택할 수 있도록 초기화
     */
    event.target.value = ''

    if (!file) {
      return
    }

    if (!ALLOWED_COMPLETION_PHOTO_TYPES.has(file.type)) {
      updateCompletionPhotoState(missionId, {
        error: 'JPG, JPEG, PNG, WEBP 사진만 등록할 수 있습니다.',
        message: '',
      })

      return
    }

    if (file.size <= 0) {
      updateCompletionPhotoState(missionId, {
        error: '비어 있는 사진은 등록할 수 없습니다.',
        message: '',
      })

      return
    }

    if (file.size > MAX_COMPLETION_PHOTO_SIZE) {
      updateCompletionPhotoState(missionId, {
        error: '완료사진은 최대 10MB까지 등록할 수 있습니다.',
        message: '',
      })

      return
    }

    const previousPreviewUrl = completionPhotos[missionId]?.previewUrl ?? null

    if (previousPreviewUrl) {
      URL.revokeObjectURL(previousPreviewUrl)
    }

    const previewUrl = URL.createObjectURL(file)

    updateCompletionPhotoState(missionId, {
      selectedFile: file,
      previewUrl,

      error: '',
      message: '',
    })
  }

  /*
   * 선택한 완료사진 취소
   */
  function cancelCompletionPhotoSelection(missionId: number) {
    const previewUrl = completionPhotos[missionId]?.previewUrl

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }

    updateCompletionPhotoState(missionId, {
      selectedFile: null,
      previewUrl: null,

      error: '',
      message: '',
    })
  }

  /*
   * 완료사진 등록 / 교체
   */
  async function handleCompletionPhotoUpload(missionId: number) {
    const photoState =
      completionPhotos[missionId] ?? createEmptyCompletionPhotoState()

    if (!photoState.selectedFile) {
      updateCompletionPhotoState(missionId, {
        error: '등록할 사진을 먼저 선택해주세요.',
        message: '',
      })

      return
    }

    const accessToken = sessionStorage.getItem('accessToken')

    if (!accessToken) {
      router.push('/login')

      return
    }

    updateCompletionPhotoState(missionId, {
      saving: true,
      error: '',
      message: '',
    })

    try {
      const formData = new FormData()

      formData.append('photoImage', photoState.selectedFile)

      const response = await fetch(
        `${API_BASE_URL}/mission-completions/${missionId}/photo`,
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

        router.push('/login')

        return
      }

      const data = (await response
        .json()
        .catch(() => null)) as CompletionPhotoResponse | null

      if (!response.ok) {
        throw new Error(
          getResponseMessage(data, '완료사진 등록에 실패했습니다.'),
        )
      }

      if (photoState.previewUrl) {
        URL.revokeObjectURL(photoState.previewUrl)
      }

      updateCompletionPhotoState(missionId, {
        saving: false,

        hasPhotoImage: true,
        photoImageUrl: data?.photoImageUrl ?? null,

        selectedFile: null,
        previewUrl: null,

        error: '',
        message:
          typeof data?.message === 'string'
            ? data.message
            : 'Mission 완료사진이 등록되었습니다.',
      })

      /*
       * Signed URL 생성이 일시적으로 실패했을 경우
       * GET으로 한 번 더 최신 상태를 조회한다.
       */
      if (!data?.photoImageUrl) {
        await loadCompletionPhotos(accessToken, [missionId])
      }
    } catch (err) {
      updateCompletionPhotoState(missionId, {
        saving: false,

        error:
          err instanceof Error
            ? err.message
            : '완료사진 등록 중 오류가 발생했습니다.',
      })
    }
  }

  /*
   * 완료사진 삭제
   */
  async function handleCompletionPhotoDelete(missionId: number) {
    const confirmed = window.confirm(
      '등록한 Mission 완료사진을 삭제하시겠습니까?\nMission 완료 기록은 그대로 유지됩니다.',
    )

    if (!confirmed) {
      return
    }

    const accessToken = sessionStorage.getItem('accessToken')

    if (!accessToken) {
      router.push('/login')

      return
    }

    updateCompletionPhotoState(missionId, {
      deleting: true,
      error: '',
      message: '',
    })

    try {
      const response = await fetch(
        `${API_BASE_URL}/mission-completions/${missionId}/photo`,
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

        router.push('/login')

        return
      }

      const data = (await response
        .json()
        .catch(() => null)) as CompletionPhotoResponse | null

      if (!response.ok) {
        throw new Error(
          getResponseMessage(data, '완료사진 삭제에 실패했습니다.'),
        )
      }

      const previewUrl = completionPhotos[missionId]?.previewUrl

      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }

      updateCompletionPhotoState(missionId, {
        deleting: false,

        hasPhotoImage: false,
        photoImageUrl: null,

        selectedFile: null,
        previewUrl: null,

        error: '',

        message:
          typeof data?.message === 'string'
            ? data.message
            : 'Mission 완료사진이 삭제되었습니다.',
      })
    } catch (err) {
      updateCompletionPhotoState(missionId, {
        deleting: false,

        error:
          err instanceof Error
            ? err.message
            : '완료사진 삭제 중 오류가 발생했습니다.',
      })
    }
  }

  function toggleMissionMap(missionId: number) {
    setExpandedMaps((current) => ({
      ...current,

      [missionId]: !current[missionId],
    }))
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

  function formatDateTime(date: string | null) {
    if (!date) {
      return '확인할 수 없음'
    }

    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date))
  }

  function getVerificationModeLabel(mode: VerificationMode) {
    switch (mode) {
      case 'LOCATION_ONLY':
        return '위치 인증'

      case 'LOCATION_AND_QR':
        return '위치 + QR'

      case 'LOCATION_OR_QR':
        return '위치 또는 QR'

      default:
        return '인증 방식 확인 필요'
    }
  }

  function getVerificationModeStyle(mode: VerificationMode) {
    switch (mode) {
      case 'LOCATION_ONLY':
        return 'bg-sky-100 text-sky-700'

      case 'LOCATION_AND_QR':
        return 'bg-violet-100 text-violet-700'

      case 'LOCATION_OR_QR':
        return 'bg-amber-100 text-amber-700'

      default:
        return 'bg-slate-100 text-slate-600'
    }
  }

  function isMissionCompleted(missionId: number) {
    return progress?.completedMissionIds.includes(missionId) ?? false
  }

  function canUseLocationVerification(mission: Mission) {
    return (
      mission.verificationMode === 'LOCATION_ONLY' ||
      mission.verificationMode === 'LOCATION_OR_QR'
    )
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
        <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">
            Challenge를 확인할 수 없습니다.
          </h1>

          <p className="mt-3 text-slate-600">
            {error || 'Challenge 정보를 불러오지 못했습니다.'}
          </p>

          <Link
            href="/"
            className="mt-6 inline-block font-bold text-sky-600 hover:text-sky-700"
          >
            ← Challenge 목록으로
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-20">
      {/* 상단 네비게이션 */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 transition hover:text-sky-600"
          >
            <span>←</span>
            <span>Challenge 목록</span>
          </Link>
        </div>
      </section>

      {/* Challenge Hero */}
      <section className="relative overflow-hidden bg-sky-700 text-white">
        {challenge.coverImageUrl ? (
          <>
            <img
              src={challenge.coverImageUrl}
              alt={`${challenge.title} Challenge 대표사진`}
              className="absolute inset-0 h-full w-full object-cover"
              style={{
                objectPosition: `${challenge.coverPositionX}% ${challenge.coverPositionY}%`,
              }}
            />

            <div className="absolute inset-0 bg-black/55" />

            <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/35 to-black/20" />
          </>
        ) : (
          <>
            <div className="absolute inset-0 bg-linear-to-br from-sky-600 via-sky-700 to-indigo-800" />

            <div className="absolute -right-28 -top-28 h-96 w-96 rounded-full bg-white/10" />

            <div className="absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-white/10" />
          </>
        )}

        <div className="relative mx-auto flex min-h-105 max-w-6xl items-end px-4 py-10 sm:px-6 sm:py-14">
          <div className="max-w-3xl">
            <div className="mb-5 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/20 bg-black/20 px-3 py-1.5 text-xs font-bold backdrop-blur">
                📍 {challenge.region ?? '지역 미정'}
              </span>

              <span className="rounded-full border border-white/20 bg-emerald-500/80 px-3 py-1.5 text-xs font-bold shadow-sm backdrop-blur">
                {challenge.status === 'ACTIVE' ? '운영 중' : challenge.status}
              </span>
            </div>

            <h1 className="text-3xl font-black tracking-tight sm:text-5xl">
              {challenge.title}
            </h1>

            <p className="mt-4 max-w-2xl whitespace-pre-wrap text-sm leading-7 text-white/85 sm:text-base">
              {challenge.description ?? 'Challenge 설명이 없습니다.'}
            </p>

            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-white/80">
              <span>시작 {formatDate(challenge.startAt)}</span>

              <span className="hidden text-white/40 sm:inline">•</span>

              <span>종료 {formatDate(challenge.endAt)}</span>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        {/* 참여 / 진행률 */}
        <section className="mb-12">
          {!currentUser ? (
            <div className="rounded-3xl border border-sky-100 bg-white p-6 shadow-sm sm:p-8">
              <div className="max-w-2xl">
                <p className="text-sm font-bold text-sky-600">
                  여행을 시작해보세요
                </p>

                <h2 className="mt-2 text-2xl font-black text-slate-900">
                  Challenge에 참여하려면 로그인이 필요합니다.
                </h2>

                <p className="mt-3 leading-7 text-slate-600">
                  여행자 계정으로 로그인하면 Mission 진행 상황을 기록하고
                  현장에서 인증할 수 있습니다.
                </p>

                <Link
                  href="/login"
                  className="mt-6 inline-flex rounded-xl bg-sky-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-sky-700"
                >
                  로그인하고 참여하기
                </Link>
              </div>
            </div>
          ) : currentUser.role !== 'USER' ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="text-xl font-black text-slate-900">
                여행자 전용 Challenge
              </h2>

              <p className="mt-2 text-slate-600">
                Challenge 참여와 Mission 수행은 여행자 계정에서 사용할 수
                있습니다.
              </p>
            </div>
          ) : progressLoading && !progress ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
              <p className="font-semibold text-slate-500">
                참여 상태를 확인하는 중...
              </p>
            </div>
          ) : progress?.joined ? (
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="p-6 sm:p-8">
                <div className="flex flex-wrap items-end justify-between gap-5">
                  <div>
                    <p className="text-sm font-bold text-emerald-600">
                      여행 진행도
                    </p>

                    <div className="mt-2 flex items-end gap-3">
                      <p className="text-3xl font-black text-slate-900 sm:text-4xl">
                        {progress.completedMissionCount}
                        <span className="text-lg font-bold text-slate-400">
                          {' '}
                          / {progress.totalMissionCount}
                        </span>
                      </p>

                      <p className="pb-1 text-sm font-bold text-slate-500">
                        Mission 완료
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-4xl font-black text-emerald-600">
                      {progress.progressPercent}%
                    </p>

                    {progress.completed && (
                      <p className="mt-1 text-sm font-bold text-emerald-600">
                        🎉 Challenge 완료
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-6 h-3 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(0, progress.progressPercent),
                      )}%`,
                    }}
                  />
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
                  <p className="text-slate-500">
                    참여일 {formatDateTime(progress.joinedAt)}
                  </p>

                  {!progress.completed && (
                    <p className="font-semibold text-slate-600">
                      다음 Mission을 방문해보세요.
                    </p>
                  )}
                </div>

                {progress.completed && (
                  <div className="mt-6 rounded-2xl bg-emerald-50 p-4">
                    <p className="font-bold text-emerald-700">
                      모든 Mission을 완료했습니다.
                    </p>

                    <p className="mt-1 text-sm leading-6 text-emerald-700">
                      완료한 Mission에 여행 사진을 남겨보세요.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-sky-100 bg-white p-6 shadow-sm sm:p-8">
              <p className="text-sm font-bold text-sky-600">
                아직 참여하지 않았습니다
              </p>

              <h2 className="mt-2 text-2xl font-black text-slate-900">
                이 여행을 시작하시겠어요?
              </h2>

              <p className="mt-3 max-w-2xl leading-7 text-slate-600">
                참여하면 Mission 완료 현황이 저장되고 현장 인증 기능을 사용할 수
                있습니다.
              </p>

              {joinError && (
                <div className="mt-5 rounded-xl bg-red-50 p-4">
                  <p className="text-sm font-semibold text-red-700">
                    {joinError}
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={handleJoin}
                disabled={joining}
                className="mt-6 rounded-xl bg-sky-600 px-7 py-3 text-sm font-bold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {joining ? '참여 처리 중...' : 'Challenge 참여하기'}
              </button>
            </div>
          )}
        </section>

        {/* Mission */}
        <section>
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-sky-600">TRIP QUEST</p>

              <h2 className="mt-1 text-3xl font-black text-slate-900">
                Mission
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-500 sm:text-base">
                장소를 방문하고 인증해서 여행 기록을 완성해보세요.
              </p>
            </div>

            <p className="rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-500 shadow-sm">
              총 {missions.length}개
            </p>
          </div>

          {missions.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
              <p className="text-slate-600">등록된 Mission이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {missions.map((mission, index) => {
                const completed = isMissionCompleted(mission.id)

                const verifying = verifyingMissionId === mission.id

                const locationAvailable = canUseLocationVerification(mission)

                const mapExpanded = expandedMaps[mission.id] ?? false

                const photoState =
                  completionPhotos[mission.id] ??
                  createEmptyCompletionPhotoState()

                const displayCompletionPhoto =
                  photoState.previewUrl ?? photoState.photoImageUrl

                return (
                  <article
                    key={mission.id}
                    className={`overflow-hidden rounded-3xl border bg-white shadow-sm transition ${
                      completed
                        ? 'border-emerald-200 shadow-emerald-100/40'
                        : 'border-slate-200'
                    }`}
                  >
                    {/* 상단 관광지 카드 */}
                    <div className="grid lg:grid-cols-[44%_56%]">
                      <MissionPhoto mission={mission} completed={completed} />

                      <div className="flex flex-col p-5 sm:p-7 lg:p-8">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="flex min-w-0 items-start gap-3">
                            <div
                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                                completed
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-sky-100 text-sky-700'
                              }`}
                            >
                              {completed ? '✓' : index + 1}
                            </div>

                            <div className="min-w-0">
                              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                                Mission {String(index + 1).padStart(2, '0')}
                              </p>

                              <h3 className="mt-1 text-xl font-black text-slate-900 sm:text-2xl">
                                {mission.title}
                              </h3>
                            </div>
                          </div>

                          <span
                            className={`rounded-full px-3 py-1.5 text-xs font-bold ${getVerificationModeStyle(
                              mission.verificationMode,
                            )}`}
                          >
                            {getVerificationModeLabel(mission.verificationMode)}
                          </span>
                        </div>

                        {mission.address && (
                          <p className="mt-5 flex gap-2 text-sm leading-6 text-slate-500">
                            <span aria-hidden="true">📍</span>

                            <span>{mission.address}</span>
                          </p>
                        )}

                        <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-600 sm:text-base">
                          {mission.description ?? 'Mission 설명이 없습니다.'}
                        </p>

                        <div className="mt-6 flex flex-wrap gap-2">
                          <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">
                            인증 반경 {mission.verificationRadius}m
                          </span>

                          <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">
                            {getVerificationModeLabel(mission.verificationMode)}
                          </span>
                        </div>

                        {mission.qrLocationNote && (
                          <div className="mt-5 rounded-2xl bg-violet-50 p-4">
                            <p className="text-xs font-bold text-violet-500">
                              QR 설치 위치
                            </p>

                            <p className="mt-1 text-sm font-semibold leading-6 text-violet-700">
                              {mission.qrLocationNote}
                            </p>
                          </div>
                        )}

                        {/* 지도 접기 / 펼치기 */}
                        <div className="mt-6">
                          <button
                            type="button"
                            onClick={() => toggleMissionMap(mission.id)}
                            className="flex w-full items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-left text-sm font-bold text-slate-700 transition hover:border-sky-200 hover:bg-sky-50"
                          >
                            <span className="flex items-center gap-2">
                              <span aria-hidden="true">🗺️</span>

                              <span>
                                {mapExpanded
                                  ? '지도 접기'
                                  : 'Mission 위치 지도 보기'}
                              </span>
                            </span>

                            <span className="text-slate-400">
                              {mapExpanded ? '▲' : '▼'}
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* 펼친 지도 */}
                    {mapExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50 p-4 sm:p-6">
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="font-bold text-slate-900">
                              Mission 인증 위치
                            </p>

                            <p className="mt-1 text-sm text-slate-500">
                              지도에 표시된 원 안에서 위치 인증을 진행할 수
                              있습니다.
                            </p>
                          </div>

                          <span className="rounded-full bg-sky-100 px-3 py-1.5 text-xs font-bold text-sky-700">
                            인증 가능 범위 {mission.verificationRadius}m
                          </span>
                        </div>

                        <MissionLocationMap
                          latitude={mission.latitude}
                          longitude={mission.longitude}
                          radius={mission.verificationRadius}
                          readOnly
                        />
                      </div>
                    )}

                    {/* 인증 오류 */}
                    {missionErrors[mission.id] && (
                      <div className="border-t border-red-100 bg-red-50 px-5 py-4 sm:px-7">
                        <p className="text-sm font-semibold leading-6 text-red-700">
                          {missionErrors[mission.id]}
                        </p>
                      </div>
                    )}

                    {/* 인증 성공 메시지 */}
                    {missionMessages[mission.id] && (
                      <div className="border-t border-emerald-100 bg-emerald-50 px-5 py-4 sm:px-7">
                        <p className="text-sm font-semibold leading-6 text-emerald-700">
                          {missionMessages[mission.id]}
                        </p>
                      </div>
                    )}

                    {/* 완료 Mission */}
                    {completed ? (
                      <div className="border-t border-emerald-100 bg-emerald-50/50 p-5 sm:p-7">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-black text-emerald-700">
                              ✓ Mission 완료
                            </p>

                            <p className="mt-1 text-sm leading-6 text-slate-600">
                              이 장소에서 찍은 사진을 여행 기록으로 남길 수
                              있습니다.
                            </p>
                          </div>

                          {photoState.hasPhotoImage && (
                            <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-700">
                              사진 등록됨
                            </span>
                          )}
                        </div>

                        {photoState.loading ? (
                          <div className="mt-5 rounded-2xl bg-white p-6 text-center">
                            <p className="text-sm font-semibold text-slate-500">
                              완료사진을 불러오는 중...
                            </p>
                          </div>
                        ) : (
                          <>
                            {/* 기존 사진 또는 새 선택 사진 */}
                            {displayCompletionPhoto && (
                              <div className="mt-5">
                                <CompletionPhotoPreview
                                  missionTitle={mission.title}
                                  photoImageUrl={displayCompletionPhoto}
                                />

                                {photoState.previewUrl && (
                                  <p className="mt-2 text-xs font-semibold text-sky-600">
                                    새로 선택한 사진 미리보기
                                  </p>
                                )}
                              </div>
                            )}

                            {!displayCompletionPhoto && (
                              <div className="mt-5 flex min-h-44 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white px-6 text-center">
                                <span className="text-4xl" aria-hidden="true">
                                  📷
                                </span>

                                <p className="mt-3 font-bold text-slate-700">
                                  여행 사진을 남겨보세요
                                </p>

                                <p className="mt-1 text-xs leading-5 text-slate-500">
                                  JPG, PNG, WEBP · 최대 10MB
                                </p>
                              </div>
                            )}

                            <div className="mt-5 flex flex-wrap gap-3">
                              <label className="cursor-pointer rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:border-sky-300 hover:text-sky-700">
                                {photoState.hasPhotoImage
                                  ? '새 사진 선택'
                                  : '사진 선택'}

                                <input
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp"
                                  className="hidden"
                                  disabled={
                                    photoState.saving || photoState.deleting
                                  }
                                  onChange={(event) =>
                                    handleCompletionPhotoSelect(
                                      mission.id,
                                      event,
                                    )
                                  }
                                />
                              </label>

                              {photoState.selectedFile && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleCompletionPhotoUpload(
                                        mission.id,
                                      )
                                    }
                                    disabled={photoState.saving}
                                    className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                                  >
                                    {photoState.saving
                                      ? '사진 저장 중...'
                                      : photoState.hasPhotoImage
                                        ? '사진 교체하기'
                                        : '사진 등록하기'}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      cancelCompletionPhotoSelection(mission.id)
                                    }
                                    disabled={photoState.saving}
                                    className="rounded-xl bg-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    선택 취소
                                  </button>
                                </>
                              )}

                              {photoState.hasPhotoImage &&
                                !photoState.selectedFile && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleCompletionPhotoDelete(
                                        mission.id,
                                      )
                                    }
                                    disabled={photoState.deleting}
                                    className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {photoState.deleting
                                      ? '삭제 중...'
                                      : '사진 삭제'}
                                  </button>
                                )}
                            </div>

                            {photoState.error && (
                              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
                                <p className="text-sm font-semibold text-red-700">
                                  {photoState.error}
                                </p>
                              </div>
                            )}

                            {photoState.message && (
                              <div className="mt-4 rounded-xl border border-emerald-200 bg-white p-4">
                                <p className="text-sm font-semibold text-emerald-700">
                                  {photoState.message}
                                </p>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    ) : currentUser?.role === 'USER' && progress?.joined ? (
                      <div className="border-t border-slate-100 bg-slate-50 p-5 sm:p-7">
                        {locationAvailable && (
                          <div>
                            <p className="font-bold text-slate-800">
                              현장에서 Mission을 인증하세요
                            </p>

                            <p className="mt-1 text-sm leading-6 text-slate-500">
                              현재 위치가 Mission 인증 범위 안에 있어야 합니다.
                            </p>

                            <button
                              type="button"
                              onClick={() =>
                                void handleLocationVerification(mission)
                              }
                              disabled={verifying}
                              className="mt-4 w-full rounded-xl bg-sky-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto"
                            >
                              {verifying
                                ? '현재 위치 확인 중...'
                                : '현재 위치로 인증하기'}
                            </button>
                          </div>
                        )}

                        {mission.verificationMode === 'LOCATION_OR_QR' && (
                          <div
                            className={`${
                              locationAvailable
                                ? 'mt-5 border-t border-slate-200 pt-5'
                                : ''
                            }`}
                          >
                            <p className="text-sm font-bold text-amber-700">
                              또는 현장 QR로 인증할 수 있습니다.
                            </p>

                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              로그인 상태를 유지한 채 TripQuest 안에서 카메라를
                              열어 현장 QR을 스캔할 수 있습니다.
                            </p>

                            {mission.qrActive && mission.qrAvailable ? (
                              <button
                                type="button"
                                onClick={() => openQrScanner(mission)}
                                className="mt-4 w-full rounded-xl bg-amber-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-amber-600 sm:w-auto"
                              >
                                📷 QR 스캔하기
                              </button>
                            ) : (
                              <p className="mt-3 text-xs font-semibold text-slate-400">
                                현재 사용할 수 있는 QR이 없습니다.
                              </p>
                            )}
                          </div>
                        )}

                        {mission.verificationMode === 'LOCATION_AND_QR' && (
                          <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
                            <p className="font-bold text-violet-700">
                              📱 위치 + QR 인증 Mission
                            </p>

                            <p className="mt-2 text-sm leading-6 text-violet-700">
                              관광지에 도착한 뒤 아래 버튼으로 카메라를 열어
                              현장 QR을 스캔해주세요. QR 인증 화면에서 현재
                              위치도 함께 확인합니다.
                            </p>

                            {mission.qrActive && mission.qrAvailable ? (
                              <button
                                type="button"
                                onClick={() => openQrScanner(mission)}
                                className="mt-4 w-full rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-violet-700 sm:w-auto"
                              >
                                📷 QR 스캔하기
                              </button>
                            ) : (
                              <p className="mt-3 text-xs font-semibold text-violet-400">
                                현재 사용할 수 있는 QR이 없습니다.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ) : currentUser?.role === 'USER' ? (
                      <div className="border-t border-slate-100 bg-slate-50 p-5 sm:p-7">
                        <p className="text-sm font-semibold text-slate-600">
                          이 Challenge에 참여한 뒤 Mission 인증을 진행할 수
                          있습니다.
                        </p>
                      </div>
                    ) : null}
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {qrScannerMissionId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-5">
              <div>
                <p className="text-xs font-black tracking-widest text-violet-600">
                  MISSION QR SCANNER
                </p>

                <h2 className="mt-1 text-xl font-black text-slate-900">
                  현장 QR 스캔
                </h2>

                <p className="mt-1 text-sm leading-6 text-slate-500">
                  {
                    missions.find(
                      (mission) => mission.id === qrScannerMissionId,
                    )?.title
                  }
                </p>
              </div>

              <button
                type="button"
                onClick={closeQrScanner}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xl font-bold text-slate-600 transition hover:bg-slate-200"
                aria-label="QR 스캐너 닫기"
              >
                ×
              </button>
            </div>

            <div className="p-5">
              <div className="overflow-hidden rounded-2xl bg-black p-2">
                <div
                  id="tripquest-qr-reader"
                  className="min-h-72 overflow-hidden rounded-xl bg-black"
                />
              </div>

              {qrScannerStarting && (
                <div className="mt-4 rounded-xl bg-slate-50 p-4 text-center">
                  <p className="text-sm font-semibold text-slate-600">
                    카메라를 준비하는 중...
                  </p>
                </div>
              )}

              {qrScannerError && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
                  <p className="text-sm font-semibold leading-6 text-red-700">
                    {qrScannerError}
                  </p>
                </div>
              )}

              <div className="mt-4 rounded-xl bg-violet-50 p-4">
                <p className="text-sm font-bold text-violet-700">
                  QR을 사각형 안에 맞춰주세요.
                </p>

                <p className="mt-1 text-xs leading-5 text-violet-600">
                  QR을 인식하면 같은 로그인 화면에서 Mission 인증 페이지로 자동
                  이동합니다.
                </p>
              </div>

              <button
                type="button"
                onClick={closeQrScanner}
                className="mt-4 w-full rounded-xl bg-slate-200 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-300"
              >
                스캔 취소
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
