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
import QRCode from 'qrcode'

import MissionLocationMap from '../../../../../components/mission-location-map'

type VerificationMode = 'LOCATION_ONLY' | 'LOCATION_AND_QR' | 'LOCATION_OR_QR'

type Challenge = {
  id: number
  title: string
  status: string
}

type CreatedMission = {
  id: number
  title: string
  verificationMode: VerificationMode
  hasPhotoImage: boolean
}

const MAX_PHOTO_SIZE = 10 * 1024 * 1024

const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export default function NewMissionPage() {
  const router = useRouter()

  const params = useParams()

  const challengeId = Array.isArray(params.id) ? params.id[0] : params.id

  const [challenge, setChallenge] = useState<Challenge | null>(null)

  const [title, setTitle] = useState('')

  const [description, setDescription] = useState('')

  const [address, setAddress] = useState('')

  const [latitude, setLatitude] = useState<number | null>(null)

  const [longitude, setLongitude] = useState<number | null>(null)

  const [verificationRadius, setVerificationRadius] = useState(100)

  const [verificationMode, setVerificationMode] =
    useState<VerificationMode>('LOCATION_AND_QR')

  const [qrLocationNote, setQrLocationNote] = useState('')

  const [loading, setLoading] = useState(false)

  const [pageLoading, setPageLoading] = useState(true)

  const [error, setError] = useState('')

  /*
   * QR 방식 Mission 생성 후
   * 발급된 QR을 바로 보여주기 위한 상태
   */
  const [createdMission, setCreatedMission] = useState<CreatedMission | null>(
    null,
  )

  const [qrImageUrl, setQrImageUrl] = useState('')

  const [qrPath, setQrPath] = useState('')

  /*
   * Mission 관광지 대표사진.
   *
   * Mission 생성 요청과 함께
   * multipart/form-data의 photoImage 필드로 전송한다.
   */
  const [photoFile, setPhotoFile] = useState<File | null>(null)

  const [photoPreviewUrl, setPhotoPreviewUrl] = useState('')

  /*
   * Mission 관광지 대표사진 초점 위치.
   *
   * 0 ~ 100 백분율 좌표를 사용한다.
   *
   * 50 / 50
   * → 사진 중앙
   */
  const [photoPositionX, setPhotoPositionX] = useState(50)

  const [photoPositionY, setPhotoPositionY] = useState(50)

  /*
   * 선택한 로컬 이미지의 미리보기 URL을 생성한다.
   *
   * 파일이 변경되거나 페이지가 정리될 때
   * 기존 Object URL을 해제해 메모리 누수를 막는다.
   */
  useEffect(() => {
    if (!photoFile) {
      setPhotoPreviewUrl('')
      return
    }

    const url = URL.createObjectURL(photoFile)

    setPhotoPreviewUrl(url)

    return () => URL.revokeObjectURL(url)
  }, [photoFile])

  /*
   * 관광지 대표사진 선택
   *
   * Frontend에서도 기본적인 MIME / 크기 검사를 하지만,
   * 최종 검증은 Backend에서 다시 수행한다.
   */
  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    /*
     * 같은 파일을 다시 선택할 수 있도록
     * 브라우저 input 값을 초기화한다.
     *
     * 실제 선택 파일은 photoFile state에 보관한다.
     */
    event.target.value = ''

    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      setError('대표사진은 JPG, JPEG, PNG, WEBP 형식만 업로드할 수 있습니다.')

      return
    }

    if (file.size <= 0) {
      setError('빈 파일은 대표사진으로 등록할 수 없습니다.')

      return
    }

    if (file.size > MAX_PHOTO_SIZE) {
      setError('대표사진 크기는 10MB 이하여야 합니다.')

      return
    }

    setError('')

    setPhotoFile(file)

    /*
     * 새 사진을 선택하면
     * 이전 사진에서 지정했던 초점을 재사용하지 않고
     * 중앙에서 다시 시작한다.
     */
    setPhotoPositionX(50)

    setPhotoPositionY(50)
  }

  /*
   * 관광지 대표사진 미리보기에서
   * 사용자가 클릭한 위치를 0 ~ 100% 좌표로 변환한다.
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
  }

  function resetPhotoFocus() {
    setPhotoPositionX(50)

    setPhotoPositionY(50)
  }

  /*
   * 현재 Challenge가
   * 로그인 기관 소유인지 확인한다.
   */
  useEffect(() => {
    async function loadChallenge() {
      const accessToken = sessionStorage.getItem('accessToken')

      if (!accessToken) {
        router.replace('/login')

        return
      }

      if (!challengeId) {
        setError('Challenge 정보를 확인할 수 없습니다.')

        setPageLoading(false)

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

        setChallenge(data.challenge)
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message)
        } else {
          setError('Challenge 정보를 확인하는 중 오류가 발생했습니다.')
        }
      } finally {
        setPageLoading(false)
      }
    }

    loadChallenge()
  }, [challengeId, router])

  function handleLocationChange(newLatitude: number, newLongitude: number) {
    setLatitude(newLatitude)

    setLongitude(newLongitude)
  }

  function handleRadiusChange(value: number) {
    /*
     * 백엔드 DTO와 동일하게
     * 10m ~ 1000m 범위로 제한
     */
    const normalizedRadius = Math.min(1000, Math.max(10, value))

    setVerificationRadius(normalizedRadius)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!challengeId) {
      setError('Challenge 정보를 확인할 수 없습니다.')

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

    const requiresQr =
      verificationMode === 'LOCATION_AND_QR' ||
      verificationMode === 'LOCATION_OR_QR'

    if (requiresQr && !qrLocationNote.trim()) {
      setError('QR을 사용하는 Mission은 QR 설치 위치를 입력해주세요.')

      return
    }

    const accessToken = sessionStorage.getItem('accessToken')

    if (!accessToken) {
      router.replace('/login')

      return
    }

    setLoading(true)

    setError('')

    /*
     * Mission 생성 API는
     * multipart/form-data를 사용한다.
     *
     * Mission 정보, 대표사진,
     * 대표사진 초점 좌표를 하나의 요청으로 전송한다.
     */
    try {
      const formData = new FormData()

      formData.append('title', title.trim())

      if (description.trim()) {
        formData.append('description', description.trim())
      }

      if (address.trim()) {
        formData.append('address', address.trim())
      }

      /*
       * FormData는 숫자를 문자열로 전송한다.
       *
       * Backend CreateMissionDto의
       * @Type(() => Number) + ValidationPipe transform:true가
       * 실제 number로 변환한다.
       */
      formData.append('latitude', String(latitude))

      formData.append('longitude', String(longitude))

      formData.append('verificationRadius', String(verificationRadius))

      formData.append('verificationMode', verificationMode)

      if (requiresQr && qrLocationNote.trim()) {
        formData.append('qrLocationNote', qrLocationNote.trim())
      }

      /*
       * 대표사진은 선택사항이다.
       *
       * 사진이 선택된 경우에만
       * 사진 파일과 초점 X/Y를 함께 전송한다.
       */
      if (photoFile) {
        formData.append('photoImage', photoFile)

        formData.append('photoPositionX', String(photoPositionX))

        formData.append('photoPositionY', String(photoPositionY))
      }

      const response = await fetch(
        `http://localhost:3001/challenges/${challengeId}/missions`,
        {
          method: 'POST',

          /*
           * multipart/form-data 요청에서는
           * Content-Type을 직접 지정하면 안 된다.
           *
           * 브라우저가 FormData boundary가 포함된
           * Content-Type을 자동으로 설정한다.
           */
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },

          body: formData,
        },
      )

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        const message = Array.isArray(data?.message)
          ? data.message.join(', ')
          : data?.message

        throw new Error(message ?? 'Mission 생성에 실패했습니다.')
      }

      /*
       * Mission + 대표사진 저장까지 Backend에서 모두 성공한 뒤에만
       * 여기까지 도달한다.
       *
       * 사진 업로드 실패 시 Backend가 방금 생성한 Mission도
       * 정리하므로 Frontend에서 별도 재시도 API를 호출하지 않는다.
       */
      const mission: CreatedMission = {
        id: data.mission.id,

        title: data.mission.title,

        verificationMode: data.mission.verificationMode,

        hasPhotoImage: Boolean(data.mission.hasPhotoImage),
      }

      setCreatedMission(mission)

      /*
       * QR을 사용하는 Mission이면
       * Backend에서 전달받은 qrPath를 실제 QR 이미지로 만든다.
       */
      if (data.qrPath) {
        const absoluteQrUrl = `${window.location.origin}${data.qrPath}`

        setQrPath(absoluteQrUrl)

        try {
          const generatedQrImage = await QRCode.toDataURL(absoluteQrUrl, {
            width: 320,

            margin: 2,

            errorCorrectionLevel: 'M',
          })

          setQrImageUrl(generatedQrImage)
        } catch {
          /*
           * QR 이미지 생성에 실패해도
           * Mission 자체와 QR 토큰 생성은 성공한 상태다.
           *
           * 사용자가 아래 QR 연결 주소를 확인할 수 있도록
           * 생성 완료 화면은 그대로 유지한다.
           */
        }
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Mission 생성 중 오류가 발생했습니다.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (pageLoading) {
    return (
      <main className="flex flex-1 items-center justify-center bg-slate-50 px-6 py-20">
        <p className="font-semibold text-slate-500">
          Mission 생성 화면을 준비하는 중...
        </p>
      </main>
    )
  }

  if (error && !challenge) {
    return (
      <main className="flex flex-1 items-center justify-center bg-slate-50 px-6 py-20">
        <div className="w-full max-w-xl rounded-3xl border border-red-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">
            Mission을 만들 수 없습니다.
          </h1>

          <p className="mt-3 text-red-600">{error}</p>

          <Link
            href="/institution/challenges"
            className="mt-6 inline-block font-bold text-sky-600"
          >
            ← Challenge 관리
          </Link>
        </div>
      </main>
    )
  }

  /*
   * Mission 생성 완료 화면.
   *
   * 현재는 Mission 기본정보 + 대표사진 + 대표사진 초점 위치가
   * 하나의 요청으로 처리되므로
   * 여기까지 왔다면 Backend 저장이 완료된 상태다.
   */
  if (createdMission) {
    return (
      <main className="flex flex-1 justify-center bg-slate-50 px-6 py-12">
        <div className="w-full max-w-2xl">
          <div className="rounded-3xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
            <div className="text-5xl">✅</div>

            <h1 className="mt-5 text-2xl font-bold text-slate-900">
              Mission이 생성되었습니다.
            </h1>

            <p className="mt-2 text-slate-600">{createdMission.title}</p>

            {qrPath && (
              <>
                {qrImageUrl ? (
                  <div className="mx-auto mt-8 max-w-sm rounded-3xl border border-slate-200 bg-white p-6">
                    <img
                      src={qrImageUrl}
                      alt="Mission QR Code"
                      className="mx-auto h-auto w-full"
                    />
                  </div>
                ) : (
                  <p className="mt-6 text-sm text-amber-700">
                    QR 이미지 생성에 실패했습니다. 아래 주소를 확인해주세요.
                  </p>
                )}

                <div className="mt-6 rounded-2xl bg-amber-50 p-5 text-left">
                  <p className="font-bold text-amber-800">QR을 확인해주세요.</p>

                  <p className="mt-2 text-sm leading-6 text-amber-700">
                    QR 원본은 평문으로 DB에 저장되지 않습니다. 이 화면을
                    벗어나더라도 기관 Mission 관리 화면에서 기존 QR을 다시
                    조회할 수 있습니다.
                  </p>
                </div>

                <div className="mt-6 rounded-xl bg-slate-50 p-4 text-left">
                  <p className="text-xs font-bold text-slate-400">
                    QR 연결 주소
                  </p>

                  <p className="mt-2 break-all text-sm text-slate-600">
                    {qrPath}
                  </p>
                </div>
              </>
            )}

            {createdMission.hasPhotoImage && (
              <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-left">
                <p className="font-bold text-emerald-800">관광지 대표사진</p>

                <p className="mt-2 text-sm text-emerald-700">
                  선택한 대표사진과 초점 위치가 Mission에 저장되었습니다.
                </p>

                {photoPreviewUrl && (
                  <div className="mt-4 overflow-hidden rounded-2xl border border-emerald-200 bg-white">
                    <div className="relative aspect-video w-full overflow-hidden">
                      <img
                        src={photoPreviewUrl}
                        alt="저장된 관광지 대표사진 미리보기"
                        className="h-full w-full object-cover"
                        style={{
                          objectPosition: `${photoPositionX}% ${photoPositionY}%`,
                        }}
                      />
                    </div>

                    <div className="border-t border-emerald-100 px-4 py-3 text-xs text-emerald-700">
                      저장된 초점 위치: X {photoPositionX.toFixed(0)}% · Y{' '}
                      {photoPositionY.toFixed(0)}%
                    </div>
                  </div>
                )}
              </div>
            )}

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

  if (!challenge) {
    return null
  }

  const requiresQr =
    verificationMode === 'LOCATION_AND_QR' ||
    verificationMode === 'LOCATION_OR_QR'

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
            NEW MISSION
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            Mission 추가
          </h1>

          <p className="mt-2 text-slate-600">
            Mission의 인증 방식과 위치를 설정합니다.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-8 grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]"
        >
          {/* 왼쪽: Mission 정보 */}
          <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">Mission 정보</h2>

            {/* 제목 */}
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
                placeholder="예: 중부대학교 정문 방문"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500"
                required
              />
            </div>

            {/* 설명 */}
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
                placeholder="여행자가 수행할 내용을 설명해주세요."
                className="mt-2 w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500"
              />
            </div>

            {/* 주소 */}
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
                placeholder="예: 경기도 고양시 덕양구"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500"
              />

              <p className="mt-2 text-xs text-slate-400">
                현재는 주소를 직접 입력하고 지도에서 실제 위치를 선택합니다.
              </p>
            </div>

            {/* Mission 관광지 대표사진 (선택) */}
            <div className="mt-7 border-t border-slate-100 pt-6">
              <label
                htmlFor="mission-photo"
                className="text-sm font-bold text-slate-800"
              >
                관광지 대표사진 (선택)
              </label>

              <p className="mt-2 text-xs text-slate-500">
                JPG / JPEG / PNG / WEBP, 최대 10MB. 관광객에게 공개할 공식
                사진입니다.
              </p>

              <input
                id="mission-photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhotoChange}
                className="mt-3 block w-full text-sm text-slate-700 file:mr-4 file:rounded-xl file:border-0 file:bg-sky-50 file:px-4 file:py-2 file:font-bold file:text-sky-700"
              />

              {photoPreviewUrl && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold text-sky-700">
                    사진에서 중요하게 보여줄 위치를 클릭해주세요.
                  </p>

                  <div
                    role="button"
                    tabIndex={0}
                    aria-label="관광지 대표사진 초점 위치 선택"
                    onClick={handlePhotoFocusClick}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        resetPhotoFocus()
                      }
                    }}
                    className="relative aspect-video w-full cursor-crosshair overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 outline-none ring-sky-400 focus:ring-2"
                  >
                    <img
                      src={photoPreviewUrl}
                      alt="관광지 대표사진 미리보기"
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
                      <p className="text-xs text-slate-500">
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
                      className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-700 transition hover:bg-sky-100"
                    >
                      가운데로 초기화
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setPhotoFile(null)
                      setPhotoPositionX(50)
                      setPhotoPositionY(50)
                      setError('')
                    }}
                    className="mt-3 rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                  >
                    사진 선택 취소
                  </button>
                </div>
              )}
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

              <p className="mt-2 text-xs text-slate-400">
                오른쪽 지도에서 인증 가능 범위를 실시간으로 확인할 수 있습니다.
              </p>
            </div>

            {/* QR 설치 위치 */}
            {requiresQr && (
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
                  Mission 생성과 동시에 QR이 자동 발급됩니다.
                </p>
              </div>
            )}

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
                disabled={loading}
                className="rounded-xl bg-sky-600 px-6 py-3 font-bold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {loading ? '저장 중...' : 'Mission 저장'}
              </button>
            </div>
          </div>

          {/* 오른쪽: 지도 */}
          <div className="lg:sticky lg:top-24">
            <div className="mb-3">
              <h2 className="text-xl font-bold text-slate-900">Mission 위치</h2>

              <p className="mt-1 text-sm text-slate-500">
                지도를 클릭해서 Mission의 중심 위치를 선택해주세요.
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
                      인증 가능 범위
                    </p>

                    <p className="mt-1 text-lg font-bold text-sky-700">
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
