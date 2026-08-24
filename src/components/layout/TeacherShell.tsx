import { NavLink, Outlet } from 'react-router-dom'
import { signOutUser } from '../../lib/auth'
import { useAuthStore } from '../../store/authStore'
import Footer from './Footer'

const TABS = [
  { to: '/teacher', label: '대시보드', end: true },
  { to: '/teacher/word-sets', label: '단어장 관리' },
  { to: '/teacher/exams', label: '시험 관리' },
  { to: '/teacher/admins', label: '관리자 승인' },
]

export default function TeacherShell() {
  const { adminProfile } = useAuthStore()

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-slate-900 text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="font-bold">광명고등학교 영단어 시스템 · 관리자</span>
            <nav className="flex items-center gap-1">
              {TABS.map((tab) => (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  end={tab.end}
                  className={({ isActive }) =>
                    `rounded-full px-3 py-1.5 text-sm font-medium transition ${
                      isActive ? 'bg-white text-slate-900' : 'text-slate-300 hover:bg-slate-800'
                    }`
                  }
                >
                  {tab.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-300">
            <span>{adminProfile?.email}</span>
            <button
              type="button"
              onClick={() => signOutUser()}
              className="rounded-full border border-slate-600 px-3 py-1.5 text-xs hover:bg-slate-800"
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
