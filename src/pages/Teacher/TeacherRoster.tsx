import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '../../lib/firebase'
import type { AdminProfile } from '../../types'

export default function TeacherRoster() {
  const [teachers, setTeachers] = useState<AdminProfile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'admins'), where('role', '==', 'teacher'))
    return onSnapshot(q, (snap) => {
      setTeachers(snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as AdminProfile))
      setLoading(false)
    })
  }, [])

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
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
            >
              <span className="font-medium text-slate-800">{teacher.displayName ?? '이름 없음'}</span>
              <span className="ml-2 text-xs text-slate-400">{teacher.email}</span>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}
