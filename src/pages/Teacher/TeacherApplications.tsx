import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { db } from '../../lib/firebase'
import { toMillis } from '../../lib/firestoreUtils'
import { reviewTeacherApplicationFn } from '../../lib/functionsClient'
import { useAuthStore } from '../../store/authStore'
import type { TeacherApplication } from '../../types'

export default function TeacherApplications() {
  const { adminProfile } = useAuthStore()
  const [applications, setApplications] = useState<TeacherApplication[]>([])
  const [processingUid, setProcessingUid] = useState<string | null>(null)

  useEffect(() => {
    const q = query(collection(db, 'teacherApplications'), orderBy('requestedAt', 'desc'))
    return onSnapshot(q, (snap) => {
      setApplications(
        snap.docs.map((d) => {
          const data = d.data()
          return {
            uid: d.id,
            email: data.email,
            name: data.name,
            status: data.status,
            requestedAt: toMillis(data.requestedAt),
            reviewedAt: data.reviewedAt ? toMillis(data.reviewedAt) : undefined,
            reviewedBy: data.reviewedBy,
          } satisfies TeacherApplication
        }),
      )
    })
  }, [])

  async function handleReview(uid: string, approve: boolean) {
    setProcessingUid(uid)
    try {
      await reviewTeacherApplicationFn({ uid, approve })
    } finally {
      setProcessingUid(null)
    }
  }

  // Approving/rejecting stays a super-admin-only action even though this
  // tab is where teachers can see it — the Cloud Function itself also
  // enforces role === 'admin', this is just the matching UI guard.
  if (adminProfile && adminProfile.role !== 'admin') return <Navigate to="/teacher" replace />

  const pending = applications.filter((a) => a.status === 'pending')

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">선생님 신청</h1>
      <p className="mt-1 text-sm text-slate-500">선생님 등록을 신청한 계정을 승인하거나 거절합니다.</p>

      <section className="mt-6">
        {pending.length === 0 ? (
          <p className="text-sm text-slate-400">대기 중인 신청이 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {pending.map((app) => (
              <li
                key={app.uid}
                className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800">{app.name}</p>
                  <p className="text-xs text-slate-500">{app.email}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleReview(app.uid, true)}
                    disabled={processingUid === app.uid}
                    className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    승인
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReview(app.uid, false)}
                    disabled={processingUid === app.uid}
                    className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                  >
                    거절
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
