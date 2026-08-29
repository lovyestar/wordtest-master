import { NavLink, Outlet } from 'react-router-dom'
import ThemeToggle from '../ThemeToggle'
import { signOutUser } from '../../lib/auth'
import { useAuthStore } from '../../store/authStore'
import Footer from './Footer'

interface TeacherTab {
  to: string
  label: string
  end?: boolean
}

const BASE_TABS: TeacherTab[] = [
  { to: '/teacher', label: '대시보드', end: true },
  { to: '/teacher/word-sets', label: '단어장 관리' },
  { to: '/teacher/exams', label: '시험 관리' },
  { to: '/teacher/teachers', label: '선생님' },
]
const SUPER_ADMIN_TABS: TeacherTab[] = [
  { to: '/teacher/applications', label: '선생님 신청' },
  { to: '/teacher/admins', label: '관리자' },
]

export default function TeacherShell() {
  const { adminProfile } = useAuthStore()
  const tabs = adminProfile?.role === 'admin' ? [...BASE_TABS, ...SUPER_ADMIN_TABS] : BASE_TABS

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-slate-900 text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="whitespace-nowrap font-bold">광명고등학교 영단어 시스템 · 관리자</span>
            <nav className="flex items-center gap-1">
              {tabs.map((tab) => (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  end={tab.end}
                  className={({ isActive }) =>
                    `whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition ${
                      isActive ? 'bg-[#fff] text-[#0f172a]' : 'text-slate-300 hover:bg-slate-800'
                    }`
                  }
                >
                  {tab.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-3 text-sm text-slate-300">
            <ThemeToggle variant="onDark" />
            <span className="whitespace-nowrap">{adminProfile?.email}</span>
            <button
              type="button"
              onClick={() => signOutUser()}
              className="whitespace-nowrap rounded-full border border-slate-600 px-3 py-1.5 text-xs hover:bg-slate-800"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
