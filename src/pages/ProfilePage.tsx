import { doc, setDoc } from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { useRef, useState } from 'react'
import { db, storage } from '../lib/firebase'
import { useAuthStore } from '../store/authStore'

export default function ProfilePage() {
  const { firebaseUser, profile } = useAuthStore()

  const [name, setName] = useState(profile?.name ?? '')
  const [studentId, setStudentId] = useState(profile?.studentId ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!firebaseUser) return
    const trimmedName = name.trim()
    const trimmedId = studentId.trim()
    if (!trimmedName || !trimmedId) {
      setError('이름과 학번을 모두 입력해주세요.')
      return
    }

    setSubmitting(true)
    setError(null)
    setSaved(false)
    try {
      await setDoc(
        doc(db, 'users', firebaseUser.uid),
        {
          name: trimmedName,
          studentId: trimmedId,
          displayName: `${trimmedId} ${trimmedName}`,
        },
        { merge: true },
      )
      setSaved(true)
    } catch {
      setError('저장하지 못했습니다. 다시 시도해주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !firebaseUser) return
    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 업로드할 수 있습니다.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('5MB 이하 이미지만 업로드할 수 있습니다.')
      return
    }

    setUploading(true)
    setError(null)
    try {
      const avatarRef = ref(storage, `avatars/${firebaseUser.uid}/avatar`)
      await uploadBytes(avatarRef, file, { contentType: file.type })
      const photoURL = await getDownloadURL(avatarRef)
      await setDoc(doc(db, 'users', firebaseUser.uid), { photoURL }, { merge: true })
    } catch {
      setError('사진을 업로드하지 못했습니다. 다시 시도해주세요.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-xl font-bold text-slate-900">내 정보 수정</h1>
      <p className="mt-1 text-sm text-slate-500">랭킹과 시험에 표시되는 학번/이름을 변경합니다.</p>

      <div className="mt-6 flex items-center gap-4">
        {profile?.photoURL ? (
          <img src={profile.photoURL} alt="" className="h-16 w-16 rounded-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <div className="h-16 w-16 rounded-full bg-slate-200" />
        )}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            disabled={uploading}
            className="hidden"
            id="avatar-input"
          />
          <label
            htmlFor="avatar-input"
            className="cursor-pointer rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            {uploading ? '업로드 중...' : '프로필 사진 변경'}
          </label>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-center">
        <p className="text-xs text-indigo-500">단어 모의 시험 랭킹 1등 횟수</p>
        <p className="mt-1 text-2xl font-bold text-indigo-700">{profile?.firstPlaceCount ?? 0}회</p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-3">
        <input
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          placeholder="학번 (예: 30512)"
          className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:border-indigo-500 focus:outline-none"
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="이름"
          className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:border-indigo-500 focus:outline-none"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && <p className="text-sm text-emerald-600">저장했습니다.</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {submitting ? '저장 중...' : '저장'}
        </button>
      </form>
    </div>
  )
}
