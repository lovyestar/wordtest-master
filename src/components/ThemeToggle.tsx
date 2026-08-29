import { useThemeStore } from '../store/themeStore'

interface ThemeToggleProps {
  variant?: 'default' | 'onDark'
  className?: string
}

export default function ThemeToggle({ variant = 'default', className = '' }: ThemeToggleProps) {
  const { theme, toggleTheme } = useThemeStore()

  const variantClass =
    variant === 'onDark'
      ? 'border-slate-600 text-slate-300 hover:bg-slate-800'
      : 'border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition ${variantClass} ${className}`}
    >
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path
        strokeLinecap="round"
        d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
      />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 1020.354 15.354z" />
    </svg>
  )
}
