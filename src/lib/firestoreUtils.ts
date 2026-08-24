import { Timestamp } from 'firebase/firestore'

export function toMillis(value: unknown): number {
  if (!value) return 0
  if (typeof value === 'number') return value
  if (value instanceof Timestamp) return value.toMillis()
  return 0
}
