import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { db } from '../../lib/firebase'
import { toMillis } from '../../lib/firestoreUtils'
import { removeAdminFn, reviewTeacherApplicationFn } from '../../lib/functionsClient'
import { useAuthStore } from '../../store/authStore'
import type { AdminProfile, TeacherApplication } from '../../types'

export default function TeacherAdmins() {
  const { firebaseUser, adminProfile } = useAuthStore()
  const [applications, setApplications] = useState<TeacherApplication[]>([])
  const [admins, setAdmins] = useState<AdminProfile[]>([])
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

  useEffect(() => {
    return onSnapshot(collection(db, 'admins'), (snap) => {
      setAdmins(
        snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as AdminProfile),
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

  async function handleRemoveAdmin(uid: string, name: string) {
    if (!window.confirm(`"${name}" 관리자 권한을 삭제할까요?`)) return
    setProcessingUid(uid)
    try {
      await removeAdminFn({ uid })
    } finally {
      setProcessingUid(null)
    }
  }

  if (adminProfile && adminProfile.role !== 'admin') return <Navigate to="/teacher" replace />

  const pending = applications.filter((a) => a.status === 'pending')

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">관리자 승인</h1>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-slate-700">승인 대기 중인 신청</h2>
        {pending.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">대기 중인 신청이 없습니다.</p>
        ) : (
          <ul className="mt-2 space-y-2">
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

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-slate-700">현재 관리자</h2>
        <ul className="mt-2 space-y-2">
          {admins.map((admin) => (
            <li
              key={admin.uid}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
            >
              <span>
                <span className="font-medium text-slate-800">{admin.displayName ?? '이름 없음'}</span>
                <span className="ml-2 text-xs text-slate-400">{admin.email}</span>
              </span>
              {admin.uid !== firebaseUser?.uid && (
                <button
                  type="button"
                  onClick={() => handleRemoveAdmin(admin.uid, admin.displayName ?? admin.email)}
                  disabled={processingUid === admin.uid}
                  className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50"
                >
                  {processingUid === admin.uid ? '삭제 중...' : '삭제'}
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
