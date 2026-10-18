import Link from 'next/link'

export default function SignupTypePage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-slate-50 px-6 py-12">
      <div className="w-full max-w-3xl">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
          <p className="text-sm font-bold tracking-widest text-sky-600">
            KOREA TRIP QUEST
          </p>

          <h1 className="mt-3 text-3xl font-bold text-slate-900 sm:text-4xl">
            회원가입
          </h1>

          <p className="mt-3 text-slate-600">
            Korea Trip Quest를 어떤 목적으로 이용하시나요?
          </p>

          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {/* 일반 여행자 회원가입 */}
            <Link
              href="/signup/traveler"
              className="group rounded-2xl border-2 border-slate-200 p-6 transition hover:border-sky-500 hover:bg-sky-50"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-100 text-2xl">
                🧳
              </div>

              <h2 className="mt-5 text-xl font-bold text-slate-900 group-hover:text-sky-700">
                여행자로 가입
              </h2>

              <p className="mt-3 text-sm leading-6 text-slate-600">
                한국의 관광 Challenge에 참여하고 Mission을 수행하며 여행 기록과
                배지를 모을 수 있습니다.
              </p>

              <div className="mt-6 font-bold text-sky-600">일반 회원가입 →</div>
            </Link>

            {/* 기관 회원가입 */}
            <Link
              href="/signup/institution"
              className="group rounded-2xl border-2 border-slate-200 p-6 transition hover:border-violet-500 hover:bg-violet-50"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 text-2xl">
                🏢
              </div>

              <h2 className="mt-5 text-xl font-bold text-slate-900 group-hover:text-violet-700">
                기관으로 가입 신청
              </h2>

              <p className="mt-3 text-sm leading-6 text-slate-600">
                관광기관, 지자체 등 기관 담당자가 Challenge와 Mission을 운영하기
                위해 가입을 신청합니다.
              </p>

              <div className="mt-6 font-bold text-violet-600">
                기관 가입 신청 →
              </div>
            </Link>
          </div>

          <div className="mt-8 rounded-2xl bg-amber-50 p-5">
            <p className="font-bold text-amber-900">
              기관 계정은 바로 생성되지 않습니다.
            </p>

            <p className="mt-2 text-sm leading-6 text-amber-800">
              기관 가입 신청 후 관리자 검토와 승인을 받아야 기관 기능을 사용할
              수 있습니다. 승인 전에는 일반 USER 권한이 유지됩니다.
            </p>
          </div>

          <div className="mt-8">
            <button
              type="button"
              disabled
              className="w-full cursor-not-allowed rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 font-semibold text-slate-400"
            >
              Google로 계속하기 · 준비 중
            </button>

            <p className="mt-2 text-center text-xs text-slate-500">
              Google 회원가입과 로그인은 이후 연결할 예정입니다.
            </p>
          </div>

          <div className="mt-8 border-t border-slate-200 pt-6 text-center">
            <p className="text-sm text-slate-600">
              이미 계정이 있나요?{' '}
              <Link
                href="/login"
                className="font-bold text-sky-600 hover:text-sky-700"
              >
                로그인
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
