'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type UserRole = 'USER' | 'INSTITUTION' | 'ADMIN'
type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'DELETED'

type CurrentUser = {
  id: number
  email: string
  nickname: string | null
  role: UserRole
  status: AccountStatus
  institutionId: number | null
}

type InstitutionApplication = {
  id: number
  institutionName: string
  representativeName: string
  contactEmail: string
  contactPhone?: string | null
  address?: string | null
  website?: string | null
  description?: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  rejectionReason?: string | null
  createdAt?: string
  reviewedAt?: string | null
}

type ApiResponse = {
  message?: string | string[]

  verificationToken?: string

  accessToken?: string

  user?: CurrentUser

  application?: {
    id: number
    status: string
    institutionName: string
  }

  proof?: {
    id: number
    applicationId: number
    originalName: string
    mimeType: string
    fileSize: number
    createdAt: string
  }
}

const ALLOWED_PROOF_TYPES = ['application/pdf', 'image/jpeg', 'image/png']

const MAX_PROOF_FILE_SIZE = 50 * 1024 * 1024

const MAX_TOTAL_PROOF_SIZE = 300 * 1024 * 1024

function getMessage(message: string | string[] | undefined, fallback: string) {
  if (Array.isArray(message)) {
    return message.join(' ')
  }

  return message ?? fallback
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

function getTotalFileSize(files: File[]) {
  return files.reduce((total, file) => total + file.size, 0)
}

function isSameFile(a: File, b: File) {
  return (
    a.name === b.name && a.size === b.size && a.lastModified === b.lastModified
  )
}

export default function InstitutionSignupPage() {
  const router = useRouter()

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1)

  /*
   * 현재 로그인 계정을
   * 기관 신청에 그대로 사용할지 여부
   */
  const [existingAccount, setExistingAccount] = useState(false)

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)

  const [authChecking, setAuthChecking] = useState(true)

  /*
   * 로그인된 계정이 이미
   * 기관 계정이거나 PENDING 신청이 있는 경우
   * 신청 폼 대신 안내를 표시한다.
   */
  const [blockedReason, setBlockedReason] = useState('')

  /*
   * 이전 거절 신청이 있으면
   * 재신청 안내에 사용한다.
   */
  const [previousRejectedApplication, setPreviousRejectedApplication] =
    useState<InstitutionApplication | null>(null)

  /*
   * 새 계정 생성용 정보
   */
  const [email, setEmail] = useState('')

  const [code, setCode] = useState('')

  const [verificationToken, setVerificationToken] = useState('')

  const [nickname, setNickname] = useState('')

  const [password, setPassword] = useState('')

  const [passwordConfirm, setPasswordConfirm] = useState('')

  /*
   * 기관 정보
   */
  const [institutionName, setInstitutionName] = useState('')

  const [representativeName, setRepresentativeName] = useState('')

  const [contactEmail, setContactEmail] = useState('')

  const [contactPhone, setContactPhone] = useState('')

  const [address, setAddress] = useState('')

  const [website, setWebsite] = useState('')

  const [description, setDescription] = useState('')

  /*
   * 다중 증빙자료
   */
  const [proofFiles, setProofFiles] = useState<File[]>([])

  /*
   * 신청 생성 후
   * 추가 파일 업로드 중 오류가 발생하면
   * 실패한 파일부터 다시 업로드하기 위해 사용
   */
  const [applicationId, setApplicationId] = useState<number | null>(null)

  const [nextProofIndex, setNextProofIndex] = useState(0)

  const [loading, setLoading] = useState(false)

  const [message, setMessage] = useState('')

  const [error, setError] = useState('')

  /*
   * 페이지에 들어왔을 때
   * 이미 로그인된 사용자라면
   * 기존 계정으로 기관 신청을 진행한다.
   */
  useEffect(() => {
    async function checkExistingAccount() {
      const accessToken = sessionStorage.getItem('accessToken')

      /*
       * 로그인되어 있지 않으면
       * 기존 1단계 회원가입 흐름을 그대로 사용한다.
       */
      if (!accessToken) {
        setAuthChecking(false)

        return
      }

      try {
        const meResponse = await fetch('http://localhost:3001/auth/me', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },

          cache: 'no-store',
        })

        /*
         * 저장된 토큰이 만료됐거나
         * 더 이상 사용할 수 없으면
         * 로그아웃 상태로 새 가입 흐름을 사용한다.
         */
        if (meResponse.status === 401 || meResponse.status === 403) {
          sessionStorage.removeItem('accessToken')

          sessionStorage.removeItem('user')

          setAuthChecking(false)

          return
        }

        if (!meResponse.ok) {
          throw new Error('현재 로그인 정보를 확인할 수 없습니다.')
        }

        const meData = await meResponse.json()

        const user: CurrentUser = meData.user ?? meData

        setCurrentUser(user)

        sessionStorage.setItem('user', JSON.stringify(user))

        /*
         * 이미 승인된 기관 계정은
         * 새 기관 신청을 할 수 없다.
         */
        if (user.role === 'INSTITUTION' || user.institutionId !== null) {
          setExistingAccount(true)

          setBlockedReason(
            '이미 승인된 기관 계정입니다. 새로운 기관 가입 신청을 제출할 수 없습니다.',
          )

          return
        }

        /*
         * ADMIN 계정도 기관 신청 대상에서 제외
         */
        if (user.role === 'ADMIN') {
          setExistingAccount(true)

          setBlockedReason(
            '관리자 계정으로는 기관 가입 신청을 제출할 수 없습니다.',
          )

          return
        }

        /*
         * 현재 일반 USER 계정이라면
         * 기존 계정을 그대로 사용한다.
         */
        setExistingAccount(true)

        setEmail(user.email)

        setNickname(user.nickname ?? '')

        setContactEmail(user.email)

        /*
         * 기존 기관 신청 이력 확인
         */
        const applicationResponse = await fetch(
          'http://localhost:3001/institution-applications/me',
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },

            cache: 'no-store',
          },
        )

        if (applicationResponse.ok) {
          const applicationData = await applicationResponse.json()

          let applications: InstitutionApplication[] = []

          if (Array.isArray(applicationData)) {
            applications = applicationData
          } else if (Array.isArray(applicationData?.applications)) {
            applications = applicationData.applications
          } else if (applicationData?.application) {
            applications = [applicationData.application]
          }

          applications.sort((a, b) => b.id - a.id)

          const latestApplication = applications[0]

          /*
           * 아직 심사 중인 신청이 있으면
           * 중복 신청하지 못하게 한다.
           */
          if (latestApplication?.status === 'PENDING') {
            setBlockedReason(
              '현재 관리자 검토 중인 기관 가입 신청이 있습니다. 심사 결과가 나온 뒤 다시 신청할 수 있습니다.',
            )

            return
          }

          /*
           * 승인된 신청 이력이 있으면
           * 일반적으로 이미 INSTITUTION이어야 한다.
           * 혹시 상태가 불일치하더라도
           * 중복 기관 생성을 막는다.
           */
          if (latestApplication?.status === 'APPROVED') {
            setBlockedReason(
              '이미 승인된 기관 가입 신청이 있습니다. 계정 상태를 다시 확인해주세요.',
            )

            return
          }

          /*
           * 가장 최근 신청이 거절된 경우
           * 재신청 모드로 진입한다.
           *
           * 이전 입력값을 불러와
           * 사용자가 필요한 부분만 수정할 수 있게 한다.
           */
          if (latestApplication?.status === 'REJECTED') {
            setPreviousRejectedApplication(latestApplication)

            setInstitutionName(latestApplication.institutionName ?? '')

            setRepresentativeName(latestApplication.representativeName ?? '')

            setContactEmail(latestApplication.contactEmail || user.email)

            setContactPhone(latestApplication.contactPhone ?? '')

            setAddress(latestApplication.address ?? '')

            setWebsite(latestApplication.website ?? '')

            setDescription(latestApplication.description ?? '')
          }
        } else if (applicationResponse.status !== 404) {
          throw new Error('기존 기관 신청 정보를 확인할 수 없습니다.')
        }

        /*
         * 로그인된 일반 USER는
         * 이메일 인증과 계정 생성을 다시 하지 않고
         * 바로 기관 정보 입력 단계로 이동한다.
         */
        setStep(4)
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message)
        } else {
          setError('로그인 정보를 확인하는 중 오류가 발생했습니다.')
        }
      } finally {
        setAuthChecking(false)
      }
    }

    void checkExistingAccount()
  }, [])

  function resetMessages() {
    setMessage('')
    setError('')
  }

  /*
   * 신규 사용자:
   * 이메일 인증번호 발송
   */
  async function sendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    resetMessages()

    setLoading(true)

    try {
      const response = await fetch(
        'http://localhost:3001/auth/email/send-code',
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
          },

          body: JSON.stringify({
            email,
          }),
        },
      )

      const data = (await response.json()) as ApiResponse

      if (!response.ok) {
        setError(getMessage(data.message, '인증번호 발송에 실패했습니다.'))

        return
      }

      setMessage(getMessage(data.message, '인증번호를 이메일로 전송했습니다.'))

      setStep(2)
    } catch {
      setError('서버에 연결할 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }

  /*
   * 신규 사용자:
   * 이메일 인증번호 확인
   */
  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    resetMessages()

    setLoading(true)

    try {
      const response = await fetch(
        'http://localhost:3001/auth/email/verify-code',
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
          },

          body: JSON.stringify({
            email,
            code,
          }),
        },
      )

      const data = (await response.json()) as ApiResponse

      if (!response.ok) {
        setError(getMessage(data.message, '이메일 인증에 실패했습니다.'))

        return
      }

      if (!data.verificationToken) {
        setError('회원가입 인증 토큰을 확인할 수 없습니다.')

        return
      }

      setVerificationToken(data.verificationToken)

      setContactEmail(email)

      setMessage('이메일 인증이 완료되었습니다.')

      setStep(3)
    } catch {
      setError('서버에 연결할 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }

  /*
   * 신규 사용자:
   * USER 계정 생성 후 자동 로그인
   */
  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    resetMessages()

    if (nickname.trim().length < 2) {
      setError('닉네임은 최소 2자 이상 입력해주세요.')

      return
    }

    if (password.length < 8) {
      setError('비밀번호는 최소 8자 이상 입력해주세요.')

      return
    }

    if (password !== passwordConfirm) {
      setError('비밀번호와 비밀번호 확인이 일치하지 않습니다.')

      return
    }

    if (!verificationToken) {
      setError('이메일 인증을 다시 진행해주세요.')

      return
    }

    setLoading(true)

    try {
      const registerResponse = await fetch(
        'http://localhost:3001/auth/register',
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
          },

          body: JSON.stringify({
            email,

            verificationToken,

            password,

            nickname: nickname.trim(),
          }),
        },
      )

      const registerData = (await registerResponse.json()) as ApiResponse

      if (!registerResponse.ok) {
        setError(getMessage(registerData.message, '회원가입에 실패했습니다.'))

        return
      }

      const loginResponse = await fetch('http://localhost:3001/auth/login', {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
        },

        body: JSON.stringify({
          email,
          password,
        }),
      })

      const loginData = (await loginResponse.json()) as ApiResponse

      if (!loginResponse.ok || !loginData.accessToken || !loginData.user) {
        setError(
          '계정은 생성되었지만 자동 로그인에 실패했습니다. 로그인 후 기관 가입 신청을 다시 진행해주세요.',
        )

        return
      }

      sessionStorage.setItem('accessToken', loginData.accessToken)

      sessionStorage.setItem('user', JSON.stringify(loginData.user))

      setCurrentUser(loginData.user)

      setExistingAccount(true)

      setContactEmail(loginData.user.email)

      setMessage(
        '계정이 생성되었습니다. 이제 기관 정보와 증빙자료를 입력해주세요.',
      )

      setStep(4)
    } catch {
      setError('서버에 연결할 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }

  /*
   * 증빙자료 선택
   */
  function addProofFiles(selectedFiles: File[]) {
    resetMessages()

    if (applicationId !== null) {
      setError('기관 가입 신청이 이미 생성되어 추가 업로드가 진행 중입니다.')

      return
    }

    if (selectedFiles.length === 0) {
      return
    }

    for (const file of selectedFiles) {
      if (!ALLOWED_PROOF_TYPES.includes(file.type)) {
        setError(`${file.name}: PDF, JPG, JPEG, PNG 파일만 선택할 수 있습니다.`)

        return
      }

      if (file.size <= 0) {
        setError(`${file.name}: 비어 있는 파일은 선택할 수 없습니다.`)

        return
      }

      if (file.size > MAX_PROOF_FILE_SIZE) {
        setError(`${file.name}: 파일 한 개의 최대 크기는 50MB입니다.`)

        return
      }
    }

    const uniqueNewFiles = selectedFiles.filter(
      (selectedFile) =>
        !proofFiles.some((existingFile) =>
          isSameFile(existingFile, selectedFile),
        ),
    )

    const nextFiles = [...proofFiles, ...uniqueNewFiles]

    const totalSize = getTotalFileSize(nextFiles)

    if (totalSize > MAX_TOTAL_PROOF_SIZE) {
      setError(
        `증빙자료 전체 용량은 최대 300MB입니다. 현재 선택 시 총 ${formatFileSize(
          totalSize,
        )}입니다.`,
      )

      return
    }

    setProofFiles(nextFiles)
  }

  function removeProofFile(index: number) {
    if (applicationId !== null) {
      return
    }

    setProofFiles((current) =>
      current.filter((_, currentIndex) => currentIndex !== index),
    )

    resetMessages()
  }

  /*
   * 두 번째 이후 증빙자료 업로드
   */
  async function uploadAdditionalProofs(
    accessToken: string,
    id: number,
    startIndex: number,
  ) {
    for (let index = startIndex; index < proofFiles.length; index += 1) {
      const file = proofFiles[index]

      const formData = new FormData()

      formData.append('proofFile', file)

      /*
       * 브라우저의 File.name을
       * 별도 multipart text 필드로 전송한다.
       *
       * Multer filename 인코딩 문제를 우회한다.
       */
      formData.append('proofOriginalName', file.name)

      const response = await fetch(
        `http://localhost:3001/institution-applications/${id}/proofs`,
        {
          method: 'POST',

          headers: {
            Authorization: `Bearer ${accessToken}`,
          },

          body: formData,
        },
      )

      const data = (await response.json().catch(() => ({}))) as ApiResponse

      if (!response.ok) {
        /*
         * index번째 파일에서 실패.
         *
         * 이전 파일들은 이미 업로드됐기 때문에
         * 재시도 시 이 파일부터 다시 시작한다.
         */
        setNextProofIndex(index)

        throw new Error(
          `${file.name}: ${getMessage(
            data.message,
            '증빙자료 업로드에 실패했습니다.',
          )}`,
        )
      }

      setNextProofIndex(index + 1)
    }
  }

  /*
   * 기관 가입 신청 제출
   *
   * 신규 가입자와
   * 기존 로그인 USER 모두
   * 같은 API를 사용한다.
   */
  async function submitInstitutionApplication(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    resetMessages()

    const accessToken = sessionStorage.getItem('accessToken')

    if (!accessToken) {
      setError('로그인 정보를 확인할 수 없습니다. 다시 로그인해주세요.')

      return
    }

    if (!institutionName.trim()) {
      setError('기관명을 입력해주세요.')

      return
    }

    if (!representativeName.trim()) {
      setError('대표자 또는 담당자명을 입력해주세요.')

      return
    }

    if (!contactEmail.trim()) {
      setError('담당자 이메일을 입력해주세요.')

      return
    }

    if (proofFiles.length === 0) {
      setError('기관 증빙자료를 한 개 이상 첨부해주세요.')

      return
    }

    const totalSize = getTotalFileSize(proofFiles)

    if (totalSize > MAX_TOTAL_PROOF_SIZE) {
      setError('증빙자료 전체 용량은 최대 300MB입니다.')

      return
    }

    setLoading(true)

    try {
      let currentApplicationId = applicationId

      let uploadStartIndex = nextProofIndex

      /*
       * 신청 자체가 아직 만들어지지 않았다면
       * 첫 번째 파일과 함께 기관 신청 생성
       */
      if (currentApplicationId === null) {
        const formData = new FormData()

        formData.append('institutionName', institutionName.trim())

        formData.append('representativeName', representativeName.trim())

        formData.append('contactEmail', contactEmail.trim())

        if (contactPhone.trim()) {
          formData.append('contactPhone', contactPhone.trim())
        }

        if (address.trim()) {
          formData.append('address', address.trim())
        }

        if (website.trim()) {
          formData.append('website', website.trim())
        }

        if (description.trim()) {
          formData.append('description', description.trim())
        }

        /*
         * 첫 번째 증빙자료
         */
        formData.append('proofFile', proofFiles[0])

        /*
         * 첫 번째 증빙자료도
         * 정상 브라우저 파일명을 별도 전송
         */
        formData.append('proofOriginalName', proofFiles[0].name)

        const response = await fetch(
          'http://localhost:3001/institution-applications',
          {
            method: 'POST',

            headers: {
              Authorization: `Bearer ${accessToken}`,
            },

            body: formData,
          },
        )

        const data = (await response.json().catch(() => ({}))) as ApiResponse

        if (!response.ok) {
          setError(getMessage(data.message, '기관 가입 신청에 실패했습니다.'))

          return
        }

        if (!data.application?.id) {
          setError('기관 가입 신청 번호를 확인할 수 없습니다.')

          return
        }

        currentApplicationId = data.application.id

        setApplicationId(currentApplicationId)

        /*
         * 첫 번째 파일은 이미 업로드됐으므로
         * 두 번째 파일부터 시작
         */
        uploadStartIndex = 1

        setNextProofIndex(1)
      }

      /*
       * 두 번째 이후 증빙자료를
       * 한 개씩 순서대로 업로드
       */
      if (uploadStartIndex < proofFiles.length) {
        await uploadAdditionalProofs(
          accessToken,
          currentApplicationId,
          uploadStartIndex,
        )
      }

      setMessage('기관 가입 신청과 모든 증빙자료 업로드가 완료되었습니다.')

      setStep(5)
    } catch (err) {
      if (err instanceof Error) {
        setError(
          `기관 가입 신청은 접수되었지만 일부 증빙자료 업로드가 완료되지 않았습니다. ${err.message} 다시 버튼을 누르면 실패한 파일부터 재시도합니다.`,
        )
      } else {
        setError('증빙자료 업로드 중 오류가 발생했습니다.')
      }
    } finally {
      setLoading(false)
    }
  }

  const totalProofSize = getTotalFileSize(proofFiles)

  const uploadedFileCount =
    applicationId === null ? 0 : Math.min(nextProofIndex, proofFiles.length)

  /*
   * 로그인 상태 확인 중
   */
  if (authChecking) {
    return (
      <main className="flex flex-1 items-center justify-center bg-slate-50 px-6 py-20">
        <p className="font-semibold text-slate-500">
          계정 정보를 확인하는 중...
        </p>
      </main>
    )
  }

  /*
   * 이미 기관 계정이거나
   * 처리 중인 기관 신청이 있는 경우
   */
  if (blockedReason) {
    return (
      <main className="flex flex-1 items-center justify-center bg-slate-50 px-6 py-12">
        <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-bold tracking-widest text-violet-600">
            KOREA TRIP QUEST
          </p>

          <h1 className="mt-3 text-2xl font-bold text-slate-900">
            기관 가입 신청
          </h1>

          <div className="mt-6 rounded-2xl bg-amber-50 p-5">
            <p className="font-bold text-amber-900">
              현재 새 신청을 제출할 수 없습니다.
            </p>

            <p className="mt-2 text-sm leading-6 text-amber-800">
              {blockedReason}
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/my"
              className="rounded-xl bg-slate-900 px-5 py-3 font-bold text-white hover:bg-slate-700"
            >
              My에서 상태 확인
            </Link>

            <Link
              href="/"
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-bold text-slate-700 hover:bg-slate-50"
            >
              홈으로 이동
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-slate-50 px-6 py-12">
      <div className="w-full max-w-2xl">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
          <Link
            href={existingAccount ? '/my' : '/signup'}
            className="text-sm font-semibold text-violet-600 hover:text-violet-700"
          >
            {existingAccount ? '← My로 돌아가기' : '← 가입 유형 선택'}
          </Link>

          <p className="mt-7 text-sm font-bold tracking-widest text-violet-600">
            KOREA TRIP QUEST
          </p>

          <h1 className="mt-3 text-3xl font-bold text-slate-900">
            {previousRejectedApplication
              ? '기관 가입 재신청'
              : '기관 가입 신청'}
          </h1>

          {existingAccount ? (
            <p className="mt-3 text-sm leading-6 text-slate-600">
              현재 로그인된 계정을 그대로 사용합니다. 이메일 인증이나 새로운
              계정 생성 없이 기관 정보와 증빙자료만 제출하면 됩니다.
            </p>
          ) : (
            <p className="mt-3 text-sm leading-6 text-slate-600">
              기본 계정을 생성하고 기관 정보와 증빙자료를 제출하면 관리자가
              검토합니다.
            </p>
          )}

          {existingAccount && currentUser && (
            <div className="mt-5 rounded-xl bg-sky-50 px-4 py-3">
              <p className="text-xs font-bold text-sky-700">사용 중인 계정</p>

              <p className="mt-1 break-all font-semibold text-slate-900">
                {currentUser.email}
              </p>

              <p className="mt-1 text-sm text-slate-600">
                {currentUser.nickname ?? '사용자'} · USER
              </p>
            </div>
          )}

          {previousRejectedApplication && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="font-bold text-red-800">
                이전 신청이 거절되어 재신청할 수 있습니다.
              </p>

              {previousRejectedApplication.rejectionReason && (
                <>
                  <p className="mt-3 text-xs font-bold text-red-700">
                    이전 거절 사유
                  </p>

                  <p className="mt-1 text-sm leading-6 text-red-700">
                    {previousRejectedApplication.rejectionReason}
                  </p>
                </>
              )}

              <p className="mt-3 text-sm leading-6 text-slate-600">
                이전 신청 정보를 불러왔습니다. 필요한 내용을 수정하고 새로운
                증빙자료를 첨부해서 다시 제출해주세요.
              </p>
            </div>
          )}

          <div className="mt-8 flex gap-2">
            {[1, 2, 3, 4].map((number) => (
              <div
                key={number}
                className={`h-2 flex-1 rounded-full ${
                  step >= number ? 'bg-violet-600' : 'bg-slate-200'
                }`}
              />
            ))}
          </div>

          {step < 5 && (
            <p className="mt-3 text-sm font-semibold text-slate-500">
              {existingAccount &&
                step === 4 &&
                '기존 계정 사용 · 기관 정보 및 증빙자료'}

              {!existingAccount && step === 1 && '1단계 · 이메일 입력'}

              {!existingAccount && step === 2 && '2단계 · 이메일 인증'}

              {!existingAccount && step === 3 && '3단계 · 계정 정보'}

              {!existingAccount &&
                step === 4 &&
                '4단계 · 기관 정보 및 증빙자료'}
            </p>
          )}

          {step === 1 && (
            <form onSubmit={sendCode} className="mt-8 space-y-5">
              <div>
                <label
                  htmlFor="institution-email"
                  className="mb-2 block text-sm font-bold text-slate-800"
                >
                  계정 이메일
                </label>

                <input
                  id="institution-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  placeholder="manager@example.com"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-900 outline-none placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-violet-600 px-4 py-3 font-bold text-white hover:bg-violet-700 disabled:bg-slate-300"
              >
                {loading ? '전송 중...' : '인증번호 받기'}
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={verifyCode} className="mt-8 space-y-5">
              <div className="rounded-xl bg-violet-50 px-4 py-3">
                <p className="text-xs font-semibold text-slate-500">
                  인증 이메일
                </p>

                <p className="mt-1 font-semibold text-slate-900">{email}</p>
              </div>

              <div>
                <label
                  htmlFor="institution-code"
                  className="mb-2 block text-sm font-bold text-slate-800"
                >
                  인증번호
                </label>

                <input
                  id="institution-code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(event) =>
                    setCode(event.target.value.replace(/\D/g, ''))
                  }
                  required
                  placeholder="6자리 인증번호"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-xl font-bold tracking-[0.3em] text-slate-900 outline-none placeholder:text-base placeholder:tracking-normal placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-violet-600 px-4 py-3 font-bold text-white hover:bg-violet-700 disabled:bg-slate-300"
              >
                {loading ? '확인 중...' : '인증하기'}
              </button>
            </form>
          )}

          {step === 3 && (
            <form onSubmit={createAccount} className="mt-8 space-y-5">
              <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                ✓ 이메일 인증이 완료되었습니다.
              </div>

              <div>
                <label
                  htmlFor="institution-nickname"
                  className="mb-2 block text-sm font-bold text-slate-800"
                >
                  담당자 닉네임
                </label>

                <input
                  id="institution-nickname"
                  type="text"
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  required
                  minLength={2}
                  maxLength={30}
                  placeholder="담당자 닉네임"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-900 outline-none placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                />
              </div>

              <div>
                <label
                  htmlFor="institution-password"
                  className="mb-2 block text-sm font-bold text-slate-800"
                >
                  비밀번호
                </label>

                <input
                  id="institution-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={8}
                  maxLength={64}
                  placeholder="8자 이상 입력"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-900 outline-none placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                />
              </div>

              <div>
                <label
                  htmlFor="institution-password-confirm"
                  className="mb-2 block text-sm font-bold text-slate-800"
                >
                  비밀번호 확인
                </label>

                <input
                  id="institution-password-confirm"
                  type="password"
                  value={passwordConfirm}
                  onChange={(event) => setPasswordConfirm(event.target.value)}
                  required
                  minLength={8}
                  maxLength={64}
                  placeholder="비밀번호 다시 입력"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-900 outline-none placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-violet-600 px-4 py-3 font-bold text-white hover:bg-violet-700 disabled:bg-slate-300"
              >
                {loading ? '계정 생성 중...' : '계정 생성 후 계속'}
              </button>
            </form>
          )}

          {step === 4 && (
            <form
              onSubmit={submitInstitutionApplication}
              className="mt-8 space-y-5"
            >
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-800">
                  기관명
                </label>

                <input
                  type="text"
                  value={institutionName}
                  onChange={(event) => setInstitutionName(event.target.value)}
                  disabled={applicationId !== null}
                  required
                  minLength={2}
                  maxLength={100}
                  placeholder="예: 서울관광재단"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-900 outline-none placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-100 disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-800">
                  대표자 / 담당자명
                </label>

                <input
                  type="text"
                  value={representativeName}
                  onChange={(event) =>
                    setRepresentativeName(event.target.value)
                  }
                  disabled={applicationId !== null}
                  required
                  minLength={2}
                  maxLength={50}
                  placeholder="담당자 이름"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-900 outline-none placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-100 disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-800">
                  담당자 이메일
                </label>

                <input
                  type="email"
                  value={contactEmail}
                  onChange={(event) => setContactEmail(event.target.value)}
                  disabled={applicationId !== null}
                  required
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-800">
                  연락처
                </label>

                <input
                  type="text"
                  value={contactPhone}
                  onChange={(event) => setContactPhone(event.target.value)}
                  disabled={applicationId !== null}
                  maxLength={30}
                  placeholder="02-1234-5678"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-900 outline-none placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-100 disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-800">
                  기관 주소
                </label>

                <input
                  type="text"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  disabled={applicationId !== null}
                  maxLength={200}
                  placeholder="기관 주소"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-900 outline-none placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-100 disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-800">
                  공식 웹사이트
                </label>

                <input
                  type="url"
                  value={website}
                  onChange={(event) => setWebsite(event.target.value)}
                  disabled={applicationId !== null}
                  placeholder="https://example.com"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-900 outline-none placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-100 disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-800">
                  기관 설명
                </label>

                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  disabled={applicationId !== null}
                  maxLength={1000}
                  rows={5}
                  placeholder="기관에 대해 간단히 설명해주세요."
                  className="w-full resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-900 outline-none placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-100 disabled:bg-slate-100"
                />
              </div>

              <div>
                <label
                  htmlFor="proof-files"
                  className="mb-2 block text-sm font-bold text-slate-800"
                >
                  기관 증빙자료 <span className="text-red-500">*</span>
                </label>

                <div className="rounded-2xl border border-dashed border-violet-300 bg-violet-50/50 p-5">
                  <p className="font-bold text-slate-800">
                    기관을 확인할 수 있는 자료를 첨부해주세요.
                  </p>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    사업자등록증, 재직증명서, 기관 확인서류 등 여러 파일을
                    등록할 수 있습니다.
                  </p>

                  <p className="mt-1 text-xs font-semibold text-slate-400">
                    파일 개수 제한 없음 · PDF/JPG/JPEG/PNG · 파일당 최대 50MB ·
                    전체 최대 300MB
                  </p>

                  {previousRejectedApplication && (
                    <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      이전 신청의 증빙자료는 새 신청으로 자동 복사되지 않습니다.
                      재신청할 때 사용할 증빙자료를 다시 첨부해주세요.
                    </div>
                  )}

                  <input
                    id="proof-files"
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                    disabled={loading || applicationId !== null}
                    onChange={(event) => {
                      const files = Array.from(event.target.files ?? [])

                      addProofFiles(files)

                      /*
                       * 같은 파일을 다시 선택할 수 있도록
                       * input 값을 초기화한다.
                       */
                      event.target.value = ''
                    }}
                    className="mt-5 block w-full cursor-pointer rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-600 file:mr-4 file:border-0 file:bg-violet-600 file:px-5 file:py-3 file:font-bold file:text-white hover:file:bg-violet-700 disabled:cursor-not-allowed"
                  />

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
                    <p className="font-semibold text-slate-600">
                      선택 파일:{' '}
                      <span className="font-bold text-slate-900">
                        {proofFiles.length}개
                      </span>
                    </p>

                    <p
                      className={`font-semibold ${
                        totalProofSize > MAX_TOTAL_PROOF_SIZE * 0.9
                          ? 'text-amber-700'
                          : 'text-slate-600'
                      }`}
                    >
                      총 용량:{' '}
                      <span className="font-bold">
                        {formatFileSize(totalProofSize)} / 300MB
                      </span>
                    </p>
                  </div>

                  {applicationId !== null && (
                    <div className="mt-4 rounded-xl bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-700">
                      신청 번호 #{applicationId}이 생성되었습니다. 현재{' '}
                      {uploadedFileCount}/{proofFiles.length}개 증빙자료가
                      업로드되었습니다.
                    </div>
                  )}

                  {proofFiles.length > 0 && (
                    <div className="mt-4 space-y-3">
                      {proofFiles.map((file, index) => {
                        const uploaded =
                          applicationId !== null && index < nextProofIndex

                        return (
                          <div
                            key={`${file.name}-${file.size}-${file.lastModified}`}
                            className="rounded-xl border border-slate-200 bg-white p-4"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="break-all font-semibold text-slate-900">
                                    {file.name}
                                  </p>

                                  {uploaded && (
                                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">
                                      업로드 완료
                                    </span>
                                  )}
                                </div>

                                <p className="mt-1 text-xs text-slate-500">
                                  {formatFileSize(file.size)}
                                </p>
                              </div>

                              {applicationId === null && (
                                <button
                                  type="button"
                                  disabled={loading}
                                  onClick={() => removeProofFile(index)}
                                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed"
                                >
                                  삭제
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || proofFiles.length === 0}
                className="w-full rounded-xl bg-violet-600 px-4 py-3 font-bold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {loading
                  ? applicationId === null
                    ? previousRejectedApplication
                      ? '기관 재신청 생성 및 업로드 중...'
                      : '기관 신청 생성 및 업로드 중...'
                    : `증빙자료 업로드 중... (${uploadedFileCount}/${proofFiles.length})`
                  : applicationId === null
                    ? previousRejectedApplication
                      ? `기관 재신청 (${proofFiles.length}개 파일)`
                      : `기관 가입 신청 (${proofFiles.length}개 파일)`
                    : '남은 증빙자료 업로드 계속'}
              </button>
            </form>
          )}

          {step === 5 && (
            <div className="mt-10 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">
                ✓
              </div>

              <h2 className="mt-5 text-2xl font-bold text-slate-900">
                {previousRejectedApplication
                  ? '기관 가입 재신청이 접수되었습니다.'
                  : '기관 가입 신청이 접수되었습니다.'}
              </h2>

              <p className="mt-3 leading-7 text-slate-600">
                기관 정보와{' '}
                <strong>
                  {proofFiles.length}
                  개의 증빙자료
                </strong>
                를 바탕으로 관리자가 승인 여부를 검토합니다.
              </p>

              {applicationId !== null && (
                <p className="mt-3 text-sm font-semibold text-slate-500">
                  신청 번호: {applicationId}
                </p>
              )}

              <div className="mt-6 rounded-xl bg-amber-50 p-4 text-left">
                <p className="font-bold text-amber-900">현재 계정 권한</p>

                <p className="mt-2 text-sm leading-6 text-amber-800">
                  관리자 승인 전까지는 일반 USER 권한이 유지됩니다. 승인 후
                  INSTITUTION 권한과 기관 관리 기능을 사용할 수 있습니다.
                </p>
              </div>

              <button
                type="button"
                onClick={() => router.push('/my')}
                className="mt-7 w-full rounded-xl bg-sky-600 px-4 py-3 font-bold text-white hover:bg-sky-700"
              >
                My에서 신청 상태 확인
              </button>
            </div>
          )}

          {message && step !== 5 && (
            <div className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
              {message}
            </div>
          )}

          {error && (
            <div className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
