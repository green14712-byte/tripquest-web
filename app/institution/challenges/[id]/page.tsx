'use client'

import Link from 'next/link'
import QRCode from 'qrcode'
import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

type VerificationMode = 'LOCATION_ONLY' | 'LOCATION_AND_QR' | 'LOCATION_OR_QR'
type MissionStatus = 'ACTIVE' | 'INACTIVE'
type ChallengeStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ENDED' | 'ARCHIVED'
type ChallengeDisplayStatus =
  | 'DRAFT'
  | 'UPCOMING'
  | 'OPEN'
  | 'EXPIRED'
  | 'PAUSED'
  | 'ENDED'
  | 'ARCHIVED'

type Challenge = {
  id: number
  title: string
  description: string | null
  region: string | null
  status: ChallengeStatus
  startAt: string | null
  endAt: string | null
  institutionId: number
  createdAt: string
  updatedAt: string
}

type Mission = {
  id: number
  title: string
  description: string | null
  address: string | null
  hasPhotoImage: boolean
  photoImageUrl: string | null
  status: MissionStatus
  latitude: number
  longitude: number
  verificationRadius: number
  verificationMode: VerificationMode
  qrLocationNote: string | null
  qrActive: boolean
  qrAvailable: boolean
  sortOrder: number
  challengeId: number
  completionCount: number
  hasCompletion: boolean
  createdAt: string
  updatedAt: string
}

type QrModalState = {
  missionId: number
  missionTitle: string
  qrDataUrl: string
  qrUrl: string
  qrActive: boolean
  missionStatus: MissionStatus
}

const API_BASE = 'http://localhost:3001'

function responseMessage(data: unknown, fallback: string) {
  if (typeof data === 'object' && data !== null && 'message' in data) {
    const message = (data as { message?: string | string[] }).message

    if (Array.isArray(message)) return message.join(', ')
    if (typeof message === 'string') return message
  }

  return fallback
}

function getDisplayStatus(
  challenge: Challenge,
  nowValue: number,
): ChallengeDisplayStatus {
  if (challenge.status !== 'ACTIVE') return challenge.status

  const now = new Date(nowValue)

  if (challenge.startAt && now < new Date(challenge.startAt)) {
    return 'UPCOMING'
  }

  if (challenge.endAt && now >= new Date(challenge.endAt)) {
    return 'EXPIRED'
  }

  return 'OPEN'
}

function statusLabel(status: ChallengeDisplayStatus) {
  const labels: Record<ChallengeDisplayStatus, string> = {
    DRAFT: '준비 중',
    UPCOMING: '운영 예정',
    OPEN: '운영 중',
    EXPIRED: '운영시간 종료',
    PAUSED: '운영 중단',
    ENDED: '최종 종료',
    ARCHIVED: '보관',
  }

  return labels[status]
}

function statusStyle(status: ChallengeDisplayStatus) {
  const styles: Record<ChallengeDisplayStatus, string> = {
    DRAFT: 'bg-slate-100 text-slate-700',
    UPCOMING: 'bg-sky-100 text-sky-700',
    OPEN: 'bg-emerald-100 text-emerald-700',
    EXPIRED: 'bg-orange-100 text-orange-700',
    PAUSED: 'bg-amber-100 text-amber-700',
    ENDED: 'bg-red-100 text-red-700',
    ARCHIVED: 'bg-slate-200 text-slate-600',
  }

  return styles[status]
}

function verificationLabel(mode: VerificationMode) {
  const labels: Record<VerificationMode, string> = {
    LOCATION_ONLY: '위치 인증만',
    LOCATION_AND_QR: '위치 + QR 둘 다',
    LOCATION_OR_QR: '위치 또는 QR',
  }

  return labels[mode]
}

function verificationStyle(mode: VerificationMode) {
  const styles: Record<VerificationMode, string> = {
    LOCATION_ONLY: 'bg-sky-100 text-sky-700',
    LOCATION_AND_QR: 'bg-violet-100 text-violet-700',
    LOCATION_OR_QR: 'bg-amber-100 text-amber-700',
  }

  return styles[mode]
}

function formatDateTime(value: string | null) {
  return value ? new Date(value).toLocaleString('ko-KR') : '미설정'
}

/*
 * Mission 관광지 대표사진
 *
 * Private Storage의 Signed URL만 사용한다.
 * 내부 Storage Key는 화면에 노출하지 않는다.
 */
function MissionPhoto({ mission }: { mission: Mission }) {
  const [imageError, setImageError] = useState(false)

  useEffect(() => {
    setImageError(false)
  }, [mission.photoImageUrl])

  const hasUrl = Boolean(mission.photoImageUrl)
  const canDisplay = hasUrl && !imageError

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
      {canDisplay ? (
        <img
          src={mission.photoImageUrl!}
          alt={`${mission.title} 관광지 대표사진`}
          className="h-52 w-full bg-slate-100 object-cover sm:h-60"
          onError={() => setImageError(true)}
        />
      ) : (
        <div className="flex h-52 flex-col items-center justify-center px-5 text-center sm:h-60">
          <span className="text-5xl" aria-hidden="true">
            🏞️
          </span>

          <p className="mt-3 text-sm font-bold text-slate-600">
            {!mission.hasPhotoImage
              ? '등록된 관광지 대표사진이 없습니다.'
              : '관광지 대표사진을 불러올 수 없습니다.'}
          </p>

          <p className="mt-1 text-xs leading-5 text-slate-400">
            {!mission.hasPhotoImage
              ? 'Mission 수정 화면에서 대표사진을 등록할 수 있습니다.'
              : '사진 URL이 만료되었거나 일시적으로 불러오지 못했습니다.'}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-4 py-3">
        <span className="text-xs font-bold text-slate-500">
          관광지 대표사진
        </span>

        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            !mission.hasPhotoImage
              ? 'bg-slate-100 text-slate-500'
              : canDisplay
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-amber-100 text-amber-700'
          }`}
        >
          {!mission.hasPhotoImage
            ? '미등록'
            : canDisplay
              ? '등록 완료'
              : '조회 불가'}
        </span>
      </div>
    </div>
  )
}

export default function InstitutionChallengeDetailPage() {
  const router = useRouter()
  const params = useParams()

  const challengeId = Array.isArray(params.id) ? params.id[0] : params.id

  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [missions, setMissions] = useState<Mission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [currentTime, setCurrentTime] = useState(Date.now())

  const [operationLoading, setOperationLoading] = useState('')
  const [operationMessage, setOperationMessage] = useState('')
  const [operationError, setOperationError] = useState('')

  const [missionStatusActionId, setMissionStatusActionId] = useState<
    number | null
  >(null)

  const [missionDeleteActionId, setMissionDeleteActionId] = useState<
    number | null
  >(null)

  const [missionMessage, setMissionMessage] = useState('')
  const [missionError, setMissionError] = useState('')

  const [qrModal, setQrModal] = useState<QrModalState | null>(null)

  const [qrLoadingMissionId, setQrLoadingMissionId] = useState<number | null>(
    null,
  )

  const [qrActionMissionId, setQrActionMissionId] = useState<number | null>(
    null,
  )

  const [qrMessage, setQrMessage] = useState('')
  const [qrError, setQrError] = useState('')

  const canManageMissions =
    challenge?.status === 'DRAFT' || challenge?.status === 'PAUSED'

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(Date.now())
    }, 30_000)

    return () => window.clearInterval(timer)
  }, [])

  const handleUnauthorized = useCallback(() => {
    sessionStorage.removeItem('accessToken')
    sessionStorage.removeItem('user')
    router.replace('/login')
  }, [router])

  const getAccessToken = useCallback(() => {
    const token = sessionStorage.getItem('accessToken')

    if (!token) {
      router.replace('/login')
      return null
    }

    return token
  }, [router])

  /*
   * 기관 소유 Challenge와 Mission 조회
   */
  const loadChallenge = useCallback(async () => {
    const token = getAccessToken()

    if (!token) return

    if (!challengeId) {
      setError('Challenge 정보를 확인할 수 없습니다.')
      setLoading(false)
      return
    }

    try {
      const response = await fetch(
        `${API_BASE}/challenges/institution/${challengeId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: 'no-store',
        },
      )

      if (response.status === 401) {
        handleUnauthorized()
        return
      }

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(
          responseMessage(data, 'Challenge 정보를 불러오지 못했습니다.'),
        )
      }

      setChallenge(data.challenge)

      setMissions(
        Array.isArray(data.missions)
          ? data.missions.map((mission: Mission) => ({
              ...mission,
              hasPhotoImage: Boolean(mission.hasPhotoImage),
              photoImageUrl: mission.photoImageUrl ?? null,
            }))
          : [],
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Challenge 정보를 불러오는 중 오류가 발생했습니다.',
      )
    } finally {
      setLoading(false)
    }
  }, [challengeId, getAccessToken, handleUnauthorized])

  useEffect(() => {
    void loadChallenge()
  }, [loadChallenge])

  /*
   * POST / DELETE 공통 처리
   *
   * 중요:
   * QR 조회는 이 함수를 사용하지 않는다.
   * 조회는 GET으로 별도 수행한다.
   */
  async function request(
    path: string,
    method: 'POST' | 'DELETE',
    fallback: string,
  ) {
    const token = getAccessToken()

    if (!token) return null

    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (response.status === 401) {
      handleUnauthorized()
      return null
    }

    const data = await response.json().catch(() => null)

    if (!response.ok) {
      throw new Error(responseMessage(data, fallback))
    }

    return data
  }

  /*
   * Challenge 최초 운영 활성화
   */
  async function handleActivateChallenge() {
    if (!challenge) return

    if (!missions.some((mission) => mission.status === 'ACTIVE')) {
      setOperationError(
        '활성화된 Mission을 하나 이상 준비해야 Challenge 운영을 시작할 수 있습니다.',
      )
      return
    }

    const futureStart = Boolean(
      challenge.startAt && new Date(challenge.startAt) > new Date(),
    )

    const message = futureStart
      ? `Challenge 운영 예약을 활성화하시겠습니까?\n\n설정된 운영 시작 일시(${formatDateTime(challenge.startAt)})가 되면 여행자에게 공개됩니다.`
      : 'Challenge 운영을 시작하시겠습니까?\n\n운영을 시작하면 여행자에게 공개되고 참여 및 인증이 가능해집니다.'

    if (!window.confirm(message)) return

    await executeChallengeOperation(
      'activate',
      futureStart
        ? 'Challenge 운영 예약이 활성화되었습니다.'
        : 'Challenge 운영이 시작되었습니다.',
    )
  }

  /*
   * Challenge 운영 중단
   */
  async function handlePauseChallenge() {
    const confirmed = window.confirm(
      'Challenge 운영을 일시 중단하시겠습니까?\n\n운영 중단 동안 여행자는 Challenge에 참여하거나 Mission 인증을 할 수 없습니다.\n\n기관은 정보를 수정한 뒤 다시 운영할 수 있습니다.',
    )

    if (!confirmed) return

    await executeChallengeOperation(
      'pause',
      'Challenge 운영이 일시 중단되었습니다.',
    )
  }

  /*
   * Challenge 운영 재개
   */
  async function handleResumeChallenge() {
    if (!challenge) return

    if (!missions.some((mission) => mission.status === 'ACTIVE')) {
      setOperationError(
        '활성화된 Mission을 하나 이상 준비해야 Challenge 운영을 재개할 수 있습니다.',
      )
      return
    }

    if (
      !window.confirm(
        'Challenge 운영을 다시 시작하시겠습니까?\n\n운영을 재개하면 여행자에게 다시 공개됩니다.',
      )
    ) {
      return
    }

    await executeChallengeOperation(
      'resume',
      'Challenge 운영이 다시 시작되었습니다.',
    )
  }

  /*
   * Challenge 최종 종료
   */
  async function handleEndChallenge() {
    if (
      !window.confirm(
        'Challenge를 최종 종료하시겠습니까?\n\n최종 종료 후에는 다시 운영할 수 없습니다.\n기존 참여 및 완료 기록은 보존됩니다.',
      )
    ) {
      return
    }

    if (
      !window.confirm(
        '마지막 확인입니다.\n\n일시 중단이 아니라 Challenge를 최종 종료하시겠습니까?',
      )
    ) {
      return
    }

    await executeChallengeOperation('end', 'Challenge가 최종 종료되었습니다.')
  }

  /*
   * Challenge 운영 상태 변경 공통 처리
   */
  async function executeChallengeOperation(
    action: 'activate' | 'pause' | 'resume' | 'end',
    fallback: string,
  ) {
    if (!challenge) return

    setOperationLoading(action)
    setOperationMessage('')
    setOperationError('')

    try {
      const data = await request(
        `/challenges/${challenge.id}/${action}`,
        'POST',
        'Challenge 운영 상태 변경에 실패했습니다.',
      )

      if (!data) return

      if (data.challenge) {
        setChallenge(data.challenge)
      }

      setOperationMessage(responseMessage(data, fallback))
    } catch (err) {
      setOperationError(
        err instanceof Error
          ? err.message
          : 'Challenge 운영 상태 변경 중 오류가 발생했습니다.',
      )
    } finally {
      setOperationLoading('')
    }
  }

  /*
   * Challenge 삭제
   */
  async function handleDeleteChallenge() {
    if (!challenge) return

    if (challenge.status !== 'DRAFT') {
      setOperationError('운영 전 DRAFT Challenge만 삭제할 수 있습니다.')
      return
    }

    if (
      !window.confirm(
        `정말 이 Challenge를 삭제하시겠습니까?\n\n"${challenge.title}"\n\n등록된 Mission도 함께 삭제되며 복구할 수 없습니다.`,
      )
    ) {
      return
    }

    if (
      !window.confirm(
        '마지막 확인입니다.\n\nChallenge를 완전히 삭제하시겠습니까?',
      )
    ) {
      return
    }

    setOperationLoading('delete')
    setOperationMessage('')
    setOperationError('')

    try {
      const data = await request(
        `/challenges/${challenge.id}`,
        'DELETE',
        'Challenge 삭제에 실패했습니다.',
      )

      if (data) {
        router.replace('/institution/challenges')
      }
    } catch (err) {
      setOperationError(
        err instanceof Error
          ? err.message
          : 'Challenge 삭제 중 오류가 발생했습니다.',
      )
    } finally {
      setOperationLoading('')
    }
  }

  /*
   * Mission 활성화 / 비활성화
   */
  async function handleToggleMissionStatus(mission: Mission) {
    if (!canManageMissions) {
      setMissionError(
        'Mission 상태를 변경하려면 Challenge를 DRAFT 또는 PAUSED 상태로 전환해주세요.',
      )
      return
    }

    const nextActive = mission.status === 'INACTIVE'

    const confirmed = window.confirm(
      nextActive
        ? `Mission을 다시 활성화하시겠습니까?\n\n"${mission.title}"\n\n현재 Challenge 완료 조건에 다시 포함됩니다.`
        : `Mission을 비활성화하시겠습니까?\n\n"${mission.title}"\n\n기존 완료 기록과 QR 정보는 보존됩니다.`,
    )

    if (!confirmed) return

    setMissionStatusActionId(mission.id)
    setMissionMessage('')
    setMissionError('')

    try {
      const action = nextActive ? 'activate' : 'deactivate'

      const data = await request(
        `/missions/${mission.id}/${action}`,
        'POST',
        'Mission 상태 변경에 실패했습니다.',
      )

      if (!data) return

      const nextStatus: MissionStatus =
        data.mission?.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE'

      setMissions((current) =>
        current.map((item) =>
          item.id === mission.id
            ? {
                ...item,
                status: nextStatus,
              }
            : item,
        ),
      )

      setQrModal((current) =>
        current?.missionId === mission.id
          ? {
              ...current,
              missionStatus: nextStatus,
            }
          : current,
      )

      setMissionMessage(
        responseMessage(
          data,
          nextActive
            ? 'Mission이 다시 활성화되었습니다.'
            : 'Mission이 비활성화되었습니다. 기존 완료 기록은 보존됩니다.',
        ),
      )
    } catch (err) {
      setMissionError(
        err instanceof Error
          ? err.message
          : 'Mission 상태 변경 중 오류가 발생했습니다.',
      )
    } finally {
      setMissionStatusActionId(null)
    }
  }

  /*
   * Mission 물리 삭제
   *
   * 완료 기록이 있으면 삭제 불가
   */
  async function handleDeleteMission(mission: Mission) {
    if (!canManageMissions) {
      setMissionError(
        'Mission을 삭제하려면 Challenge를 DRAFT 또는 PAUSED 상태로 전환해주세요.',
      )
      return
    }

    if (mission.hasCompletion) {
      setMissionError(
        `이 Mission에는 ${mission.completionCount}건의 완료 기록이 있어 삭제할 수 없습니다. Mission 비활성화를 사용해주세요.`,
      )
      return
    }

    if (
      !window.confirm(
        `Mission을 삭제하시겠습니까?\n\n"${mission.title}"\n\nMission과 QR 정보가 영구 삭제됩니다.`,
      )
    ) {
      return
    }

    if (
      !window.confirm(
        '마지막 확인입니다.\n\n이 Mission을 완전히 삭제하시겠습니까?',
      )
    ) {
      return
    }

    setMissionDeleteActionId(mission.id)
    setMissionMessage('')
    setMissionError('')
    setQrMessage('')
    setQrError('')

    try {
      const data = await request(
        `/missions/${mission.id}`,
        'DELETE',
        'Mission 삭제에 실패했습니다.',
      )

      if (!data) return

      setMissions((current) => current.filter((item) => item.id !== mission.id))

      setQrModal((current) =>
        current?.missionId === mission.id ? null : current,
      )

      setMissionMessage(responseMessage(data, 'Mission이 삭제되었습니다.'))
    } catch (err) {
      setMissionError(
        err instanceof Error
          ? err.message
          : 'Mission 삭제 중 오류가 발생했습니다.',
      )
    } finally {
      setMissionDeleteActionId(null)
    }
  }

  /*
   * QR 이미지 생성
   */
  async function createQrData(
    qrPath: string | null | undefined,
    qrToken: string | null | undefined,
  ) {
    if (!qrToken) {
      throw new Error('QR 원본 토큰을 확인할 수 없습니다.')
    }

    const qrUrl = new URL(
      qrPath || `/checkin/${qrToken}`,
      window.location.origin,
    ).toString()

    const qrDataUrl = await QRCode.toDataURL(qrUrl, {
      width: 320,
      margin: 2,
      errorCorrectionLevel: 'M',
    })

    return {
      qrUrl,
      qrDataUrl,
    }
  }

  /*
   * QR 상태 표시 갱신
   */
  function updateMissionQrState(
    missionId: number,
    qrActive: boolean,
    qrAvailable = true,
  ) {
    setMissions((current) =>
      current.map((mission) =>
        mission.id === missionId
          ? {
              ...mission,
              qrActive,
              qrAvailable,
            }
          : mission,
      ),
    )

    setQrModal((current) =>
      current?.missionId === missionId
        ? {
            ...current,
            qrActive,
          }
        : current,
    )
  }

  /*
   * 기존 QR 조회
   *
   * 수정 사항:
   * QR 보기에서는 GET 요청만 실행한다.
   *
   * POST /missions/:id/qr 요청은
   * QR 재발급 기능에서만 사용한다.
   */
  async function handleViewQr(mission: Mission) {
    const token = getAccessToken()

    if (!token) return

    setQrLoadingMissionId(mission.id)
    setQrMessage('')
    setQrError('')

    try {
      const response = await fetch(`${API_BASE}/missions/${mission.id}/qr`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.status === 401) {
        handleUnauthorized()
        return
      }

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(
          responseMessage(data, 'Mission QR을 불러오지 못했습니다.'),
        )
      }

      const qr = await createQrData(data?.qrPath, data?.qrToken)

      setQrModal({
        missionId: mission.id,
        missionTitle: mission.title,
        qrDataUrl: qr.qrDataUrl,
        qrUrl: qr.qrUrl,
        qrActive: Boolean(data?.mission?.qrActive),
        missionStatus:
          data?.mission?.status === 'INACTIVE' ? 'INACTIVE' : mission.status,
      })
    } catch (err) {
      setQrError(
        err instanceof Error
          ? err.message
          : 'Mission QR 조회 중 오류가 발생했습니다.',
      )
    } finally {
      setQrLoadingMissionId(null)
    }
  }

  /*
   * QR 활성화 / 비활성화
   */
  async function handleToggleQr(mission: Mission) {
    if (!canManageMissions) {
      setQrError(
        'QR 상태를 변경하려면 Challenge를 DRAFT 또는 PAUSED 상태로 전환해주세요.',
      )
      return
    }

    if (!mission.qrAvailable) {
      setQrError('먼저 Mission QR을 발급해주세요.')
      return
    }

    const nextActive = !mission.qrActive

    if (
      !window.confirm(
        nextActive
          ? `Mission QR을 다시 활성화하시겠습니까?\n\n"${mission.title}"`
          : `Mission QR을 비활성화하시겠습니까?\n\n"${mission.title}"\n\nQR 정보는 삭제되지 않습니다.`,
      )
    ) {
      return
    }

    setQrActionMissionId(mission.id)
    setQrMessage('')
    setQrError('')

    try {
      const action = nextActive ? 'activate' : 'deactivate'

      const data = await request(
        `/missions/${mission.id}/qr/${action}`,
        'POST',
        'Mission QR 상태 변경에 실패했습니다.',
      )

      if (!data) return

      const active = Boolean(data.mission?.qrActive)

      updateMissionQrState(
        mission.id,
        active,
        Boolean(data.mission?.qrAvailable ?? mission.qrAvailable),
      )

      setQrMessage(responseMessage(data, 'Mission QR 상태가 변경되었습니다.'))
    } catch (err) {
      setQrError(
        err instanceof Error
          ? err.message
          : 'Mission QR 상태 변경 중 오류가 발생했습니다.',
      )
    } finally {
      setQrActionMissionId(null)
    }
  }

  /*
   * QR 재발급
   *
   * 이 기능에서만 QR 재발급 POST 요청을 보낸다.
   */
  async function handleReissueQr(mission: Mission) {
    if (!canManageMissions) {
      setQrError(
        'QR을 재발급하려면 Challenge를 DRAFT 또는 PAUSED 상태로 전환해주세요.',
      )
      return
    }

    if (
      !window.confirm(
        `Mission QR을 재발급하시겠습니까?\n\n"${mission.title}"\n\n기존 QR은 즉시 무효화됩니다.`,
      )
    ) {
      return
    }

    if (
      !window.confirm(
        '기존 QR이 즉시 무효화됩니다.\n\n새 QR로 재발급하시겠습니까?',
      )
    ) {
      return
    }

    setQrActionMissionId(mission.id)
    setQrMessage('')
    setQrError('')

    try {
      const data = await request(
        `/missions/${mission.id}/qr`,
        'POST',
        'Mission QR 재발급에 실패했습니다.',
      )

      if (!data) return

      const qr = await createQrData(data?.qrPath, data?.qrToken)

      updateMissionQrState(mission.id, true, true)

      setQrModal({
        missionId: mission.id,
        missionTitle: mission.title,
        qrDataUrl: qr.qrDataUrl,
        qrUrl: qr.qrUrl,
        qrActive: true,
        missionStatus: mission.status,
      })

      setQrMessage(responseMessage(data, 'Mission QR이 재발급되었습니다.'))
    } catch (err) {
      setQrError(
        err instanceof Error
          ? err.message
          : 'Mission QR 재발급 중 오류가 발생했습니다.',
      )
    } finally {
      setQrActionMissionId(null)
    }
  }

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center bg-slate-50 px-6 py-20">
        <p className="font-semibold text-slate-500">
          Challenge 정보를 불러오는 중...
        </p>
      </main>
    )
  }

  if (error) {
    return (
      <main className="flex flex-1 items-center justify-center bg-slate-50 px-6 py-20">
        <div className="w-full max-w-xl rounded-3xl border border-red-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">
            Challenge를 불러올 수 없습니다.
          </h1>

          <p className="mt-3 text-red-600">{error}</p>

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

  if (!challenge) return null

  const displayStatus = getDisplayStatus(challenge, currentTime)

  const canEditChallenge =
    challenge.status === 'DRAFT' ||
    challenge.status === 'ACTIVE' ||
    challenge.status === 'PAUSED'

  const activeMissionCount = missions.filter(
    (mission) => mission.status === 'ACTIVE',
  ).length

  const inactiveMissionCount = missions.length - activeMissionCount

  const futureStart = Boolean(
    challenge.startAt && new Date(challenge.startAt) > new Date(currentTime),
  )

  return (
    <main className="flex flex-1 justify-center bg-slate-50 px-6 py-12">
      <div className="w-full max-w-5xl">
        <Link
          href="/institution/challenges"
          className="text-sm font-bold text-slate-500 hover:text-slate-800"
        >
          ← Challenge 관리
        </Link>

        {/* Challenge 제목 */}
        <div className="mt-6 flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm font-bold tracking-widest text-sky-600">
                CHALLENGE MANAGEMENT
              </p>

              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${statusStyle(
                  displayStatus,
                )}`}
              >
                {statusLabel(displayStatus)}
              </span>
            </div>

            <h1 className="mt-3 text-3xl font-bold text-slate-900">
              {challenge.title}
            </h1>

            {challenge.region && (
              <p className="mt-2 font-semibold text-slate-500">
                📍 {challenge.region}
              </p>
            )}
          </div>

          {canEditChallenge ? (
            <Link
              href={`/institution/challenges/${challenge.id}/edit`}
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-sky-50"
            >
              기본 정보 수정
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className="rounded-xl bg-slate-200 px-5 py-3 text-sm font-bold text-slate-500"
            >
              기본 정보 수정
            </button>
          )}
        </div>

        {/* Challenge 기본 정보 */}
        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">기본 정보</h2>

          <div className="mt-6">
            <p className="text-sm font-bold text-slate-500">설명</p>

            <p className="mt-2 whitespace-pre-wrap leading-7 text-slate-700">
              {challenge.description || '등록된 설명이 없습니다.'}
            </p>
          </div>

          <div className="mt-6 grid gap-4 border-t border-slate-100 pt-6 sm:grid-cols-3">
            <div>
              <p className="text-sm font-bold text-slate-500">지역</p>
              <p className="mt-2 font-semibold text-slate-900">
                {challenge.region || '미설정'}
              </p>
            </div>

            <div>
              <p className="text-sm font-bold text-slate-500">운영 시작 일시</p>
              <p className="mt-2 font-semibold text-slate-900">
                {formatDateTime(challenge.startAt)}
              </p>
            </div>

            <div>
              <p className="text-sm font-bold text-slate-500">운영 종료 일시</p>
              <p className="mt-2 font-semibold text-slate-900">
                {formatDateTime(challenge.endAt)}
              </p>
            </div>
          </div>
        </section>

        {/* Mission 관리 */}
        <section className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Mission 관리</h2>

              <p className="mt-1 text-sm text-slate-500">
                Challenge의 관광 장소, 대표사진과 인증 방식을 관리합니다.
              </p>
            </div>

            {canManageMissions ? (
              <Link
                href={`/institution/challenges/${challenge.id}/missions/new`}
                className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-bold text-white hover:bg-sky-700"
              >
                + Mission 추가
              </Link>
            ) : (
              <button
                type="button"
                disabled
                className="rounded-xl bg-slate-200 px-5 py-3 text-sm font-bold text-slate-500"
              >
                + Mission 추가
              </button>
            )}
          </div>

          {challenge.status === 'ACTIVE' && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-bold text-amber-700">
                운영 중에는 Mission을 변경할 수 없습니다.
              </p>

              <p className="mt-1 text-sm leading-6 text-amber-700">
                Mission 정보나 사진을 변경하려면 Challenge 운영을 먼저
                중단해주세요.
              </p>
            </div>
          )}

          {challenge.status === 'PAUSED' && (
            <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-4">
              <p className="text-sm font-bold text-sky-700">
                현재 운영이 중단되어 있습니다.
              </p>

              <p className="mt-1 text-sm text-sky-700">
                Mission과 관광지 대표사진을 정비한 뒤 운영을 재개할 수 있습니다.
              </p>
            </div>
          )}

          {missionError && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {missionError}
            </div>
          )}

          {missionMessage && (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
              {missionMessage}
            </div>
          )}

          {qrError && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {qrError}
            </div>
          )}

          {qrMessage && (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
              {qrMessage}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold text-slate-500">
            <span>총 {missions.length}개</span>

            <span className="text-emerald-600">
              활성 {activeMissionCount}개
            </span>

            <span>비활성 {inactiveMissionCount}개</span>
          </div>

          {missions.length === 0 ? (
            <div className="mt-5 rounded-3xl border border-dashed border-slate-300 bg-white px-8 py-14 text-center">
              <div className="text-5xl">📍</div>

              <h3 className="mt-5 text-xl font-bold text-slate-900">
                아직 등록된 Mission이 없습니다.
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Mission을 추가하고 관광지 위치와 대표사진을 등록해주세요.
              </p>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {missions.map((mission, index) => (
                <div
                  key={mission.id}
                  className={`rounded-3xl border p-6 shadow-sm ${
                    mission.status === 'ACTIVE'
                      ? 'border-slate-200 bg-white'
                      : 'border-slate-300 bg-slate-50'
                  }`}
                >
                  {/* Mission 제목 및 관리 버튼 */}
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="text-xs font-bold text-sky-600">
                          MISSION {index + 1}
                        </p>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${
                            mission.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {mission.status === 'ACTIVE'
                            ? 'Mission 활성'
                            : 'Mission 비활성'}
                        </span>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${verificationStyle(
                            mission.verificationMode,
                          )}`}
                        >
                          {verificationLabel(mission.verificationMode)}
                        </span>
                      </div>

                      <h3 className="mt-2 text-xl font-bold text-slate-900">
                        {mission.title}
                      </h3>

                      {mission.address && (
                        <p className="mt-2 text-sm text-slate-500">
                          📍 {mission.address}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {canManageMissions ? (
                        <Link
                          href={`/institution/challenges/${challenge.id}/missions/${mission.id}/edit`}
                          className="rounded-lg px-3 py-2 text-sm font-bold text-sky-600 hover:bg-sky-50"
                        >
                          Mission 수정
                        </Link>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="rounded-lg px-3 py-2 text-sm font-bold text-slate-400"
                        >
                          Mission 수정 불가
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => void handleToggleMissionStatus(mission)}
                        disabled={
                          !canManageMissions ||
                          missionStatusActionId === mission.id ||
                          missionDeleteActionId === mission.id
                        }
                        className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-bold text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        {missionStatusActionId === mission.id
                          ? '처리 중...'
                          : mission.status === 'ACTIVE'
                            ? 'Mission 비활성화'
                            : 'Mission 다시 활성화'}
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleDeleteMission(mission)}
                        disabled={
                          !canManageMissions ||
                          mission.hasCompletion ||
                          missionDeleteActionId === mission.id ||
                          missionStatusActionId === mission.id
                        }
                        className="rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        {missionDeleteActionId === mission.id
                          ? '삭제 중...'
                          : mission.hasCompletion
                            ? 'Mission 삭제 불가'
                            : 'Mission 삭제'}
                      </button>
                    </div>
                  </div>

                  {/* Mission 대표사진 */}
                  <div className="mt-5">
                    <MissionPhoto mission={mission} />
                  </div>

                  {mission.description && (
                    <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                      {mission.description}
                    </p>
                  )}

                  {/* Mission 완료 기록 */}
                  <div
                    className={`mt-4 rounded-xl border p-4 ${
                      mission.hasCompletion
                        ? 'border-amber-200 bg-amber-50'
                        : 'border-emerald-200 bg-emerald-50'
                    }`}
                  >
                    <p
                      className={`text-sm font-bold ${
                        mission.hasCompletion
                          ? 'text-amber-800'
                          : 'text-emerald-700'
                      }`}
                    >
                      {mission.hasCompletion
                        ? `완료 기록 ${mission.completionCount}건 · Mission 삭제 불가`
                        : '완료 기록 없음 · Mission 삭제 가능'}
                    </p>

                    <p className="mt-1 text-xs leading-5 text-slate-600">
                      {mission.hasCompletion
                        ? '완료 기록 보존을 위해 물리 삭제할 수 없습니다. 비활성화를 사용해주세요.'
                        : 'DRAFT 또는 PAUSED Challenge에서 Mission을 삭제할 수 있습니다.'}
                    </p>
                  </div>

                  {mission.status === 'INACTIVE' && (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                      <p className="text-sm font-bold text-slate-700">
                        현재 비활성화된 Mission입니다.
                      </p>

                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        신규 인증과 현재 Challenge 완료 조건에서 제외됩니다.
                        기존 완료 기록, 대표사진 및 QR 정보는 보존됩니다.
                      </p>
                    </div>
                  )}

                  {/* Mission 상세 정보 */}
                  <div className="mt-5 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2 lg:grid-cols-5">
                    <div>
                      <p className="text-xs font-bold text-slate-400">
                        인증 방식
                      </p>
                      <p className="mt-1 font-semibold text-slate-800">
                        {verificationLabel(mission.verificationMode)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-bold text-slate-400">
                        인증 반경
                      </p>
                      <p className="mt-1 font-semibold text-slate-800">
                        {mission.verificationRadius}m
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-bold text-slate-400">위도</p>
                      <p className="mt-1 break-all font-semibold text-slate-800">
                        {mission.latitude}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-bold text-slate-400">경도</p>
                      <p className="mt-1 break-all font-semibold text-slate-800">
                        {mission.longitude}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-bold text-slate-400">QR</p>

                      <p
                        className={`mt-1 font-bold ${
                          mission.qrAvailable && mission.qrActive
                            ? 'text-emerald-600'
                            : 'text-slate-500'
                        }`}
                      >
                        {mission.qrAvailable
                          ? mission.qrActive
                            ? '사용 중'
                            : '비활성'
                          : '사용 안 함'}
                      </p>
                    </div>
                  </div>

                  {mission.qrLocationNote && (
                    <div className="mt-5 rounded-xl bg-violet-50 p-4">
                      <p className="text-xs font-bold text-violet-500">
                        QR 설치 위치
                      </p>

                      <p className="mt-1 text-sm font-semibold text-violet-800">
                        {mission.qrLocationNote}
                      </p>
                    </div>
                  )}

                  {/* QR 관리 */}
                  {mission.verificationMode !== 'LOCATION_ONLY' && (
                    <div className="mt-5 rounded-2xl border border-violet-100 bg-violet-50/60 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-violet-800">
                            QR 관리
                          </p>

                          <p className="mt-1 text-xs leading-5 text-violet-600">
                            QR 조회는 운영 상태와 관계없이 가능하며, 재발급과
                            상태 변경은 DRAFT 또는 PAUSED 상태에서만 가능합니다.
                          </p>
                        </div>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${
                            mission.qrAvailable && mission.qrActive
                              ? 'bg-emerald-100 text-emerald-700'
                              : mission.qrAvailable
                                ? 'bg-slate-200 text-slate-600'
                                : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {mission.qrAvailable
                            ? mission.qrActive
                              ? 'QR 사용 중'
                              : 'QR 비활성'
                            : 'QR 미발급'}
                        </span>
                      </div>

                      {mission.status === 'INACTIVE' && (
                        <p className="mt-3 rounded-xl bg-white p-3 text-xs text-slate-600">
                          Mission 자체가 비활성 상태이므로 QR이 활성화되어
                          있어도 여행자 인증에 사용할 수 없습니다.
                        </p>
                      )}

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void handleViewQr(mission)}
                          disabled={
                            !mission.qrAvailable ||
                            qrLoadingMissionId === mission.id ||
                            qrActionMissionId === mission.id ||
                            missionDeleteActionId === mission.id
                          }
                          className="rounded-xl border border-violet-300 bg-white px-4 py-2 text-sm font-bold text-violet-700 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {qrLoadingMissionId === mission.id
                            ? 'QR 불러오는 중...'
                            : 'QR 보기'}
                        </button>

                        <button
                          type="button"
                          onClick={() => void handleToggleQr(mission)}
                          disabled={
                            !canManageMissions ||
                            !mission.qrAvailable ||
                            qrActionMissionId === mission.id ||
                            qrLoadingMissionId === mission.id ||
                            missionDeleteActionId === mission.id
                          }
                          className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-bold text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {qrActionMissionId === mission.id
                            ? '처리 중...'
                            : mission.qrActive
                              ? 'QR 비활성화'
                              : 'QR 활성화'}
                        </button>

                        <button
                          type="button"
                          onClick={() => void handleReissueQr(mission)}
                          disabled={
                            !canManageMissions ||
                            qrActionMissionId === mission.id ||
                            qrLoadingMissionId === mission.id ||
                            missionDeleteActionId === mission.id
                          }
                          className="rounded-xl border border-sky-300 bg-white px-4 py-2 text-sm font-bold text-sky-700 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {qrActionMissionId === mission.id
                            ? '처리 중...'
                            : 'QR 재발급'}
                        </button>
                      </div>

                      {!canManageMissions && (
                        <p className="mt-3 text-xs font-semibold text-slate-500">
                          QR 재발급이나 상태 변경이 필요하면 Challenge 운영을
                          먼저 중단해주세요.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Challenge 운영 관리 */}
        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">Challenge 운영</h2>

          {operationError && (
            <div className="mt-5 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">
              {operationError}
            </div>
          )}

          {operationMessage && (
            <div className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
              {operationMessage}
            </div>
          )}

          {challenge.status === 'DRAFT' && (
            <div className="mt-5">
              <div className="rounded-xl bg-slate-50 p-5">
                <p className="font-bold text-slate-800">운영 준비 중입니다.</p>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {futureStart
                    ? 'Mission과 운영 정보를 준비한 뒤 운영 예약을 활성화할 수 있습니다.'
                    : 'Mission과 운영 정보를 모두 준비한 뒤 Challenge 운영을 시작해주세요.'}
                </p>
              </div>

              {activeMissionCount === 0 && (
                <p className="mt-4 text-sm font-semibold text-amber-700">
                  활성화된 Mission이 하나 이상 있어야 Challenge 운영을 시작할 수
                  있습니다.
                </p>
              )}

              <button
                type="button"
                onClick={() => void handleActivateChallenge()}
                disabled={Boolean(operationLoading) || activeMissionCount === 0}
                className="mt-5 rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
              >
                {operationLoading === 'activate'
                  ? '활성화 중...'
                  : futureStart
                    ? 'Challenge 운영 예약 활성화'
                    : 'Challenge 운영 시작'}
              </button>

              <div className="mt-8 border-t border-red-100 pt-6">
                <p className="font-bold text-red-700">Challenge 삭제</p>

                <p className="mt-2 text-sm text-slate-500">
                  운영 전인 DRAFT Challenge만 삭제할 수 있습니다. 등록된
                  Mission도 함께 삭제됩니다.
                </p>

                <button
                  type="button"
                  onClick={() => void handleDeleteChallenge()}
                  disabled={Boolean(operationLoading)}
                  className="mt-4 rounded-xl border border-red-300 bg-white px-5 py-3 font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  {operationLoading === 'delete'
                    ? '삭제 중...'
                    : 'Challenge 삭제'}
                </button>
              </div>
            </div>
          )}

          {challenge.status === 'ACTIVE' && (
            <div className="mt-5">
              <div
                className={`rounded-xl border p-5 ${
                  displayStatus === 'UPCOMING'
                    ? 'border-sky-200 bg-sky-50'
                    : displayStatus === 'EXPIRED'
                      ? 'border-orange-200 bg-orange-50'
                      : 'border-emerald-200 bg-emerald-50'
                }`}
              >
                <p className="font-bold text-slate-800">
                  {displayStatus === 'UPCOMING'
                    ? '운영 예정인 Challenge입니다.'
                    : displayStatus === 'EXPIRED'
                      ? '설정된 운영시간이 종료되었습니다.'
                      : '현재 운영 중인 Challenge입니다.'}
                </p>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {displayStatus === 'UPCOMING'
                    ? `${formatDateTime(challenge.startAt)}부터 자동으로 공개됩니다.`
                    : displayStatus === 'EXPIRED'
                      ? '기간을 연장하려면 운영을 중단하고 종료일시를 수정해주세요.'
                      : '여행자가 Challenge에 참여하고 Mission 인증을 진행할 수 있습니다.'}
                </p>
              </div>

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                  <h3 className="font-bold text-amber-800">운영 일시 중단</h3>

                  <p className="mt-2 text-sm text-amber-700">
                    운영을 중단한 뒤 Mission 및 운영 정보를 수정할 수 있습니다.
                  </p>

                  <button
                    type="button"
                    onClick={() => void handlePauseChallenge()}
                    disabled={Boolean(operationLoading)}
                    className="mt-4 rounded-xl border border-amber-300 bg-white px-5 py-3 font-bold text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                  >
                    {operationLoading === 'pause'
                      ? '운영 중단 중...'
                      : 'Challenge 운영 중단'}
                  </button>
                </div>

                <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
                  <h3 className="font-bold text-red-700">최종 운영 종료</h3>

                  <p className="mt-2 text-sm text-red-700">
                    최종 종료 후에는 다시 운영할 수 없습니다.
                  </p>

                  <button
                    type="button"
                    onClick={() => void handleEndChallenge()}
                    disabled={Boolean(operationLoading)}
                    className="mt-4 rounded-xl border border-red-300 bg-white px-5 py-3 font-bold text-red-600 hover:bg-red-100 disabled:opacity-50"
                  >
                    {operationLoading === 'end'
                      ? '종료 중...'
                      : 'Challenge 최종 종료'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {challenge.status === 'PAUSED' && (
            <div className="mt-5">
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
                <p className="font-bold text-amber-800">
                  Challenge 운영이 일시 중단되어 있습니다.
                </p>

                <p className="mt-2 text-sm text-amber-700">
                  Mission 및 운영 정보를 정비한 뒤 운영을 재개할 수 있습니다.
                </p>
              </div>

              {activeMissionCount === 0 && (
                <p className="mt-4 text-sm font-semibold text-amber-700">
                  운영 재개에는 활성 Mission이 하나 이상 필요합니다.
                </p>
              )}

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                  <h3 className="font-bold text-emerald-700">운영 재개</h3>

                  <button
                    type="button"
                    onClick={() => void handleResumeChallenge()}
                    disabled={
                      Boolean(operationLoading) || activeMissionCount === 0
                    }
                    className="mt-4 rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-500"
                  >
                    {operationLoading === 'resume'
                      ? '운영 재개 중...'
                      : futureStart
                        ? 'Challenge 운영 예약 활성화'
                        : 'Challenge 다시 운영'}
                  </button>
                </div>

                <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
                  <h3 className="font-bold text-red-700">최종 운영 종료</h3>

                  <button
                    type="button"
                    onClick={() => void handleEndChallenge()}
                    disabled={Boolean(operationLoading)}
                    className="mt-4 rounded-xl border border-red-300 bg-white px-5 py-3 font-bold text-red-600 hover:bg-red-100 disabled:opacity-50"
                  >
                    {operationLoading === 'end'
                      ? '종료 중...'
                      : 'Challenge 최종 종료'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {challenge.status === 'ENDED' && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-5">
              <p className="font-bold text-red-700">
                최종 종료된 Challenge입니다.
              </p>

              <p className="mt-2 text-sm text-red-700">
                기존 참여 및 Mission 완료 기록은 보존됩니다.
              </p>
            </div>
          )}

          {challenge.status === 'ARCHIVED' && (
            <div className="mt-5 rounded-xl bg-slate-100 p-5">
              <p className="font-bold text-slate-700">
                보관된 Challenge입니다.
              </p>
            </div>
          )}
        </section>
      </div>

      {/* QR 조회 모달 */}
      {qrModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-8"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setQrModal(null)
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="mission-qr-modal-title"
            className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold tracking-widest text-violet-600">
                  MISSION QR
                </p>

                <h2
                  id="mission-qr-modal-title"
                  className="mt-2 text-2xl font-bold text-slate-900"
                >
                  {qrModal.missionTitle}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setQrModal(null)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100"
              >
                닫기
              </button>
            </div>

            <div className="mt-6 flex justify-center rounded-2xl border border-slate-200 bg-white p-5">
              <img
                src={qrModal.qrDataUrl}
                alt={`${qrModal.missionTitle} Mission QR`}
                className="h-72 w-72 max-w-full object-contain"
              />
            </div>

            <div
              className={`mt-5 rounded-xl p-4 ${
                qrModal.missionStatus === 'INACTIVE'
                  ? 'bg-slate-100 text-slate-700'
                  : qrModal.qrActive
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-amber-50 text-amber-700'
              }`}
            >
              <p className="text-sm font-bold">
                {qrModal.missionStatus === 'INACTIVE'
                  ? '현재 Mission 자체가 비활성 상태입니다.'
                  : qrModal.qrActive
                    ? '현재 이 QR은 사용 중입니다.'
                    : '현재 이 QR은 비활성 상태입니다.'}
              </p>

              <p className="mt-1 text-xs leading-5">
                {qrModal.missionStatus === 'INACTIVE'
                  ? 'Mission이 비활성 상태이므로 여행자 인증에는 사용할 수 없습니다.'
                  : qrModal.qrActive
                    ? '여행자가 이 QR을 스캔하여 Mission 인증에 사용할 수 있습니다.'
                    : '기관에서는 QR을 확인할 수 있지만 여행자 인증에는 사용할 수 없습니다.'}
              </p>
            </div>

            <div className="mt-4 rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-bold text-slate-500">QR 연결 주소</p>

              <p className="mt-1 break-all text-xs leading-5 text-slate-600">
                {qrModal.qrUrl}
              </p>
            </div>

            <p className="mt-4 text-xs leading-5 text-slate-500">
              QR 재발급 시 기존 QR은 즉시 무효화됩니다. 실제 관광지에 설치한
              QR을 교체해야 하는 경우에만 재발급해주세요.
            </p>
          </div>
        </div>
      )}
    </main>
  )
}
