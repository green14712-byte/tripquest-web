'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useCallback, useEffect, useState } from 'react'

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

type AdminUser = {
  id: number
  email: string
  nickname: string | null
  emailVerified: boolean
  role: UserRole
  status: AccountStatus
  institutionId: number | null
  suspendedAt: string | null
  suspensionReason: string | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

type UserListResponse = {
  total: number
  users: AdminUser[]
}

type ApiResponse = {
  message?: string | string[]
  user?: AdminUser
}

function getMessage(message: string | string[] | undefined, fallback: string) {
  if (Array.isArray(message)) {
    return message.join(' ')
  }

  return message ?? fallback
}

function roleLabel(role: UserRole) {
  if (role === 'ADMIN') {
    return '관리자'
  }

  if (role === 'INSTITUTION') {
    return '기관 관계자'
  }

  return '일반 사용자'
}

function statusLabel(status: AccountStatus) {
  if (status === 'SUSPENDED') {
    return '정지'
  }

  if (status === 'DELETED') {
    return '탈퇴 / 삭제'
  }

  return '활성'
}

function roleStyle(role: UserRole) {
  if (role === 'ADMIN') {
    return 'bg-red-100 text-red-700'
  }

  if (role === 'INSTITUTION') {
    return 'bg-violet-100 text-violet-700'
  }

  return 'bg-sky-100 text-sky-700'
}

function statusStyle(status: AccountStatus) {
  if (status === 'SUSPENDED') {
    return 'bg-amber-100 text-amber-700'
  }

  if (status === 'DELETED') {
    return 'bg-slate-200 text-slate-600'
  }

  return 'bg-emerald-100 text-emerald-700'
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

export default function AdminUsersPage() {
  const router = useRouter()

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)

  const [users, setUsers] = useState<AdminUser[]>([])

  const [search, setSearch] = useState('')

  const [role, setRole] = useState<UserRole | ''>('')

  const [status, setStatus] = useState<AccountStatus | ''>('')

  const [total, setTotal] = useState(0)

  const [loading, setLoading] = useState(true)

  const [processingUserId, setProcessingUserId] = useState<number | null>(null)

  const [error, setError] = useState('')

  const [message, setMessage] = useState('')

  const loadUsers = useCallback(
    async (
      nextSearch: string,
      nextRole: UserRole | '',
      nextStatus: AccountStatus | '',
    ) => {
      const accessToken = sessionStorage.getItem('accessToken')

      if (!accessToken) {
        router.replace('/login')
        return
      }

      setLoading(true)
      setError('')

      try {
        /*
         * 관리자 본인 확인
         */
        const meResponse = await fetch('http://localhost:3001/auth/me', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },

          cache: 'no-store',
        })

        if (meResponse.status === 401 || meResponse.status === 403) {
          sessionStorage.removeItem('accessToken')
          sessionStorage.removeItem('user')

          router.replace('/login')
          return
        }

        if (!meResponse.ok) {
          throw new Error('현재 사용자 정보를 확인할 수 없습니다.')
        }

        const meData = await meResponse.json()

        const me: CurrentUser = meData.user ?? meData

        if (me.role !== 'ADMIN') {
          throw new Error('관리자만 접근할 수 있는 페이지입니다.')
        }

        setCurrentUser(me)

        sessionStorage.setItem('user', JSON.stringify(me))

        /*
         * 검색 조건
         */
        const params = new URLSearchParams()

        const normalizedSearch = nextSearch.trim()

        if (normalizedSearch) {
          params.set('search', normalizedSearch)
        }

        if (nextRole) {
          params.set('role', nextRole)
        }

        if (nextStatus) {
          params.set('status', nextStatus)
        }

        const queryString = params.toString()

        const url = queryString
          ? `http://localhost:3001/auth/admin/users?${queryString}`
          : 'http://localhost:3001/auth/admin/users'

        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },

          cache: 'no-store',
        })

        const data = (await response.json().catch(() => null)) as
          | UserListResponse
          | ApiResponse
          | null

        if (!response.ok) {
          throw new Error(
            getMessage(
              (data as ApiResponse | null)?.message,
              '회원 목록을 불러오지 못했습니다.',
            ),
          )
        }

        const listData = data as UserListResponse

        setUsers(Array.isArray(listData.users) ? listData.users : [])

        setTotal(typeof listData.total === 'number' ? listData.total : 0)
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message)
        } else {
          setError('회원 정보를 불러오는 중 오류가 발생했습니다.')
        }
      } finally {
        setLoading(false)
      }
    },
    [router],
  )

  useEffect(() => {
    void loadUsers('', '', '')
  }, [loadUsers])

  async function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setMessage('')

    await loadUsers(search, role, status)
  }

  async function resetFilters() {
    setSearch('')
    setRole('')
    setStatus('')
    setMessage('')

    await loadUsers('', '', '')
  }

  /*
   * 일반 USER → ADMIN 승격
   */
  async function promoteUserToAdmin(user: AdminUser) {
    if (!currentUser) {
      return
    }

    if (user.id === currentUser.id) {
      setError('현재 로그인한 관리자 본인 계정은 승격 대상이 될 수 없습니다.')

      return
    }

    if (user.role !== 'USER') {
      setError('일반 사용자 계정만 관리자로 승격할 수 있습니다.')

      return
    }

    if (user.status !== 'ACTIVE') {
      setError('활성 상태의 계정만 관리자로 승격할 수 있습니다.')

      return
    }

    if (!user.emailVerified) {
      setError('이메일 인증이 완료된 계정만 관리자로 승격할 수 있습니다.')

      return
    }

    const firstConfirmed = window.confirm(
      `${user.nickname ?? user.email} 사용자를 관리자로 승격하시겠습니까?\n\n관리자가 되면 회원 관리와 기관 가입 신청 관리 등 관리자 기능에 접근할 수 있습니다.`,
    )

    if (!firstConfirmed) {
      return
    }

    const secondConfirmed = window.confirm(
      '관리자 승격을 최종 확인합니다.\n\n이 작업은 현재 화면에서 바로 되돌릴 수 없습니다. 계속하시겠습니까?',
    )

    if (!secondConfirmed) {
      return
    }

    const accessToken = sessionStorage.getItem('accessToken')

    if (!accessToken) {
      router.replace('/login')
      return
    }

    setProcessingUserId(user.id)

    setError('')
    setMessage('')

    try {
      const response = await fetch(
        `http://localhost:3001/auth/admin/users/${user.id}/promote-admin`,
        {
          method: 'POST',

          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      )

      const data = (await response
        .json()
        .catch(() => null)) as ApiResponse | null

      if (!response.ok) {
        throw new Error(
          getMessage(data?.message, '관리자 승격에 실패했습니다.'),
        )
      }

      setMessage(`${user.email} 계정을 관리자로 승격했습니다.`)

      await loadUsers(search, role, status)
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('관리자 승격 중 오류가 발생했습니다.')
      }
    } finally {
      setProcessingUserId(null)
    }
  }

  /*
   * 계정 정지
   */
  async function suspendUser(user: AdminUser) {
    if (!currentUser) {
      return
    }

    if (user.id === currentUser.id) {
      setError('현재 로그인한 관리자 본인 계정은 정지할 수 없습니다.')

      return
    }

    const reason = window.prompt(
      `${user.nickname ?? user.email} 계정을 정지하는 사유를 입력해주세요.`,
    )

    if (reason === null) {
      return
    }

    const normalizedReason = reason.trim()

    if (normalizedReason.length < 2) {
      setError('정지 사유는 2자 이상 입력해주세요.')

      return
    }

    const confirmed = window.confirm(
      `${user.email} 계정을 정지하시겠습니까?\n\n정지 후 해당 사용자는 로그인 및 서비스 이용이 제한됩니다.`,
    )

    if (!confirmed) {
      return
    }

    const accessToken = sessionStorage.getItem('accessToken')

    if (!accessToken) {
      router.replace('/login')
      return
    }

    setProcessingUserId(user.id)

    setError('')
    setMessage('')

    try {
      const response = await fetch(
        `http://localhost:3001/auth/admin/users/${user.id}/suspend`,
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',

            Authorization: `Bearer ${accessToken}`,
          },

          body: JSON.stringify({
            reason: normalizedReason,
          }),
        },
      )

      const data = (await response
        .json()
        .catch(() => null)) as ApiResponse | null

      if (!response.ok) {
        throw new Error(getMessage(data?.message, '계정 정지에 실패했습니다.'))
      }

      setMessage(`${user.email} 계정을 정지했습니다.`)

      await loadUsers(search, role, status)
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('계정 정지 중 오류가 발생했습니다.')
      }
    } finally {
      setProcessingUserId(null)
    }
  }

  /*
   * 정지 해제
   */
  async function activateUser(user: AdminUser) {
    if (!currentUser) {
      return
    }

    if (user.id === currentUser.id) {
      setError('현재 로그인한 관리자 본인 계정의 상태는 변경할 수 없습니다.')

      return
    }

    const confirmed = window.confirm(
      `${user.email} 계정의 정지를 해제하시겠습니까?`,
    )

    if (!confirmed) {
      return
    }

    const accessToken = sessionStorage.getItem('accessToken')

    if (!accessToken) {
      router.replace('/login')
      return
    }

    setProcessingUserId(user.id)

    setError('')
    setMessage('')

    try {
      const response = await fetch(
        `http://localhost:3001/auth/admin/users/${user.id}/activate`,
        {
          method: 'POST',

          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      )

      const data = (await response
        .json()
        .catch(() => null)) as ApiResponse | null

      if (!response.ok) {
        throw new Error(
          getMessage(data?.message, '계정 정지 해제에 실패했습니다.'),
        )
      }

      setMessage(`${user.email} 계정의 정지를 해제했습니다.`)

      await loadUsers(search, role, status)
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('계정 정지 해제 중 오류가 발생했습니다.')
      }
    } finally {
      setProcessingUserId(null)
    }
  }

  /*
   * 관리자에 의한 계정 삭제
   */
  async function deleteUser(user: AdminUser) {
    if (!currentUser) {
      return
    }

    if (user.id === currentUser.id) {
      setError('현재 로그인한 관리자 본인 계정은 삭제할 수 없습니다.')

      return
    }

    const firstConfirmed = window.confirm(
      `${user.email} 계정을 삭제하시겠습니까?\n\n계정은 복구할 수 없으며 기존 기록은 보존됩니다.`,
    )

    if (!firstConfirmed) {
      return
    }

    const secondConfirmed = window.confirm(
      '정말 삭제하시겠습니까?\n\n사용자의 이메일은 익명화되고 같은 이메일로 다시 가입할 수 있게 됩니다.',
    )

    if (!secondConfirmed) {
      return
    }

    const accessToken = sessionStorage.getItem('accessToken')

    if (!accessToken) {
      router.replace('/login')
      return
    }

    setProcessingUserId(user.id)

    setError('')
    setMessage('')

    try {
      const response = await fetch(
        `http://localhost:3001/auth/admin/users/${user.id}/delete`,
        {
          method: 'POST',

          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      )

      const data = (await response
        .json()
        .catch(() => null)) as ApiResponse | null

      if (!response.ok) {
        throw new Error(getMessage(data?.message, '계정 삭제에 실패했습니다.'))
      }

      setMessage(`${user.email} 계정을 삭제했습니다.`)

      await loadUsers(search, role, status)
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('계정 삭제 중 오류가 발생했습니다.')
      }
    } finally {
      setProcessingUserId(null)
    }
  }

  return (
    <main className="flex flex-1 justify-center bg-slate-50 px-6 py-12">
      <div className="w-full max-w-6xl">
        {/* 제목 */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold tracking-widest text-red-600">
              KOREA TRIP QUEST ADMIN
            </p>

            <h1 className="mt-2 text-3xl font-bold text-slate-900">
              회원 관리
            </h1>

            <p className="mt-2 text-slate-600">
              사용자 계정의 상태와 권한을 확인하고 관리할 수 있습니다.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/institution-applications"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
            >
              기관 신청 관리
            </Link>

            <Link
              href="/"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
            >
              홈
            </Link>
          </div>
        </div>

        {/* 검색 */}
        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <form
            onSubmit={submitSearch}
            className="grid gap-4 lg:grid-cols-[1fr_180px_180px_auto]"
          >
            <div>
              <label
                htmlFor="search"
                className="mb-2 block text-sm font-bold text-slate-800"
              >
                이메일 / 닉네임 검색
              </label>

              <input
                id="search"
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="이메일 또는 닉네임 입력"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
            </div>

            <div>
              <label
                htmlFor="role"
                className="mb-2 block text-sm font-bold text-slate-800"
              >
                역할
              </label>

              <select
                id="role"
                value={role}
                onChange={(event) =>
                  setRole(event.target.value as UserRole | '')
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              >
                <option value="">전체 역할</option>

                <option value="USER">일반 사용자</option>

                <option value="INSTITUTION">기관 관계자</option>

                <option value="ADMIN">관리자</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="status"
                className="mb-2 block text-sm font-bold text-slate-800"
              >
                계정 상태
              </label>

              <select
                id="status"
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as AccountStatus | '')
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              >
                <option value="">전체 상태</option>

                <option value="ACTIVE">활성</option>

                <option value="SUSPENDED">정지</option>

                <option value="DELETED">탈퇴 / 삭제</option>
              </select>
            </div>

            <div className="flex items-end gap-2">
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-slate-900 px-5 py-3 font-bold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                검색
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => void resetFilters()}
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                초기화
              </button>
            </div>
          </form>
        </section>

        {error && (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        {message && (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-700">
            {message}
          </div>
        )}

        {/* 회원 목록 제목 */}
        <div className="mt-8 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">회원 목록</h2>

          <span className="text-sm font-semibold text-slate-500">
            총 {total}명
          </span>
        </div>

        {loading ? (
          <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <p className="font-semibold text-slate-500">
              회원 정보를 불러오는 중...
            </p>
          </div>
        ) : users.length === 0 ? (
          <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <p className="font-semibold text-slate-500">
              조건에 해당하는 회원이 없습니다.
            </p>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {users.map((user) => {
              const isCurrentAdmin = currentUser?.id === user.id

              const isProcessing = processingUserId === user.id

              const canPromoteToAdmin =
                !isCurrentAdmin &&
                user.role === 'USER' &&
                user.status === 'ACTIVE' &&
                user.emailVerified

              return (
                <article
                  key={user.id}
                  className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-slate-400">
                          #{user.id}
                        </span>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${roleStyle(
                            user.role,
                          )}`}
                        >
                          {roleLabel(user.role)}
                        </span>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${statusStyle(
                            user.status,
                          )}`}
                        >
                          {statusLabel(user.status)}
                        </span>

                        {isCurrentAdmin && (
                          <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white">
                            내 계정
                          </span>
                        )}
                      </div>

                      <h3 className="mt-3 break-all text-lg font-bold text-slate-900">
                        {user.status === 'DELETED'
                          ? '삭제된 사용자'
                          : (user.nickname ?? '닉네임 없음')}
                      </h3>

                      <p className="mt-1 break-all text-sm text-slate-600">
                        {user.email}
                      </p>

                      <div className="mt-4 grid gap-2 text-sm text-slate-500 sm:grid-cols-2 xl:grid-cols-4">
                        <p>
                          이메일 인증:{' '}
                          <span className="font-semibold text-slate-700">
                            {user.emailVerified ? '완료' : '아니오'}
                          </span>
                        </p>

                        <p>
                          기관 ID:{' '}
                          <span className="font-semibold text-slate-700">
                            {user.institutionId ?? '-'}
                          </span>
                        </p>

                        <p>
                          가입:{' '}
                          <span className="font-semibold text-slate-700">
                            {formatDateTime(user.createdAt)}
                          </span>
                        </p>

                        <p>
                          마지막 수정:{' '}
                          <span className="font-semibold text-slate-700">
                            {formatDateTime(user.updatedAt)}
                          </span>
                        </p>
                      </div>

                      {user.status === 'SUSPENDED' && (
                        <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                          <p className="font-bold">정지 사유</p>

                          <p className="mt-1">{user.suspensionReason ?? '-'}</p>

                          <p className="mt-1 text-xs text-amber-600">
                            정지 시각: {formatDateTime(user.suspendedAt)}
                          </p>
                        </div>
                      )}

                      {user.status === 'DELETED' && (
                        <div className="mt-4 rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-600">
                          삭제 시각: {formatDateTime(user.deletedAt)}
                        </div>
                      )}
                    </div>

                    {/* 관리 버튼 */}
                    <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
                      {isCurrentAdmin ? (
                        <span className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-500">
                          본인 계정 변경 불가
                        </span>
                      ) : user.status === 'ACTIVE' ? (
                        <>
                          {canPromoteToAdmin && (
                            <button
                              type="button"
                              disabled={isProcessing}
                              onClick={() => void promoteUserToAdmin(user)}
                              className="rounded-xl bg-red-100 px-4 py-3 text-sm font-bold text-red-700 transition hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {isProcessing ? '처리 중...' : '관리자 승격'}
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => void suspendUser(user)}
                            className="rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isProcessing ? '처리 중...' : '계정 정지'}
                          </button>

                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => void deleteUser(user)}
                            className="rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            계정 삭제
                          </button>
                        </>
                      ) : user.status === 'SUSPENDED' ? (
                        <>
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => void activateUser(user)}
                            className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isProcessing ? '처리 중...' : '정지 해제'}
                          </button>

                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => void deleteUser(user)}
                            className="rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            계정 삭제
                          </button>
                        </>
                      ) : (
                        <span className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-500">
                          삭제된 계정
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        {/* 안내 */}
        <div className="mt-8 space-y-3">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm leading-6 text-red-700">
            <p className="font-bold">관리자 승격</p>

            <p className="mt-1">
              활성 상태이며 이메일 인증이 완료된 일반 사용자만 관리자로 승격할
              수 있습니다. 관리자 권한은 회원 관리와 기관 가입 신청 관리 등
              중요한 기능에 접근할 수 있으므로 신뢰할 수 있는 사용자에게만
              부여해주세요.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-500">
            계정 삭제는 데이터베이스의 사용자 행을 직접 제거하지 않습니다. 기존
            Challenge 참여 및 기관 신청 이력을 유지하기 위해 계정을 DELETED
            상태로 변경하고 이메일을 익명화합니다.
          </div>
        </div>
      </div>
    </main>
  )
}
