import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '../../lib/firebase'
import { removeAdminFn } from '../../lib/functionsClient'
import { useAuthStore } from '../../store/authStore'
import type { AdminProfile } from '../../types'

export default function TeacherRoster() {
  const { adminProfile } = useAuthStore()
  const isSuperAdmin = adminProfile?.role === 'admin'

  const [teachers, setTeachers] = useState<AdminProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [processingUid, setProcessingUid] = useState<string | null>(null)

  useEffect(() => {
    const q = query(collection(db, 'admins'), where('role', '==', 'teacher'))
    return onSnapshot(q, (snap) => {
      setTeachers(snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as AdminProfile))
      setLoading(false)
    })
  }, [])

  async function handleRemove(uid: string, name: string) {
    if (!window.confirm(`"${name}" 선생님 등록을 삭제할까요?`)) return
    setProcessingUid(uid)
    try {
      await removeAdminFn({ uid })
    } finally {
      setProcessingUid(null)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">선생님</h1>
      <p className="mt-1 text-sm text-slate-500">함께 등록된 선생님 목록입니다.</p>

      <ul className="mt-6 space-y-2">
        {loading ? (
          <p className="text-sm text-slate-400">불러오는 중...</p>
        ) : teachers.length === 0 ? (
          <p className="text-sm text-slate-400">등록된 선생님이 없습니다.</p>
        ) : (
          teachers.map((teacher) => (
            <li
              key={teacher.uid}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
            >
              <span>
                <span className="font-medium text-slate-800">
                  {teacher.displayName ? `${teacher.displayName} 선생님` : '이름 없음'}
                </span>
                <span className="ml-2 text-xs text-slate-400">{teacher.email}</span>
              </span>
              {/* Teachers can see each other here but never delete each
                  other — only the super-admin gets this control. */}
              {isSuperAdmin && (
                <button
                  type="button"
                  onClick={() => handleRemove(teacher.uid, teacher.displayName ?? teacher.email)}
                  disabled={processingUid === teacher.uid}
                  className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50"
                >
                  {processingUid === teacher.uid ? '삭제 중...' : '삭제'}
                </button>
              )}
            </li>
          ))
        )}
      </ul>
    </div>
  )
}
