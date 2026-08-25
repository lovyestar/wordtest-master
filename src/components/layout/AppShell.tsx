import { Link, NavLink, Outlet } from 'react-router-dom'
import { signOutUser } from '../../lib/auth'
import { useAuthStore } from '../../store/authStore'
import Footer from './Footer'

const TABS = [
  { to: '/ranking', label: '랭킹', icon: '🏆' },
  { to: '/word-sets', label: '단어장', icon: '📚' },
  { to: '/word-study', label: '단어 외우기', icon: '🧠' },
  { to: '/mock-exam', label: '단어 모의 시험', icon: '📝' },
  { to: '/word-test', label: '단어 테스트', icon: '⏱️' },
]

function tabClass(isActive: boolean) {
  return [
    'flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs font-medium transition-colors md:flex-row md:gap-2 md:rounded-full md:px-4 md:py-2 md:text-sm',
    isActive
      ? 'text-indigo-600 md:bg-indigo-50 md:text-indigo-700'
      : 'text-slate-500 hover:text-slate-800 md:hover:bg-slate-100',
  ].join(' ')
}

export default function AppShell() {
  const { profile } = useAuthStore()

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap text-lg font-bold text-slate-900">광명고등학교 영단어 시스템</span>
          </div>

          <nav className="hidden items-center gap-1 md:flex">
            {TABS.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={({ isActive }) => `${tabClass(isActive)} whitespace-nowrap`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            {profile?.photoURL && (
              <img src={profile.photoURL} alt="" className="h-8 w-8 rounded-full" referrerPolicy="no-referrer" />
            )}
            <Link
              to="/profile"
              className="hidden max-w-[8rem] truncate text-sm text-slate-600 hover:text-indigo-600 hover:underline sm:inline"
            >
              {profile?.displayName}
            </Link>
            <button
              type="button"
              onClick={() => signOutUser()}
              className="whitespace-nowrap rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-6 pb-24 md:pb-6">
        <div className="flex-1">
          <Outlet />
        </div>
        <Footer />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-slate-200 bg-white/95 backdrop-blur md:hidden">
        {TABS.map((tab) => (
          <NavLink key={tab.to} to={tab.to} className={({ isActive }) => tabClass(isActive)}>
            <span className="text-lg">{tab.icon}</span>
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
