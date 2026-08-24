import { collection, onSnapshot } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { db } from '../../lib/firebase'
import { removeAdminFn } from '../../lib/functionsClient'
import { useAuthStore } from '../../store/authStore'
import type { AdminProfile } from '../../types'

export default function TeacherAdmins() {
  const { firebaseUser, adminProfile } = useAuthStore()
  const [admins, setAdmins] = useState<AdminProfile[]>([])
  const [processingUid, setProcessingUid] = useState<string | null>(null)

  useEffect(() => {
    return onSnapshot(collection(db, 'admins'), (snap) => {
      setAdmins(snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as AdminProfile))
    })
  }, [])

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

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">관리자</h1>
      <p className="mt-1 text-sm text-slate-500">최고 관리자 권한을 가진 계정 목록입니다.</p>

      <ul className="mt-6 space-y-2">
        {admins.map((admin) => (
          <li
            key={admin.uid}
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
          >
            <span>
              <span className="font-medium text-slate-800">
                {admin.displayName ? `${admin.displayName} 선생님` : '이름 없음'}
              </span>
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
    </div>
  )
}
