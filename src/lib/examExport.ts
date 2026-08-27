import type { Fill, Workbook } from 'exceljs'
import type { ExamAttempt, ExamSession, ExamSessionMode } from '../types'

const MODE_LABEL: Record<ExamSessionMode, string> = {
  en2ko: '단어 보고 뜻 맞추기',
  ko2en: '뜻 보고 단어 맞추기',
  mixed: '혼합',
}

const STATUS_INFO: Record<string, { label: string; color: string }> = {
  submitted: { label: '완료', color: 'FFC6EFCE' },
  in_progress: { label: '시험 중', color: 'FFFFEB9C' },
  disqualified: { label: '실격', color: 'FFFFC7CE' },
  timed_out: { label: '시간 초과', color: 'FFD9D9D9' },
}

const GREEN = 'FFC6EFCE'
const RED = 'FFFFC7CE'

function formatDateTime(ms: number | undefined | null): string {
  if (!ms) return '-'
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(ms))
}

function sanitizeSheetName(name: string, used: Set<string>): string {
  const base = (name || '학생').replace(/[:\\/?*[\]]/g, '').trim().slice(0, 28) || '학생'
  let candidate = base
  let n = 2
  while (used.has(candidate)) {
    candidate = `${base}(${n})`.slice(0, 31)
    n += 1
  }
  used.add(candidate)
  return candidate
}

// Pure workbook builder — no browser APIs, so it can run in Node (for
// local testing/inspection) as well as in the app itself.
export async function buildExamResultsWorkbook(session: ExamSession, attempts: ExamAttempt[]): Promise<Workbook> {
  const ExcelJS = (await import('exceljs')).default

  const workbook = new ExcelJS.Workbook()
  workbook.creator = '광명고등학교 영단어 시스템'
  workbook.created = new Date()

  // ---- Sheet 1: 요약 ----
  const summary = workbook.addWorksheet('요약')
  summary.columns = [
    { header: '', key: 'label', width: 16 },
    { header: '', key: 'value', width: 40 },
  ]

  const submittedAttempts = attempts.filter((a) => a.status === 'submitted' && a.accuracy != null)
  const average =
    submittedAttempts.length > 0
      ? Math.round(
          (submittedAttempts.reduce((sum, a) => sum + (a.accuracy ?? 0), 0) / submittedAttempts.length) * 100,
        )
      : null

  const summaryRows: [string, string][] = [
    ['시험 이름', session.name],
    ['일시', formatDateTime(session.openedAt ?? session.createdAt)],
    ['출제자', session.createdByName || '-'],
    ['단어 개수', String(session.questionCount)],
    ['제한시간', `${Math.round(session.durationSeconds / 60)}분`],
    ['유형', MODE_LABEL[session.mode]],
    ['평균 점수', average != null ? `${average}점` : '-'],
    ['응시 인원', `${attempts.length}명 (완료 ${submittedAttempts.length}명)`],
  ]
  for (const [label, value] of summaryRows) {
    const row = summary.addRow({ label, value })
    row.getCell(1).font = { bold: true }
  }

  // ---- Sheet 2: 응시자 목록 ----
  const roster = workbook.addWorksheet('응시자 목록')
  roster.columns = [
    { header: '이름', key: 'name', width: 16 },
    { header: '상태', key: 'status', width: 12 },
    { header: '시작 시각', key: 'start', width: 22 },
    { header: '종료 시각', key: 'end', width: 22 },
    { header: '점수', key: 'score', width: 10 },
    { header: '정답/문제', key: 'ratio', width: 12 },
  ]
  roster.getRow(1).font = { bold: true }

  const usedSheetNames = new Set<string>(['요약', '응시자 목록'])
  const studentSheetNames = new Map<string, string>() // uid -> sheet name

  for (const attempt of attempts) {
    studentSheetNames.set(attempt.uid, sanitizeSheetName(attempt.studentName, usedSheetNames))
  }

  for (const attempt of attempts) {
    const statusInfo = STATUS_INFO[attempt.status] ?? { label: attempt.status, color: 'FFFFFFFF' }
    const endMs = attempt.submittedAt ?? attempt.disqualifiedAt
    const totalQuestions =
      attempt.correctCount != null && attempt.wrongCount != null
        ? attempt.correctCount + attempt.wrongCount
        : attempt.questions.length

    const row = roster.addRow({
      name: attempt.studentName,
      status: statusInfo.label,
      start: formatDateTime(attempt.startedAt),
      end: attempt.status === 'in_progress' ? '-' : formatDateTime(endMs),
      score: attempt.status === 'submitted' && attempt.accuracy != null ? `${Math.round(attempt.accuracy * 100)}점` : '-',
      ratio: attempt.status === 'submitted' ? `${attempt.correctCount}/${totalQuestions}` : '-',
    })

    const nameCell = row.getCell(1)
    const sheetName = studentSheetNames.get(attempt.uid)!
    nameCell.value = { text: attempt.studentName, hyperlink: `#'${sheetName}'!A1` }
    nameCell.font = { color: { argb: 'FF1155CC' }, underline: true }

    const statusCell = row.getCell(2)
    statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusInfo.color } }
  }

  // ---- Sheets 3..N: 학생별 정오표 ----
  for (const attempt of attempts) {
    const sheetName = studentSheetNames.get(attempt.uid)!
    const sheet = workbook.addWorksheet(sheetName)
    sheet.columns = [
      { header: '단어', key: 'word', width: 24 },
      { header: '뜻', key: 'meaning', width: 36 },
      { header: '결과', key: 'result', width: 10 },
      { header: '입력한 답안', key: 'answer', width: 30 },
    ]
    sheet.getCell('A1').value = `${attempt.studentName} — ${STATUS_INFO[attempt.status]?.label ?? attempt.status}`
    sheet.mergeCells('A1:D1')
    sheet.getCell('A1').font = { bold: true, size: 13 }
    sheet.addRow([])
    const headerRow = sheet.addRow(['단어', '뜻', '결과', '입력한 답안'])
    headerRow.font = { bold: true }

    if (attempt.answers && attempt.answers.length > 0) {
      for (const ans of attempt.answers) {
        const row = sheet.addRow([
          ans.word,
          ans.meaning,
          ans.correct ? '정답' : '오답',
          ans.correct ? '' : ans.answer || '(빈 답안)',
        ])
        const fill: Fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: ans.correct ? GREEN : RED },
        }
        row.getCell(3).fill = fill
        row.getCell(4).fill = fill
      }
    } else {
      sheet.addRow(['제출된 답안이 없습니다.'])
    }

    const backRow = sheet.addRow([])
    sheet.mergeCells(`A${backRow.number}:D${backRow.number}`)
    const backCell = sheet.getCell(`A${backRow.number}`)
    backCell.value = { text: '← 응시자 목록으로', hyperlink: "#'응시자 목록'!A1" }
    backCell.font = { color: { argb: 'FF1155CC' }, underline: true }
  }

  return workbook
}

export async function exportExamResultsToExcel(session: ExamSession, attempts: ExamAttempt[]) {
  const workbook = await buildExamResultsWorkbook(session, attempts)
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${session.name}_결과.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
