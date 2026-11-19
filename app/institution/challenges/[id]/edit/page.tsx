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
import { API_BASE_URL } from '../../../../lib/api'

const MAX_COVER_IMAGE_SIZE = 10 * 1024 * 1024
const MAX_BADGE_IMAGE_SIZE = 10 * 1024 * 1024

const ALLOWED_COVER_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
])

const ALLOWED_BADGE_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
])

type ChallengeStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ENDED' | 'ARCHIVED'

type ChallengeRouteMode = 'WALKING' | 'CYCLING' | 'DRIVING'

type BadgeCenterType = 'IMAGE' | 'ICON'

type BadgeShape =
  | 'CIRCLE'
  | 'TRIANGLE'
  | 'DIAMOND'
  | 'PENTAGON'
  | 'HEXAGON'
  | 'SHIELD'

type Challenge = {
  id: number
  title: string
  description: string | null
  region: string | null
  status: ChallengeStatus
  startAt: string | null
  endAt: string | null

  routeMode: ChallengeRouteMode

  difficulty: number | null
  badgeBorderColor: string | null
  badgeCenterType: BadgeCenterType | null
  badgeIcon: string | null
  badgeName: string | null
  badgeDescription: string | null

  badgeImageScale: number
  badgeImagePositionX: number
  badgeImagePositionY: number

  hasBadgeCenterImage: boolean
  badgeCenterImageUrl: string | null

  currentBadgeVersionId: number | null

  hasCoverImage: boolean
  coverImageUrl: string | null

  coverPositionX: number
  coverPositionY: number

  institutionId: number
  createdAt: string
  updatedAt: string
}

type ManagementMission = {
  id: number
  status: 'ACTIVE' | 'INACTIVE'
}

type ChallengeDetailResponse = {
  challenge: Challenge
  missions: ManagementMission[]
}

const BADGE_ICON_OPTIONS = [
  {
    value: 'PALACE',
    label: '궁궐',
    icon: '🏯',
  },
  {
    value: 'BICYCLE',
    label: '자전거',
    icon: '🚲',
  },
  {
    value: 'MOUNTAIN',
    label: '산',
    icon: '⛰️',
  },
  {
    value: 'SEA',
    label: '바다',
    icon: '🌊',
  },
  {
    value: 'LANDMARK',
    label: '명소',
    icon: '📍',
  },
  {
    value: 'STAR',
    label: '별',
    icon: '⭐',
  },
] as const

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

  const [routeMode, setRouteMode] = useState<ChallengeRouteMode>('WALKING')

  /*
   * 완료 배지 관련 상태
   */
  const [activeMissionCount, setActiveMissionCount] = useState(0)

  const [difficulty, setDifficulty] = useState<number | null>(null)

  const [badgeBorderColor, setBadgeBorderColor] = useState('#0EA5E9')

  const [badgeCenterType, setBadgeCenterType] =
    useState<BadgeCenterType>('ICON')

  const [badgeIcon, setBadgeIcon] = useState('PALACE')

  const [badgeName, setBadgeName] = useState('')

  const [badgeDescription, setBadgeDescription] = useState('')

  const [badgeImageScale, setBadgeImageScale] = useState(100)

  const [badgeImagePositionX, setBadgeImagePositionX] = useState(50)

  const [badgeImagePositionY, setBadgeImagePositionY] = useState(50)

  const [selectedBadgeImage, setSelectedBadgeImage] = useState<File | null>(
    null,
  )

  const [badgePreviewUrl, setBadgePreviewUrl] = useState<string | null>(null)

  const [badgeSaving, setBadgeSaving] = useState(false)

  const [badgeImageSaving, setBadgeImageSaving] = useState(false)

  const [badgeImageDeleting, setBadgeImageDeleting] = useState(false)

  const [badgeError, setBadgeError] = useState('')

  const [badgeMessage, setBadgeMessage] = useState('')

  /*
   * 대표사진
   */
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

        const detailData = data as ChallengeDetailResponse

        const challengeData = detailData.challenge

        setChallenge(challengeData)

        setActiveMissionCount(
          (detailData.missions ?? []).filter(
            (mission) => mission.status === 'ACTIVE',
          ).length,
        )

        setTitle(challengeData.title)

        setDescription(challengeData.description ?? '')

        setRegion(challengeData.region ?? '')

        setStartAt(toDateTimeLocal(challengeData.startAt))

        setEndAt(toDateTimeLocal(challengeData.endAt))

        setRouteMode(challengeData.routeMode ?? 'WALKING')

        setDifficulty(challengeData.difficulty ?? null)

        setBadgeBorderColor(challengeData.badgeBorderColor ?? '#0EA5E9')

        setBadgeCenterType(challengeData.badgeCenterType ?? 'ICON')

        setBadgeIcon(challengeData.badgeIcon ?? 'PALACE')

        setBadgeName(challengeData.badgeName ?? '')

        setBadgeDescription(challengeData.badgeDescription ?? '')

        setBadgeImageScale(challengeData.badgeImageScale ?? 100)

        setBadgeImagePositionX(challengeData.badgeImagePositionX ?? 50)

        setBadgeImagePositionY(challengeData.badgeImagePositionY ?? 50)

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
   * 선택한 로컬 대표사진 미리보기 URL 정리
   */
  useEffect(() => {
    return () => {
      if (coverPreviewUrl) {
        URL.revokeObjectURL(coverPreviewUrl)
      }
    }
  }, [coverPreviewUrl])

  /*
   * 선택한 로컬 배지 이미지 미리보기 URL 정리
   */
  useEffect(() => {
    return () => {
      if (badgePreviewUrl) {
        URL.revokeObjectURL(badgePreviewUrl)
      }
    }
  }, [badgePreviewUrl])

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
        `${API_BASE_URL}/challenges/${challengeId}`,
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

      const response = await fetch(
        `${API_BASE_URL}/challenges/${challengeId}/cover`,
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
       * 새 대표사진 초점도 이어서 저장한다.
       */
      const positionResponse = await fetch(
        `${API_BASE_URL}/challenges/${challengeId}`,
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
        `${API_BASE_URL}/challenges/${challengeId}/cover`,
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
   * 완료 배지 이미지 선택
   */
  function handleBadgeImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    setBadgeError('')
    setBadgeMessage('')

    if (!file) {
      return
    }

    if (!ALLOWED_BADGE_IMAGE_TYPES.has(file.type)) {
      event.target.value = ''

      setSelectedBadgeImage(null)

      setBadgePreviewUrl(null)

      setBadgeError(
        '완료 배지 이미지는 JPG, JPEG, PNG, WEBP 파일만 선택할 수 있습니다.',
      )

      return
    }

    if (file.size <= 0) {
      event.target.value = ''

      setSelectedBadgeImage(null)

      setBadgePreviewUrl(null)

      setBadgeError('비어 있는 이미지는 선택할 수 없습니다.')

      return
    }

    if (file.size > MAX_BADGE_IMAGE_SIZE) {
      event.target.value = ''

      setSelectedBadgeImage(null)

      setBadgePreviewUrl(null)

      setBadgeError('완료 배지 이미지는 최대 10MB까지 등록할 수 있습니다.')

      return
    }

    if (badgePreviewUrl) {
      URL.revokeObjectURL(badgePreviewUrl)
    }

    setSelectedBadgeImage(file)

    setBadgePreviewUrl(URL.createObjectURL(file))

    setBadgeCenterType('IMAGE')

    /*
     * 새 이미지를 선택하면
     * 우선 기본 크기/중앙 위치에서 조정할 수 있게 한다.
     */
    setBadgeImageScale(100)

    setBadgeImagePositionX(50)

    setBadgeImagePositionY(50)
  }

  /*
   * 선택 중인 배지 이미지 취소
   */
  function handleCancelBadgeImageSelection() {
    if (badgePreviewUrl) {
      URL.revokeObjectURL(badgePreviewUrl)
    }

    setSelectedBadgeImage(null)

    setBadgePreviewUrl(null)

    setBadgeError('')

    setBadgeMessage('')

    /*
     * 선택을 취소하면
     * 현재 DB에 저장된 조정값으로 되돌린다.
     */
    setBadgeImageScale(challenge?.badgeImageScale ?? 100)

    setBadgeImagePositionX(challenge?.badgeImagePositionX ?? 50)

    setBadgeImagePositionY(challenge?.badgeImagePositionY ?? 50)

    const input = document.getElementById(
      'badgeImage',
    ) as HTMLInputElement | null

    if (input) {
      input.value = ''
    }
  }

  /*
   * 배지 이미지 크기와 위치를 기본값으로 되돌린다.
   */
  function resetBadgeImageTransform() {
    setBadgeImageScale(100)

    setBadgeImagePositionX(50)

    setBadgeImagePositionY(50)

    setBadgeError('')

    setBadgeMessage('')
  }

  /*
   * 난이도 / 색상 / 중앙 유형 / 이름 / 설명 /
   * 이미지 크기 / 이미지 위치 저장
   */
  async function handleSaveBadgeSettings() {
    if (!challenge || !challengeId) {
      return
    }

    if (challenge.status === 'ACTIVE') {
      setBadgeError(
        '운영 중인 Challenge의 완료 배지 설정은 변경할 수 없습니다. 먼저 운영을 일시 중단해주세요.',
      )

      return
    }

    if (challenge.status === 'ENDED' || challenge.status === 'ARCHIVED') {
      setBadgeError(
        '종료되거나 보관된 Challenge의 완료 배지는 수정할 수 없습니다.',
      )

      return
    }

    if (difficulty === null) {
      setBadgeError('Challenge 난이도를 선택해주세요.')

      return
    }

    if (!/^#[0-9A-Fa-f]{6}$/.test(badgeBorderColor)) {
      setBadgeError('배지 테두리 색상을 올바른 HEX 색상으로 선택해주세요.')

      return
    }

    if (!badgeName.trim()) {
      setBadgeError('배지 이름을 입력해주세요.')

      return
    }

    if (!badgeDescription.trim()) {
      setBadgeError('배지 설명을 입력해주세요.')

      return
    }

    if (badgeCenterType === 'ICON' && !badgeIcon) {
      setBadgeError('배지 중앙 아이콘을 선택해주세요.')

      return
    }

    if (badgeImageScale < 40 || badgeImageScale > 100) {
      setBadgeError('배지 이미지 크기는 40%에서 100% 사이여야 합니다.')

      return
    }

    if (badgeImagePositionX < 0 || badgeImagePositionX > 100) {
      setBadgeError('배지 이미지 가로 위치는 0%에서 100% 사이여야 합니다.')

      return
    }

    if (badgeImagePositionY < 0 || badgeImagePositionY > 100) {
      setBadgeError('배지 이미지 세로 위치는 0%에서 100% 사이여야 합니다.')

      return
    }

    const accessToken = getAccessToken()

    if (!accessToken) {
      return
    }

    setBadgeSaving(true)

    setBadgeError('')

    setBadgeMessage('')

    try {
      const response = await fetch(
        `${API_BASE_URL}/challenges/${challengeId}`,
        {
          method: 'PATCH',

          headers: {
            'Content-Type': 'application/json',

            Authorization: `Bearer ${accessToken}`,
          },

          body: JSON.stringify({
            difficulty,
            badgeBorderColor,
            badgeCenterType,
            badgeIcon: badgeCenterType === 'ICON' ? badgeIcon : null,
            badgeName: badgeName.trim(),
            badgeDescription: badgeDescription.trim(),

            badgeImageScale,
            badgeImagePositionX,
            badgeImagePositionY,
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

        throw new Error(message ?? '완료 배지 설정 저장에 실패했습니다.')
      }

      if (data?.challenge) {
        setChallenge(data.challenge)

        setDifficulty(data.challenge.difficulty ?? null)

        setBadgeBorderColor(data.challenge.badgeBorderColor ?? '#0EA5E9')

        setBadgeCenterType(data.challenge.badgeCenterType ?? 'ICON')

        setBadgeIcon(data.challenge.badgeIcon ?? 'PALACE')

        setBadgeName(data.challenge.badgeName ?? '')

        setBadgeDescription(data.challenge.badgeDescription ?? '')

        setBadgeImageScale(data.challenge.badgeImageScale ?? 100)

        setBadgeImagePositionX(data.challenge.badgeImagePositionX ?? 50)

        setBadgeImagePositionY(data.challenge.badgeImagePositionY ?? 50)
      }

      setBadgeMessage('완료 배지 설정이 저장되었습니다.')
    } catch (err) {
      if (err instanceof Error) {
        setBadgeError(err.message)
      } else {
        setBadgeError('완료 배지 설정 저장 중 오류가 발생했습니다.')
      }
    } finally {
      setBadgeSaving(false)
    }
  }

  /*
   * 배지 중앙 이미지 업로드 / 교체
   */
  async function handleSaveBadgeImage() {
    if (!challenge || !challengeId || !selectedBadgeImage) {
      setBadgeError('등록할 완료 배지 이미지를 선택해주세요.')

      return
    }

    if (challenge.status === 'ACTIVE') {
      setBadgeError(
        '운영 중인 Challenge의 완료 배지 이미지는 변경할 수 없습니다. 먼저 운영을 일시 중단해주세요.',
      )

      return
    }

    if (challenge.status === 'ENDED' || challenge.status === 'ARCHIVED') {
      setBadgeError(
        '종료되거나 보관된 Challenge의 완료 배지는 수정할 수 없습니다.',
      )

      return
    }

    const accessToken = getAccessToken()

    if (!accessToken) {
      return
    }

    setBadgeImageSaving(true)

    setBadgeError('')

    setBadgeMessage('')

    try {
      const formData = new FormData()

      formData.append('badgeImage', selectedBadgeImage)

      const response = await fetch(
        `${API_BASE_URL}/challenges/${challengeId}/badge-image`,
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

        throw new Error(message ?? '완료 배지 이미지 저장에 실패했습니다.')
      }

      if (data?.challenge) {
        setChallenge(data.challenge)
      }

      if (badgePreviewUrl) {
        URL.revokeObjectURL(badgePreviewUrl)
      }

      setSelectedBadgeImage(null)

      setBadgePreviewUrl(null)

      const input = document.getElementById(
        'badgeImage',
      ) as HTMLInputElement | null

      if (input) {
        input.value = ''
      }

      setBadgeCenterType('IMAGE')

      setBadgeMessage(
        challenge.hasBadgeCenterImage
          ? '완료 배지 이미지가 교체되었습니다.'
          : '완료 배지 이미지가 등록되었습니다.',
      )
    } catch (err) {
      if (err instanceof Error) {
        setBadgeError(err.message)
      } else {
        setBadgeError('완료 배지 이미지 저장 중 오류가 발생했습니다.')
      }
    } finally {
      setBadgeImageSaving(false)
    }
  }

  /*
   * 현재 배지 중앙 이미지 제거
   */
  async function handleDeleteBadgeImage() {
    if (!challenge || !challengeId) {
      return
    }

    if (!challenge.hasBadgeCenterImage) {
      setBadgeError('삭제할 완료 배지 이미지가 없습니다.')

      return
    }

    if (challenge.status === 'ACTIVE') {
      setBadgeError(
        '운영 중인 Challenge의 완료 배지 이미지는 삭제할 수 없습니다. 먼저 운영을 일시 중단해주세요.',
      )

      return
    }

    if (challenge.status === 'ENDED' || challenge.status === 'ARCHIVED') {
      setBadgeError(
        '종료되거나 보관된 Challenge의 완료 배지는 수정할 수 없습니다.',
      )

      return
    }

    const confirmed = window.confirm(
      '현재 완료 배지 중앙 이미지를 삭제하시겠습니까?',
    )

    if (!confirmed) {
      return
    }

    const accessToken = getAccessToken()

    if (!accessToken) {
      return
    }

    setBadgeImageDeleting(true)

    setBadgeError('')

    setBadgeMessage('')

    try {
      const response = await fetch(
        `${API_BASE_URL}/challenges/${challengeId}/badge-image`,
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

        throw new Error(message ?? '완료 배지 이미지 삭제에 실패했습니다.')
      }

      if (data?.challenge) {
        setChallenge(data.challenge)
      }

      if (badgePreviewUrl) {
        URL.revokeObjectURL(badgePreviewUrl)
      }

      setSelectedBadgeImage(null)

      setBadgePreviewUrl(null)

      const input = document.getElementById(
        'badgeImage',
      ) as HTMLInputElement | null

      if (input) {
        input.value = ''
      }

      setBadgeMessage(data?.message ?? '완료 배지 이미지가 삭제되었습니다.')
    } catch (err) {
      if (err instanceof Error) {
        setBadgeError(err.message)
      } else {
        setBadgeError('완료 배지 이미지 삭제 중 오류가 발생했습니다.')
      }
    } finally {
      setBadgeImageDeleting(false)
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
        routeMode: ChallengeRouteMode
        startAt?: string | null
        endAt?: string | null
      } = {
        title: trimmedTitle,

        description: description.trim() || null,

        region: region.trim() || null,

        routeMode,
      }

      /*
       * DRAFT와 PAUSED에서만
       * 운영기간을 서버로 전송한다.
       */
      if (datesEditable) {
        body.startAt = startAt ? new Date(startAt).toISOString() : null

        body.endAt = endAt ? new Date(endAt).toISOString() : null
      }

      const response = await fetch(
        `${API_BASE_URL}/challenges/${challengeId}`,
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

  /*
   * 완료 배지는 DRAFT / PAUSED에서만 수정한다.
   */
  const badgeEditable =
    challenge.status === 'DRAFT' || challenge.status === 'PAUSED'

  const badgeBusy =
    badgeSaving || badgeImageSaving || badgeImageDeleting || saving

  const badgeShape = getBadgeShape(activeMissionCount)

  const displayedBadgeImageUrl =
    badgePreviewUrl ?? challenge.badgeCenterImageUrl

  const selectedBadgeIcon =
    BADGE_ICON_OPTIONS.find((option) => option.value === badgeIcon)?.icon ??
    '⭐'

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
            Challenge 대표사진, 기본 정보, 추천 이동수단, 운영 일시와 완료
            배지를 관리합니다.
          </p>
        </div>

        {challenge.status === 'ACTIVE' && (
          <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <p className="font-bold text-emerald-700">
              현재 운영 중인 Challenge입니다.
            </p>

            <p className="mt-2 text-sm leading-6 text-emerald-700">
              제목, 설명, 지역, 추천 이동수단, 대표사진과 대표사진 초점은 수정할
              수 있지만 운영 기간과 완료 배지 설정은 변경할 수 없습니다. 배지
              또는 운영기간을 변경하려면 먼저 Challenge 운영을 중단해주세요.
            </p>
          </div>
        )}

        {challenge.status === 'PAUSED' && (
          <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="font-bold text-amber-800">
              Challenge 운영이 일시 중단되어 있습니다.
            </p>

            <p className="mt-2 text-sm leading-6 text-amber-700">
              운영 중단 상태에서는 대표사진과 운영기간을 포함한 기본 정보,
              Mission 구성과 완료 배지를 수정할 수 있습니다. 수정이 끝나면
              Challenge 상세 화면에서 다시 운영할 수 있습니다.
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

        {/* 완료 배지 설정 */}
        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold tracking-widest text-violet-600">
                COMPLETION BADGE
              </p>

              <h2 className="mt-2 text-xl font-bold text-slate-900">
                완료 배지 설정
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                여행자가 Challenge의 현재 ACTIVE Mission을 모두 완료하면
                지급되는 배지입니다. 배지 모양은 ACTIVE Mission 수에 따라
                시스템이 자동으로 결정합니다.
              </p>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                badgeEditable
                  ? 'bg-violet-50 text-violet-700'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {badgeEditable ? '설정 가능' : '수정 잠김'}
            </span>
          </div>

          {challenge.status === 'ACTIVE' && (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-bold text-amber-800">
                운영 중에는 완료 배지를 변경할 수 없습니다.
              </p>

              <p className="mt-1 text-xs leading-5 text-amber-700">
                현재 지급 중인 배지 버전을 보호하기 위해 변경이 잠겨 있습니다.
                수정하려면 Challenge 운영을 먼저 일시 중단해주세요.
              </p>
            </div>
          )}

          <div className="mt-6 grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
            <div className="lg:sticky lg:top-6 lg:self-start">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-bold tracking-widest text-slate-400">
                  LIVE PREVIEW
                </p>

                <div className="mt-5 flex justify-center">
                  <BadgePreview
                    shape={badgeShape}
                    borderColor={badgeBorderColor}
                    centerType={badgeCenterType}
                    icon={selectedBadgeIcon}
                    imageUrl={displayedBadgeImageUrl}
                    imageScale={badgeImageScale}
                    imagePositionX={badgeImagePositionX}
                    imagePositionY={badgeImagePositionY}
                  />
                </div>

                <div className="mt-5 text-center">
                  <p className="font-black text-slate-900">
                    {badgeName.trim() || '배지 이름'}
                  </p>

                  <p className="mt-2 text-lg tracking-wider text-amber-500">
                    {difficulty ? '★'.repeat(difficulty) : '난이도 미설정'}
                  </p>

                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    {badgeDescription.trim() ||
                      'Challenge를 완료한 여행자에게 지급되는 배지입니다.'}
                  </p>
                </div>
              </div>

              {badgeCenterType === 'IMAGE' && displayedBadgeImageUrl && (
                <div className="mt-4 rounded-2xl border border-violet-100 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-800">
                        이미지 표시 조정
                      </p>

                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        위 미리보기를 보면서 이미지 크기와 위치를 조절할 수
                        있습니다.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={resetBadgeImageTransform}
                      disabled={!badgeEditable || badgeBusy}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      기본값
                    </button>
                  </div>

                  <div className="mt-5">
                    <div className="flex items-center justify-between gap-3">
                      <label
                        htmlFor="badgeImageScale"
                        className="text-xs font-bold text-slate-700"
                      >
                        이미지 크기
                      </label>

                      <span className="rounded-lg bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-700">
                        {badgeImageScale.toFixed(0)}%
                      </span>
                    </div>

                    <input
                      id="badgeImageScale"
                      type="range"
                      min="40"
                      max="100"
                      step="1"
                      value={badgeImageScale}
                      onChange={(event) =>
                        setBadgeImageScale(Number(event.target.value))
                      }
                      disabled={!badgeEditable || badgeBusy}
                      className="mt-3 w-full accent-violet-600 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div className="mt-5">
                    <div className="flex items-center justify-between gap-3">
                      <label
                        htmlFor="badgeImagePositionX"
                        className="text-xs font-bold text-slate-700"
                      >
                        가로 위치
                      </label>

                      <span className="rounded-lg bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-700">
                        {badgeImagePositionX.toFixed(0)}%
                      </span>
                    </div>

                    <input
                      id="badgeImagePositionX"
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={badgeImagePositionX}
                      onChange={(event) =>
                        setBadgeImagePositionX(Number(event.target.value))
                      }
                      disabled={!badgeEditable || badgeBusy}
                      className="mt-3 w-full accent-violet-600 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div className="mt-5">
                    <div className="flex items-center justify-between gap-3">
                      <label
                        htmlFor="badgeImagePositionY"
                        className="text-xs font-bold text-slate-700"
                      >
                        세로 위치
                      </label>

                      <span className="rounded-lg bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-700">
                        {badgeImagePositionY.toFixed(0)}%
                      </span>
                    </div>

                    <input
                      id="badgeImagePositionY"
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={badgeImagePositionY}
                      onChange={(event) =>
                        setBadgeImagePositionY(Number(event.target.value))
                      }
                      disabled={!badgeEditable || badgeBusy}
                      className="mt-3 w-full accent-violet-600 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
              )}

              <div className="mt-4 rounded-2xl border border-violet-100 bg-violet-50 p-4">
                <p className="text-xs font-bold text-violet-700">
                  현재 ACTIVE Mission
                </p>

                <p className="mt-1 text-2xl font-black text-violet-900">
                  {activeMissionCount}개
                </p>

                <p className="mt-2 text-xs leading-5 text-violet-700">
                  자동 배지 형태: {getBadgeShapeLabel(badgeShape)}
                </p>
              </div>
            </div>

            <div>
              {/* 난이도 */}
              <div>
                <p className="text-sm font-bold text-slate-800">
                  Challenge 난이도
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  별은 채워진 개수만 표시됩니다.
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5].map((value) => {
                    const selected = difficulty === value

                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setDifficulty(value)}
                        disabled={!badgeEditable || badgeBusy}
                        className={`rounded-xl border px-4 py-2 text-sm font-black transition ${
                          selected
                            ? 'border-amber-400 bg-amber-50 text-amber-600'
                            : 'border-slate-200 bg-white text-slate-400 hover:border-amber-300'
                        } disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400`}
                      >
                        {'★'.repeat(value)}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 배지 이름 */}
              <div className="mt-6">
                <label
                  htmlFor="badgeName"
                  className="text-sm font-bold text-slate-800"
                >
                  배지 이름
                </label>

                <input
                  id="badgeName"
                  type="text"
                  value={badgeName}
                  onChange={(event) => setBadgeName(event.target.value)}
                  disabled={!badgeEditable || badgeBusy}
                  maxLength={100}
                  placeholder="예: 서울 역사 탐험가"
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                />

                <p className="mt-1 text-right text-xs text-slate-400">
                  {badgeName.length} / 100
                </p>
              </div>

              {/* 배지 설명 */}
              <div className="mt-6">
                <label
                  htmlFor="badgeDescription"
                  className="text-sm font-bold text-slate-800"
                >
                  배지 설명
                </label>

                <textarea
                  id="badgeDescription"
                  value={badgeDescription}
                  onChange={(event) => setBadgeDescription(event.target.value)}
                  disabled={!badgeEditable || badgeBusy}
                  maxLength={500}
                  rows={4}
                  placeholder="이 배지를 획득한 의미를 설명해주세요."
                  className="mt-2 w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                />

                <p className="mt-1 text-right text-xs text-slate-400">
                  {badgeDescription.length} / 500
                </p>
              </div>

              {/* 테두리 색상 */}
              <div className="mt-6">
                <p className="text-sm font-bold text-slate-800">테두리 색상</p>

                <div className="mt-3 flex items-center gap-3">
                  <input
                    type="color"
                    value={badgeBorderColor}
                    onChange={(event) =>
                      setBadgeBorderColor(event.target.value)
                    }
                    disabled={!badgeEditable || badgeBusy}
                    className="h-12 w-16 cursor-pointer rounded-lg border border-slate-300 bg-white p-1 disabled:cursor-not-allowed"
                  />

                  <input
                    type="text"
                    value={badgeBorderColor}
                    onChange={(event) =>
                      setBadgeBorderColor(event.target.value.toUpperCase())
                    }
                    disabled={!badgeEditable || badgeBusy}
                    maxLength={7}
                    className="w-32 rounded-xl border border-slate-300 bg-white px-4 py-3 font-mono text-sm font-bold text-slate-700 outline-none focus:border-violet-500 disabled:cursor-not-allowed disabled:bg-slate-100"
                  />
                </div>
              </div>

              {/* 중앙 디자인 선택 */}
              <div className="mt-6">
                <p className="text-sm font-bold text-slate-800">
                  배지 중앙 디자인
                </p>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setBadgeCenterType('ICON')}
                    disabled={!badgeEditable || badgeBusy}
                    className={`rounded-2xl border p-4 text-left transition ${
                      badgeCenterType === 'ICON'
                        ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-100'
                        : 'border-slate-200 bg-white hover:border-violet-300'
                    } disabled:cursor-not-allowed disabled:bg-slate-100`}
                  >
                    <p className="font-bold text-slate-900">기본 아이콘</p>

                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      서비스에서 제공하는 아이콘을 사용합니다.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBadgeCenterType('IMAGE')}
                    disabled={!badgeEditable || badgeBusy}
                    className={`rounded-2xl border p-4 text-left transition ${
                      badgeCenterType === 'IMAGE'
                        ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-100'
                        : 'border-slate-200 bg-white hover:border-violet-300'
                    } disabled:cursor-not-allowed disabled:bg-slate-100`}
                  >
                    <p className="font-bold text-slate-900">직접 이미지</p>

                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      기관이 직접 올린 이미지를 중앙에 표시합니다.
                    </p>
                  </button>
                </div>
              </div>

              {/* 기본 아이콘 선택 */}
              {badgeCenterType === 'ICON' && (
                <div className="mt-5">
                  <p className="text-sm font-bold text-slate-800">
                    중앙 아이콘 선택
                  </p>

                  <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-6">
                    {BADGE_ICON_OPTIONS.map((option) => {
                      const selected = badgeIcon === option.value

                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setBadgeIcon(option.value)}
                          disabled={!badgeEditable || badgeBusy}
                          title={option.label}
                          className={`rounded-2xl border p-3 text-center transition ${
                            selected
                              ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-100'
                              : 'border-slate-200 bg-white hover:border-violet-300'
                          } disabled:cursor-not-allowed disabled:bg-slate-100`}
                        >
                          <span className="text-2xl">{option.icon}</span>

                          <p className="mt-1 text-[11px] font-bold text-slate-600">
                            {option.label}
                          </p>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* 직접 이미지 */}
              {badgeCenterType === 'IMAGE' && (
                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-800">
                        중앙 이미지
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        JPG, JPEG, PNG, WEBP · 최대 10MB
                      </p>
                    </div>

                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-500">
                      {challenge.hasBadgeCenterImage ? '등록됨' : '미등록'}
                    </span>
                  </div>

                  {displayedBadgeImageUrl && (
                    <div className="mt-4 flex justify-center">
                      <img
                        src={displayedBadgeImageUrl}
                        alt="완료 배지 중앙 이미지 미리보기"
                        className="h-28 w-28 rounded-2xl border border-slate-200 bg-white object-cover"
                      />
                    </div>
                  )}

                  {selectedBadgeImage && (
                    <div className="mt-4 rounded-xl bg-white p-3">
                      <p className="truncate text-sm font-bold text-slate-700">
                        {selectedBadgeImage.name}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        {(selectedBadgeImage.size / (1024 * 1024)).toFixed(2)}{' '}
                        MB
                      </p>
                    </div>
                  )}

                  <input
                    id="badgeImage"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleBadgeImageChange}
                    disabled={!badgeEditable || badgeBusy}
                    className="hidden"
                  />

                  <div className="mt-4 flex flex-wrap gap-2">
                    <label
                      htmlFor="badgeImage"
                      className={`rounded-xl border px-4 py-2.5 text-sm font-bold transition ${
                        badgeEditable && !badgeBusy
                          ? 'cursor-pointer border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                          : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                      }`}
                    >
                      {challenge.hasBadgeCenterImage
                        ? '다른 이미지 선택'
                        : '이미지 선택'}
                    </label>

                    {selectedBadgeImage && (
                      <>
                        <button
                          type="button"
                          onClick={handleSaveBadgeImage}
                          disabled={!badgeEditable || badgeBusy}
                          className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                          {badgeImageSaving
                            ? '이미지 저장 중...'
                            : challenge.hasBadgeCenterImage
                              ? '이미지 교체'
                              : '이미지 등록'}
                        </button>

                        <button
                          type="button"
                          onClick={handleCancelBadgeImageSelection}
                          disabled={badgeBusy}
                          className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed"
                        >
                          선택 취소
                        </button>
                      </>
                    )}

                    {challenge.hasBadgeCenterImage && !selectedBadgeImage && (
                      <button
                        type="button"
                        onClick={handleDeleteBadgeImage}
                        disabled={!badgeEditable || badgeBusy}
                        className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        {badgeImageDeleting ? '삭제 중...' : '이미지 삭제'}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {badgeMessage && (
                <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-sm font-semibold text-emerald-700">
                    {badgeMessage}
                  </p>
                </div>
              )}

              {badgeError && (
                <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
                  <p className="text-sm font-semibold text-red-700">
                    {badgeError}
                  </p>
                </div>
              )}

              <div className="mt-6 flex justify-end border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={handleSaveBadgeSettings}
                  disabled={!badgeEditable || badgeBusy}
                  className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {badgeSaving ? '배지 설정 저장 중...' : '완료 배지 설정 저장'}
                </button>
              </div>
            </div>
          </div>
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
            <div>
              <p className="text-sm font-bold text-slate-800">추천 이동수단</p>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                Challenge 요약 지도에서 Mission 간 추천 이동 경로를 계산할 때
                사용할 이동수단입니다. Mission 수행 순서를 강제하지는 않습니다.
              </p>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {(
                [
                  {
                    value: 'WALKING',
                    label: '도보',
                    icon: '🚶',
                    description: '걸어서 이동하는 경로',
                  },
                  {
                    value: 'CYCLING',
                    label: '자전거',
                    icon: '🚲',
                    description: '자전거 이동 경로',
                  },
                  {
                    value: 'DRIVING',
                    label: '자동차',
                    icon: '🚗',
                    description: '자동차 이동 경로',
                  },
                ] satisfies Array<{
                  value: ChallengeRouteMode
                  label: string
                  icon: string
                  description: string
                }>
              ).map((option) => {
                const selected = routeMode === option.value

                return (
                  <label
                    key={option.value}
                    className={`rounded-2xl border p-4 transition ${
                      !challengeEditable || saving
                        ? 'cursor-not-allowed border-slate-200 bg-slate-100 opacity-70'
                        : selected
                          ? 'cursor-pointer border-sky-500 bg-sky-50 ring-2 ring-sky-100'
                          : 'cursor-pointer border-slate-200 bg-white hover:border-sky-300 hover:bg-sky-50/40'
                    }`}
                  >
                    <input
                      type="radio"
                      name="routeMode"
                      value={option.value}
                      checked={selected}
                      onChange={() => setRouteMode(option.value)}
                      disabled={!challengeEditable || saving}
                      className="sr-only"
                    />

                    <div className="flex items-center gap-3">
                      <span className="text-2xl" aria-hidden="true">
                        {option.icon}
                      </span>

                      <div>
                        <p
                          className={`text-sm font-bold ${
                            selected ? 'text-sky-700' : 'text-slate-800'
                          }`}
                        >
                          {option.label}
                        </p>

                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {option.description}
                        </p>
                      </div>
                    </div>
                  </label>
                )
              })}
            </div>

            {challenge.status === 'ACTIVE' && (
              <p className="mt-3 text-xs font-semibold text-emerald-600">
                추천 이동수단은 운영 중에도 변경할 수 있습니다.
              </p>
            )}
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

/*
 * ACTIVE Mission 수에 따른 자동 배지 형태
 */
function getBadgeShape(activeMissionCount: number): BadgeShape {
  if (activeMissionCount <= 2) {
    return 'CIRCLE'
  }

  if (activeMissionCount === 3) {
    return 'TRIANGLE'
  }

  if (activeMissionCount === 4) {
    return 'DIAMOND'
  }

  if (activeMissionCount === 5) {
    return 'PENTAGON'
  }

  if (activeMissionCount === 6) {
    return 'HEXAGON'
  }

  return 'SHIELD'
}

function getBadgeShapeLabel(shape: BadgeShape) {
  switch (shape) {
    case 'CIRCLE':
      return '원형'

    case 'TRIANGLE':
      return '정삼각형'

    case 'DIAMOND':
      return '마름모'

    case 'PENTAGON':
      return '오각형'

    case 'HEXAGON':
      return '육각형'

    case 'SHIELD':
      return '방패형'
  }
}

/*
 * SVG 기반 완료 배지 실시간 미리보기
 */
function BadgePreview({
  shape,
  borderColor,
  centerType,
  icon,
  imageUrl,
  imageScale,
  imagePositionX,
  imagePositionY,
}: {
  shape: BadgeShape
  borderColor: string
  centerType: BadgeCenterType
  icon: string
  imageUrl: string | null
  imageScale: number
  imagePositionX: number
  imagePositionY: number
}) {
  const path = getBadgeSvgPath(shape)

  const baseImageSize = 176

  const scaledImageSize = baseImageSize * (imageScale / 100)

  const movableSpace = baseImageSize - scaledImageSize

  const imageX = 12 + movableSpace * (imagePositionX / 100)

  const imageY = 12 + movableSpace * (imagePositionY / 100)

  return (
    <div className="relative h-52 w-52">
      <svg
        viewBox="0 0 200 200"
        className="h-full w-full drop-shadow-lg"
        role="img"
        aria-label={`${getBadgeShapeLabel(shape)} 완료 배지 미리보기`}
      >
        <defs>
          <clipPath id="badge-preview-clip">
            <path d={path} />
          </clipPath>
        </defs>

        <path d={path} fill="#FFFFFF" />

        {centerType === 'IMAGE' && imageUrl && (
          <image
            href={imageUrl}
            x={imageX}
            y={imageY}
            width={scaledImageSize}
            height={scaledImageSize}
            preserveAspectRatio="xMidYMid slice"
            clipPath="url(#badge-preview-clip)"
          />
        )}

        <path
          d={path}
          fill="none"
          stroke={borderColor}
          strokeWidth="12"
          strokeLinejoin="round"
        />
      </svg>

      {centerType === 'ICON' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="text-6xl" aria-hidden="true">
            {icon}
          </span>
        </div>
      )}

      {centerType === 'IMAGE' && !imageUrl && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="text-6xl" aria-hidden="true">
            🖼️
          </span>
        </div>
      )}
    </div>
  )
}

/*
 * 각 배지 형태의 SVG 경로
 */
function getBadgeSvgPath(shape: BadgeShape) {
  switch (shape) {
    case 'CIRCLE':
      return 'M100 18 A82 82 0 1 1 99.99 18 Z'

    case 'TRIANGLE':
      return 'M100 18 L178 160 L22 160 Z'

    case 'DIAMOND':
      return 'M100 15 L180 100 L100 185 L20 100 Z'

    case 'PENTAGON':
      return 'M100 15 L181 74 L150 170 L50 170 L19 74 Z'

    case 'HEXAGON':
      return 'M55 22 L145 22 L188 100 L145 178 L55 178 L12 100 Z'

    case 'SHIELD':
      return 'M100 14 L174 40 L166 113 C160 151 135 174 100 188 C65 174 40 151 34 113 L26 40 Z'
  }
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
