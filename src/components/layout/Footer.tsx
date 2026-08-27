export default function Footer({ showAdminLink = false }: { showAdminLink?: boolean }) {
  return (
    <footer className="py-6 text-center text-xs text-slate-400">
      Made by lovyestar ·{' '}
      <a
        href="https://yestar.dev"
        target="_blank"
        rel="noreferrer"
        className="text-slate-500 hover:text-indigo-600 hover:underline"
      >
        yestar.dev
      </a>
      {showAdminLink && (
        <>
          {' · '}
          <a href="/teacher/login" className="text-slate-300 hover:text-slate-500">
            관리자 페이지로 이동
          </a>
        </>
      )}
    </footer>
  )
}
