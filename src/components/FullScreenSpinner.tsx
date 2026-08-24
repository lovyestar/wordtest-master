export default function FullScreenSpinner() {
  return (
    <div className="flex h-full min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
    </div>
  )
}
