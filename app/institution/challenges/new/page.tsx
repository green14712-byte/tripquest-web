'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
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

export default function NewChallengePage() {
  const router = useRouter()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [region, setRegion] = useState('')
  const [startAt, setStartAt] = useState('')
  const [endAt, setEndAt] = useState('')

  const [coverImage, setCoverImage] = useState<File | null>(null)

  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null)

  /*
   * Challenge 대표사진 초점 위치
   *
   * X / Y 모두 0 ~ 100 백분율 값으로 저장한다.
   *
   * 50 / 50은 사진의 정중앙이다.
   */
  const [coverPositionX, setCoverPositionX] = useState(50)
  const [coverPositionY, setCoverPositionY] = useState(50)

  const [loading, setLoading] = useState(false)

  const [checkingAuth, setCheckingAuth] = useState(true)

  const [error, setError] = useState('')

  useEffect(() => {
    async function checkAuth() {
      const accessToken = sessionStorage.getItem('accessToken')

      if (!accessToken) {
        router.replace('/login')
        return
      }

      try {
        const response = await fetch('http://localhost:3001/auth/me', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })

        if (response.status === 401) {
          sessionStorage.removeItem('accessToken')
          sessionStorage.removeItem('user')

          router.replace('/login')
          return
        }

        if (!response.ok) {
          throw new Error('로그인 정보를 확인할 수 없습니다.')
        }

        const data = await response.json()

        const user = data.user ?? data

        if (user.role !== 'INSTITUTION') {
          setError('기관 계정만 Challenge를 만들 수 있습니다.')
        }
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message)
        } else {
          setError('계정 정보를 확인하는 중 오류가 발생했습니다.')
        }
      } finally {
        setCheckingAuth(false)
      }
    }

    checkAuth()
  }, [router])

  /*
   * 브라우저에서 만든 이미지 미리보기 URL은
   * 더 이상 사용하지 않을 때 해제한다.
   */
  useEffect(() => {
    return () => {
      if (coverPreviewUrl) {
        URL.revokeObjectURL(coverPreviewUrl)
      }
    }
  }, [coverPreviewUrl])

  function handleCoverImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    setError('')

    if (!file) {
      return
    }

    /*
     * 프런트에서도 1차 검증한다.
     *
     * 실제 보안 검증은 백엔드에서 다시 수행한다.
     */
    if (!ALLOWED_COVER_IMAGE_TYPES.has(file.type)) {
      event.target.value = ''

      setError(
        'Challenge 대표사진은 JPG, JPEG, PNG, WEBP 파일만 선택할 수 있습니다.',
      )

      return
    }

    if (file.size <= 0) {
      event.target.value = ''

      setError('비어 있는 이미지는 선택할 수 없습니다.')

      return
    }

    if (file.size > MAX_COVER_IMAGE_SIZE) {
      event.target.value = ''

      setError('Challenge 대표사진은 최대 10MB까지 등록할 수 있습니다.')

      return
    }

    if (coverPreviewUrl) {
      URL.revokeObjectURL(coverPreviewUrl)
    }

    const previewUrl = URL.createObjectURL(file)

    setCoverImage(file)

    setCoverPreviewUrl(previewUrl)

    /*
     * 새 사진을 선택하면 이전 사진에서 설정했던
     * 초점이 의미가 없으므로 중앙으로 초기화한다.
     */
    setCoverPositionX(50)
    setCoverPositionY(50)
  }

  /*
   * 대표사진 미리보기에서 클릭한 위치를
   * 0 ~ 100 백분율 좌표로 변환한다.
   */
  function handleCoverFocusClick(event: ReactMouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect()

    if (rect.width <= 0 || rect.height <= 0) {
      return
    }

    const rawX = ((event.clientX - rect.left) / rect.width) * 100

    const rawY = ((event.clientY - rect.top) / rect.height) * 100

    const nextX = Math.min(100, Math.max(0, rawX))

    const nextY = Math.min(100, Math.max(0, rawY))

    /*
     * 지나치게 긴 소수값은 필요하지 않으므로
     * 소수 둘째 자리까지 저장한다.
     */
    setCoverPositionX(Number(nextX.toFixed(2)))
    setCoverPositionY(Number(nextY.toFixed(2)))
  }

  function resetCoverFocus() {
    setCoverPositionX(50)
    setCoverPositionY(50)
  }

  function handleRemoveCoverImage() {
    if (coverPreviewUrl) {
      URL.revokeObjectURL(coverPreviewUrl)
    }

    setCoverImage(null)

    setCoverPreviewUrl(null)

    setCoverPositionX(50)
    setCoverPositionY(50)

    setError('')

    const input = document.getElementById(
      'coverImage',
    ) as HTMLInputElement | null

    if (input) {
      input.value = ''
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!title.trim()) {
      setError('Challenge 제목을 입력해주세요.')
      return
    }

    if (startAt && endAt) {
      if (new Date(startAt).getTime() >= new Date(endAt).getTime()) {
        setError('종료일은 시작일보다 이후여야 합니다.')

        return
      }
    }

    if (coverImage) {
      if (!ALLOWED_COVER_IMAGE_TYPES.has(coverImage.type)) {
        setError(
          'Challenge 대표사진은 JPG, JPEG, PNG, WEBP 파일만 등록할 수 있습니다.',
        )

        return
      }

      if (coverImage.size > MAX_COVER_IMAGE_SIZE) {
        setError('Challenge 대표사진은 최대 10MB까지 등록할 수 있습니다.')

        return
      }
    }

    const accessToken = sessionStorage.getItem('accessToken')

    if (!accessToken) {
      router.replace('/login')
      return
    }

    setLoading(true)

    setError('')

    try {
      /*
       * 사진 파일과 Challenge 기본정보를
       * 한 요청에서 함께 보내기 위해
       * FormData를 사용한다.
       */
      const formData = new FormData()

      formData.append('title', title.trim())

      if (description.trim()) {
        formData.append('description', description.trim())
      }

      if (region.trim()) {
        formData.append('region', region.trim())
      }

      if (startAt) {
        formData.append('startAt', new Date(startAt).toISOString())
      }

      if (endAt) {
        formData.append('endAt', new Date(endAt).toISOString())
      }

      if (coverImage) {
        formData.append('coverImage', coverImage)

        /*
         * 대표사진을 함께 등록하는 경우
         * 사용자가 선택한 초점 위치도 함께 저장한다.
         */
        formData.append('coverPositionX', String(coverPositionX))

        formData.append('coverPositionY', String(coverPositionY))
      }

      const response = await fetch('http://localhost:3001/challenges', {
        method: 'POST',

        /*
         * FormData를 사용할 때는
         * Content-Type을 직접 지정하지 않는다.
         *
         * 브라우저가 multipart boundary를
         * 자동으로 설정해야 한다.
         */
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },

        body: formData,
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

        throw new Error(message ?? 'Challenge 생성에 실패했습니다.')
      }

      /*
       * 생성 직후 Challenge는
       * DRAFT 상태로 저장된다.
       *
       * 생성이 완료되면
       * Challenge 관리 목록으로 이동한다.
       */
      router.push('/institution/challenges')

      router.refresh()
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Challenge 생성 중 오류가 발생했습니다.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (checkingAuth) {
    return (
      <main className="flex flex-1 items-center justify-center bg-slate-50 px-6 py-20">
        <p className="font-semibold text-slate-500">
          계정 정보를 확인하는 중...
        </p>
      </main>
    )
  }

  return (
    <main className="flex flex-1 justify-center bg-slate-50 px-6 py-12">
      <div className="w-full max-w-3xl">
        <Link
          href="/institution/challenges"
          className="text-sm font-bold text-slate-500 hover:text-slate-800"
        >
          ← Challenge 관리
        </Link>

        <div className="mt-6">
          <p className="text-sm font-bold tracking-widest text-sky-600">
            NEW CHALLENGE
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            새 Challenge 만들기
          </h1>

          <p className="mt-2 text-slate-600">
            Challenge 기본정보와 대표사진을 등록합니다. Mission과 QR은
            Challenge를 만든 후 상세 관리 화면에서 추가합니다.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-8 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm"
        >
          {/* 대표사진 */}
          <div>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <label
                  htmlFor="coverImage"
                  className="text-sm font-bold text-slate-800"
                >
                  Challenge 대표사진
                </label>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  여행자가 Challenge 목록과 상세 화면에서 보게 되는 사진입니다.
                </p>
              </div>

              <span className="text-xs font-semibold text-slate-400">
                선택사항
              </span>
            </div>

            {coverPreviewUrl ? (
              <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                {/*
                 * 실제 공개 상세 화면과 비슷한 비율로
                 * 초점 위치를 바로 확인할 수 있도록 한다.
                 */}
                <div
                  className="group relative aspect-16/7 w-full cursor-crosshair overflow-hidden"
                  onClick={handleCoverFocusClick}
                  title="사진에서 중심으로 보여줄 위치를 클릭하세요."
                >
                  <img
                    src={coverPreviewUrl}
                    alt="Challenge 대표사진 미리보기"
                    className="h-full w-full select-none object-cover"
                    style={{
                      objectPosition: `${coverPositionX}% ${coverPositionY}%`,
                    }}
                    draggable={false}
                  />

                  {/*
                   * 사용자가 선택한 초점 표시
                   */}
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

                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 via-black/30 to-transparent px-5 pb-5 pt-16 text-white">
                    <p className="text-xs font-bold text-white/80">
                      상세 화면 미리보기
                    </p>

                    <p className="mt-1 line-clamp-1 text-xl font-bold">
                      {title.trim() || 'Challenge 제목'}
                    </p>

                    <p className="mt-1 text-sm text-white/80">
                      📍 {region.trim() || '지역 미설정'}
                    </p>
                  </div>

                  <div className="pointer-events-none absolute right-4 top-4 rounded-full bg-black/60 px-3 py-1.5 text-xs font-bold text-white backdrop-blur">
                    사진을 클릭해 초점 지정
                  </div>
                </div>

                {/* 초점 위치 설정 */}
                <div className="border-t border-slate-200 bg-white px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold text-slate-800">
                        대표사진 초점
                      </p>

                      <p className="mt-1 max-w-lg text-xs leading-5 text-slate-500">
                        사진에서 가장 중요하게 보여줄 위치를 클릭하세요.
                        Challenge 목록과 상세 화면에서 사진이 잘릴 때 이 지점을
                        기준으로 표시합니다.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={resetCoverFocus}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
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
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-white px-4 py-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-700">
                      {coverImage?.name}
                    </p>

                    {coverImage && (
                      <p className="mt-1 text-xs text-slate-400">
                        {(coverImage.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleRemoveCoverImage}
                    className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-bold text-red-600 transition hover:bg-red-50"
                  >
                    선택 취소
                  </button>
                </div>
              </div>
            ) : (
              <label
                htmlFor="coverImage"
                className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center transition hover:border-sky-400 hover:bg-sky-50"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-2xl shadow-sm">
                  📷
                </div>

                <p className="mt-4 font-bold text-slate-700">
                  대표사진을 선택해주세요
                </p>

                <p className="mt-2 text-sm text-slate-500">
                  JPG, JPEG, PNG, WEBP · 최대 10MB
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  가로로 넓은 관광지 사진을 권장합니다.
                </p>
              </label>
            )}

            <input
              id="coverImage"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleCoverImageChange}
              className="hidden"
            />

            {coverPreviewUrl && (
              <label
                htmlFor="coverImage"
                className="mt-3 inline-flex cursor-pointer rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                다른 사진 선택
              </label>
            )}
          </div>

          {/* 제목 */}
          <div className="mt-8">
            <label htmlFor="title" className="text-sm font-bold text-slate-800">
              Challenge 제목
              <span className="ml-1 text-red-500">*</span>
            </label>

            <input
              id="title"
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              minLength={2}
              maxLength={100}
              placeholder="예: 서울 궁궐 여행 Challenge"
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500"
              required
            />
          </div>

          {/* 설명 */}
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
              maxLength={2000}
              rows={6}
              placeholder="여행자가 어떤 장소를 방문하고 어떤 경험을 하게 되는지 설명해주세요."
              className="mt-2 w-full resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500"
            />

            <p className="mt-1 text-right text-xs text-slate-400">
              {description.length} / 2000
            </p>
          </div>

          {/* 지역 */}
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
              maxLength={100}
              placeholder="예: 서울"
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500"
            />
          </div>

          {/* 운영 기간 */}
          <div className="mt-6">
            <p className="text-sm font-bold text-slate-800">운영 기간</p>

            <p className="mt-1 text-xs text-slate-500">
              지금 정하지 않아도 나중에 수정할 수 있습니다.
            </p>

            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="startAt"
                  className="text-xs font-bold text-slate-500"
                >
                  시작일
                </label>

                <input
                  id="startAt"
                  type="datetime-local"
                  value={startAt}
                  onChange={(event) => setStartAt(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500"
                />
              </div>

              <div>
                <label
                  htmlFor="endAt"
                  className="text-xs font-bold text-slate-500"
                >
                  종료일
                </label>

                <input
                  id="endAt"
                  type="datetime-local"
                  value={endAt}
                  onChange={(event) => setEndAt(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500"
                />
              </div>
            </div>
          </div>

          {/* 안내 */}
          <div className="mt-7 rounded-2xl bg-sky-50 p-5">
            <p className="text-sm font-bold text-sky-800">
              처음에는 작성 중 상태로 저장됩니다.
            </p>

            <p className="mt-1 text-sm leading-6 text-sky-700">
              Challenge를 만든 뒤 Mission, 장소 인증, QR 등의 내용을 모두 준비한
              후 운영 상태로 전환하게 됩니다.
            </p>
          </div>

          {/* 오류 */}
          {error && (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
              {error}
            </div>
          )}

          {/* 버튼 */}
          <div className="mt-8 flex flex-wrap justify-end gap-3">
            <Link
              href="/institution/challenges"
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-bold text-slate-700 transition hover:bg-slate-50"
            >
              취소
            </Link>

            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-sky-600 px-6 py-3 font-bold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {loading ? '생성 중...' : 'Challenge 만들기'}
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}
