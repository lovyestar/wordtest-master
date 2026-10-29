import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '../../../lib/firebase'
import { toMillis } from '../../../lib/firestoreUtils'
import type { ExamViolation, ViolationDetail } from '../../../types'

export const VIOLATION_LABEL: Record<string, string> = {
  visibility_hidden: '탭 전환 / 창 최소화',
  blur: '창 포커스 이탈',
  fullscreen_exit: '전체화면 해제',
  page_reload: '새로고침',
  navigate_away: '뒤로 가기(페이지 이동)',
  returned: '시험 화면 복귀',
}

const FATAL = new Set(['visibility_hidden', 'blur', 'fullscreen_exit', 'navigate_away'])


const KEY_LABEL: Record<string, string> = {
  BrowserBack: '뒤로 가기 키 (Chromebook 이전 탭/페이지 키)',
  BrowserForward: '앞으로 가기 키 (Chromebook 이후 탭/페이지 키)',
  BrowserRefresh: '새로고침 키',
  F4: '전체화면 키 (Chromebook)',
  F5: '새로고침',
  F11: '전체화면 전환 키',
  Escape: 'ESC 키 (전체화면 해제 시도)',
  Meta: '검색/시작 키',
  'Ctrl+Tab': '다음 탭으로 이동',
  'Ctrl+Shift+Tab': '이전 탭으로 이동',
  'Ctrl+PageDown': '다음 탭으로 이동',
  'Ctrl+PageUp': '이전 탭으로 이동',
  'Ctrl+T': '새 탭 열기',
  'Ctrl+N': '새 창 열기',
  'Ctrl+W': '탭 닫기',
  'Ctrl+L': '주소창 선택',
  'Ctrl+F': '페이지 내 검색',
  'Ctrl+R': '새로고침',
  'Ctrl+C': '복사',
  'Ctrl+V': '붙여넣기',
  'Ctrl+X': '잘라내기',
  'Alt+Tab': '창 전환',
  'Alt+ESCAPE': '창 전환',
  'Meta+Tab': '창 전환',
}

/** Turns a recorded raw event ("key Ctrl+T", "visibility hidden") into plain Korean. */
function describeEvent(raw: string): { text: string; severity: 'info' | 'warn' | 'bad' } {
  if (raw.startsWith('DISQUALIFIED')) return { text: '실격 처리됨', severity: 'bad' }
  if (raw === 'history back') return { text: '뒤로 가기 (Chromebook 이전 페이지 키 등)', severity: 'bad' }
  if (raw === 'visibility hidden') return { text: '다른 탭으로 이동하거나 창을 숨김', severity: 'bad' }
  if (raw === 'visibility visible') return { text: '시험 화면이 다시 보임', severity: 'info' }
  if (raw === 'window blur') return { text: '시험 창이 포커스를 잃음', severity: 'bad' }
  if (raw === 'window focus') return { text: '시험 창이 포커스를 되찾음', severity: 'info' }
  if (raw === 'fullscreen exit') return { text: '전체화면 해제', severity: 'bad' }
  if (raw === 'fullscreen enter') return { text: '전체화면 진입', severity: 'info' }
  if (raw === 'network offline') return { text: '인터넷 연결 끊김', severity: 'warn' }
  if (raw === 'network online') return { text: '인터넷 다시 연결됨', severity: 'info' }
  if (raw === 'contextmenu') return { text: '마우스 우클릭 메뉴 열기', severity: 'warn' }
  if (raw === 'copy') return { text: '복사 동작', severity: 'warn' }
  if (raw === 'paste') return { text: '붙여넣기 동작', severity: 'warn' }
  if (raw.startsWith('resize ')) return { text: `창 크기 변경 → ${raw.slice(7)}`, severity: 'info' }
  if (raw.startsWith('key ')) {
    const combo = raw.slice(4)
    const meaning = KEY_LABEL[combo]
    return { text: meaning ? `${meaning} 입력` : `단축키 입력: ${combo}`, severity: 'warn' }
  }
  return { text: raw, severity: 'info' }
}

/** "-0.4s key Ctrl+T" → { sec: 0.4, raw: "key Ctrl+T" } */
function splitRecent(line: string) {
  const m = /^(-?[\d.]+)s (.*)$/.exec(line)
  return { sec: m ? Math.abs(Number(m[1])) : 0, raw: m ? m[2] : line }
}

function describeDevice(ua: string) {
  const os = /CrOS/.test(ua)
    ? 'Chromebook'
    : /Windows/.test(ua)
      ? 'Windows'
      : /iPhone|iPad/.test(ua)
        ? 'iPhone/iPad'
        : /Android/.test(ua)
          ? 'Android'
          : /Mac OS X/.test(ua)
            ? 'Mac'
            : '알 수 없는 기기'
  const browser = /Edg\/(\d+)/.exec(ua)
    ? `Edge ${/Edg\/(\d+)/.exec(ua)![1]}`
    : /Chrome\/(\d+)/.exec(ua)
      ? `Chrome ${/Chrome\/(\d+)/.exec(ua)![1]}`
      : /Firefox\/(\d+)/.exec(ua)
        ? `Firefox ${/Firefox\/(\d+)/.exec(ua)![1]}`
        : /Version\/(\d+).*Safari/.exec(ua)
          ? `Safari ${/Version\/(\d+)/.exec(ua)![1]}`
          : '브라우저 미상'
  return `${os} · ${browser}`
}

const SEVERITY_STYLE = {
  info: 'text-slate-600',
  warn: 'font-semibold text-amber-600',
  bad: 'font-bold text-red-600',
}

const VIOLATION_SENTENCE: Record<string, string> = {
  visibility_hidden: '다른 탭으로 이동하거나 창을 최소화',
  blur: '시험 창에서 다른 창으로 포커스를 옮김',
  fullscreen_exit: '전체화면을 해제',
  page_reload: '페이지를 새로고침',
  navigate_away: '뒤로 가기(이전 페이지 이동)를 사용',
  returned: '시험 화면으로 돌아옴',
}

/** One-sentence plain-language summary of a violation, with the likely trigger if a key was pressed just before. */
function summarize(v: ExamViolation) {
  const what = VIOLATION_SENTENCE[v.type] ?? v.type
  const d = v.detail
  if (!d) return `${what}했습니다.`
  const base = `시험 시작 ${formatElapsed(d.elapsedSec)} 후, ${d.questionNumber}번 문항을 푸는 중 ${what}했습니다`
  if (d.awaySec != null) return `실격 후 약 ${d.awaySec}초 만에 시험 화면으로 돌아왔습니다.`
  const trigger = d.recent
    .map(splitRecent)
    .filter((e) => e.raw.startsWith('key ') && e.sec <= 3)
    .pop()
  if (!trigger) return `${base}.`
  return `${base}. 직전 ${trigger.sec.toFixed(1)}초 전에 「${describeEvent(trigger.raw).text}」 동작이 있었습니다.`
}

function formatTime(ms: number) {
  return new Date(ms).toLocaleString('ko-KR', { hour12: false })
}

function formatElapsed(sec: number) {
  return `${Math.floor(sec / 60)}분 ${sec % 60}초`
}

function buildReport(studentName: string, violations: ExamViolation[]) {
  const lines = [`[CheckStar 부정행위 근거] ${studentName}`]
  for (const v of violations) {
    lines.push('', `■ ${VIOLATION_LABEL[v.type] ?? v.type} — ${formatTime(v.at)} (서버 시각)`)
    const d = v.detail
    if (!d) continue
    lines.push(
      `  시험 시작 ${formatElapsed(d.elapsedSec)} 경과 · ${d.questionNumber}번 문항 풀이 중`,
      `  화면 상태: ${d.visibility} / 포커스 ${d.hasFocus ? '있음' : '없음'} / 전체화면 ${d.fullscreen ? '유지' : '해제'}`,
      `  기기: ${describeDevice(d.userAgent)} (화면 ${d.screen}, 창 ${d.viewport})`,
      `  요약: ${summarize(v)}`,
    )
    if (d.awaySec != null) lines.push(`  이탈 시간: 약 ${d.awaySec}초`)
    if (d.recent.length) {
      lines.push(
        '  직전 이벤트:',
        ...d.recent.map((r) => {
          const e = splitRecent(r)
          return `    ${e.sec.toFixed(1)}초 전 · ${describeEvent(e.raw).text} (${e.raw})`
        }),
      )
    }
  }
  return lines.join('\n')
}

function DetailGrid({ d }: { d: ViolationDetail }) {
  const rows: [string, string][] = [
    ['시험 경과', formatElapsed(d.elapsedSec)],
    ['풀이 중 문항', `${d.questionNumber}번`],
    ['페이지 상태', d.visibility === 'hidden' ? '숨김 (다른 탭/최소화)' : '표시'],
    ['창 포커스', d.hasFocus ? '있음' : '없음'],
    ['전체화면', d.fullscreen ? '유지' : '해제됨'],
    ['네트워크', d.online ? '온라인' : '오프라인'],
    ['화면 / 창 크기', `${d.screen} / ${d.viewport}`],
    ['기기 시각', formatTime(new Date(d.clientTime).getTime())],
  ]
  if (d.awaySec != null) rows.unshift(['이탈 시간', `약 ${d.awaySec}초`])
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
      {rows.map(([k, v]) => (
        <div key={k} className="flex gap-2">
          <dt className="w-24 shrink-0 text-slate-400">{k}</dt>
          <dd className="font-medium text-slate-700">{v}</dd>
        </div>
      ))}
      <div className="flex gap-2 sm:col-span-2">
        <dt className="w-24 shrink-0 text-slate-400">기기</dt>
        <dd className="text-slate-700">
          <span className="font-medium">{describeDevice(d.userAgent)}</span>
          <span className="ml-1.5 break-all text-[10px] text-slate-400">({d.userAgent})</span>
        </dd>
      </div>
    </dl>
  )
}

export default function ViolationEvidence({
  sessionId,
  uid,
  studentName,
}: {
  sessionId: string
  uid: string
  studentName: string
}) {
  const [violations, setViolations] = useState<ExamViolation[] | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const q = query(collection(db, 'examSessions', sessionId, 'attempts', uid, 'violations'), orderBy('at', 'asc'))
    return onSnapshot(q, (snap) => {
      setViolations(
        snap.docs.map((d) => {
          const data = d.data({ serverTimestamps: 'estimate' })
          return { id: d.id, type: data.type, at: toMillis(data.at), detail: data.detail } satisfies ExamViolation
        }),
      )
    })
  }, [sessionId, uid])

  async function copyReport() {
    if (!violations) return
    try {
      await navigator.clipboard.writeText(buildReport(studentName, violations))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.alert('복사하지 못했습니다.')
    }
  }

  if (!violations) return <p className="text-xs text-slate-400">불러오는 중...</p>
  if (violations.length === 0) return <p className="text-xs text-slate-400">기록된 감지 내역이 없습니다.</p>

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-slate-500">
          감지 기록 {violations.length}건 · 발생 시각은 서버 기준이며 학생이 수정할 수 없습니다.
        </p>
        <button
          type="button"
          onClick={copyReport}
          className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-white"
        >
          {copied ? '복사됨' : '근거 텍스트 복사'}
        </button>
      </div>
      <ol className="space-y-3">
        {violations.map((v) => (
          <li
            key={v.id}
            className={`border-l-[3px] bg-white p-3 ${FATAL.has(v.type) ? 'border-red-500' : 'border-slate-300'}`}
          >
            <p className="flex flex-wrap items-baseline gap-x-3 text-sm font-semibold text-slate-800">
              {VIOLATION_LABEL[v.type] ?? v.type}
              <span className="text-xs font-normal text-slate-400">{formatTime(v.at)} (서버 시각)</span>
            </p>
            <p className="mt-1.5 bg-slate-50 px-3 py-2 text-sm text-slate-700">{summarize(v)}</p>
            {v.detail ? (
              <div className="mt-2 space-y-2">
                <DetailGrid d={v.detail} />
                {v.detail.recent.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-semibold text-slate-500">직전 행동 기록 (오래된 순)</p>
                    <ul className="divide-y divide-slate-100 border border-slate-200 bg-white text-xs">
                      {v.detail.recent.map((line, i) => {
                        const e = splitRecent(line)
                        const info = describeEvent(e.raw)
                        return (
                          <li key={i} className="flex items-baseline gap-3 px-3 py-1.5">
                            <span className="w-14 shrink-0 text-right font-mono text-slate-400">{e.sec.toFixed(1)}초 전</span>
                            <span className={SEVERITY_STYLE[info.severity]}>{info.text}</span>
                            <span className="text-[10px] text-slate-400">({e.raw})</span>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-1 text-xs text-slate-400">상세 정보 없음 (이전 버전에서 기록됨)</p>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}
