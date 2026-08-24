import { addDoc, collection, deleteDoc, doc, getDocs, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useWordSets } from '../../../hooks/useWordSets'
import { db } from '../../../lib/firebase'
import { useAuthStore } from '../../../store/authStore'

export default function WordSetList() {
  const { wordSets, loading } = useWordSets()
  const { firebaseUser, adminProfile } = useAuthStore()
  const navigate = useNavigate()

  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleCreate() {
    if (!name.trim() || !firebaseUser) return
    setCreating(true)
    try {
      const ref = await addDoc(collection(db, 'wordSets'), {
        name: name.trim(),
        isDefault: false,
        active: true,
        wordCount: 0,
        createdBy: firebaseUser.uid,
        createdByName: adminProfile?.displayName ?? adminProfile?.email ?? '',
        createdAt: serverTimestamp(),
      })
      navigate(`/teacher/word-sets/${ref.id}`)
    } finally {
      setCreating(false)
    }
  }

  async function toggleActive(id: string, active: boolean) {
    await updateDoc(doc(db, 'wordSets', id), { active: !active })
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`"${name}" 단어장을 삭제할까요? 단어 데이터가 모두 삭제되며 되돌릴 수 없습니다.`)) return
    setDeletingId(id)
    try {
      const entriesSnap = await getDocs(collection(db, 'wordSets', id, 'entries'))
      const docs = entriesSnap.docs
      for (let i = 0; i < docs.length; i += 400) {
        const batch = writeBatch(db)
        docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref))
        await batch.commit()
      }
      await deleteDoc(doc(db, 'wordSets', id))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">단어장 관리</h1>
      </div>

      <div className="mt-4 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="새 단어장 이름"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={handleCreate}
          disabled={creating || !name.trim()}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          새 단어장 만들기
        </button>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3">이름</th>
              <th className="px-4 py-3">만든 사람</th>
              <th className="px-4 py-3">단어 수</th>
              <th className="px-4 py-3">상태</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-center text-slate-400" colSpan={5}>
                  불러오는 중...
                </td>
              </tr>
            ) : (
              wordSets.map((set) => (
                <tr key={set.id}>
                  <td className="px-4 py-3">
                    <Link to={`/teacher/word-sets/${set.id}`} className="font-medium text-indigo-600 hover:underline">
                      {set.name}
                    </Link>
                    {set.isDefault && (
                      <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">기본</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{set.createdByName ? `${set.createdByName}선생님` : '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{set.wordCount}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleActive(set.id, set.active)}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        set.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {set.active ? '사용 중' : '숨김'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(set.id, set.name)}
                      disabled={deletingId === set.id}
                      className="mr-3 text-xs text-red-400 hover:text-red-600 disabled:opacity-50"
                    >
                      {deletingId === set.id ? '삭제 중...' : '삭제'}
                    </button>
                    <Link to={`/teacher/word-sets/${set.id}`} className="text-xs text-slate-400 hover:text-slate-700">
                      편집 →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
