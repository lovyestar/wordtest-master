import type { ViolationDetail } from '../types'

const MAX_EVENTS = 40
const RECENT_IN_REPORT = 25

// Keys that carry no evidence value (and would only add noise / typed content).
const IGNORED_KEYS = new Set(['Enter', 'Backspace', 'Delete', 'Shift', 'Process', 'Dead', 'Unidentified', 'CapsLock'])
const IGNORED_ARROWS = /^Arrow/

function describeKey(e: KeyboardEvent): string | null {
  const named = e.key.length > 1 && !IGNORED_KEYS.has(e.key) && !IGNORED_ARROWS.test(e.key)
  const combo = e.ctrlKey || e.metaKey || e.altKey
  if (!named && !combo) return null // plain typing — never recorded
  const mods = [e.ctrlKey && 'Ctrl', e.metaKey && 'Meta', e.altKey && 'Alt', e.shiftKey && 'Shift'].filter(Boolean)
  const key = e.key.length === 1 ? e.key.toUpperCase() : e.key
  return `key ${[...mods, key].join('+')}`
}

/**
 * Keeps a short rolling timeline of window-level events (focus, visibility,
 * fullscreen, special/shortcut keys, resize, connectivity) so that a violation
 * can be saved together with what happened right before it. Typed letters and
 * answers are never captured.
 */
export function startEvidenceRecorder() {
  const startedAt = Date.now()
  const events: { t: number; label: string }[] = []

  const push = (label: string) => {
    events.push({ t: Date.now(), label })
    if (events.length > MAX_EVENTS) events.shift()
  }

  const on = <T extends EventTarget>(target: T, type: string, handler: (e: Event) => void) => {
    target.addEventListener(type, handler, true)
    return () => target.removeEventListener(type, handler, true)
  }

  const offs = [
    on(document, 'visibilitychange', () => push(`visibility ${document.visibilityState}`)),
    on(window, 'blur', () => push('window blur')),
    on(window, 'focus', () => push('window focus')),
    on(document, 'fullscreenchange', () => push(document.fullscreenElement ? 'fullscreen enter' : 'fullscreen exit')),
    on(window, 'resize', () => push(`resize ${window.innerWidth}x${window.innerHeight}`)),
    on(window, 'online', () => push('network online')),
    on(window, 'offline', () => push('network offline')),
    on(document, 'contextmenu', () => push('contextmenu')),
    on(document, 'copy', () => push('copy')),
    on(document, 'paste', () => push('paste')),
    on(document, 'keydown', (e) => {
      const label = describeKey(e as KeyboardEvent)
      if (label) push(label)
    }),
  ]

  function snapshot(questionNumber: number, awaySec?: number): ViolationDetail {
    const now = Date.now()
    const recent = events.slice(-RECENT_IN_REPORT).map((ev) => `${((ev.t - now) / 1000).toFixed(1)}s ${ev.label}`)
    return {
      elapsedSec: Math.round((now - startedAt) / 1000),
      questionNumber,
      visibility: document.visibilityState,
      hasFocus: document.hasFocus(),
      fullscreen: !!document.fullscreenElement,
      online: navigator.onLine,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      screen: `${window.screen.width}x${window.screen.height}`,
      userAgent: navigator.userAgent,
      clientTime: new Date(now).toISOString(),
      ...(awaySec != null && { awaySec }),
      recent,
    }
  }

  return { push, snapshot, stop: () => offs.forEach((off) => off()) }
}

export type EvidenceRecorder = ReturnType<typeof startEvidenceRecorder>
