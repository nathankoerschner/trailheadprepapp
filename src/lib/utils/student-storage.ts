type StudentStorageKey = 'student_token' | 'session_id' | 'student_id' | 'student_name'

function canUseWindow() {
  return typeof window !== 'undefined'
}

function getSessionStorage() {
  return canUseWindow() ? window.sessionStorage : null
}

function getLegacyStorage() {
  return canUseWindow() ? window.localStorage : null
}

export function getStudentStorageItem(key: StudentStorageKey): string | null {
  const sessionStorage = getSessionStorage()
  const value = sessionStorage?.getItem(key) ?? null
  if (value) return value

  // One-time compatibility path for in-progress sessions from older builds.
  const legacy = getLegacyStorage()?.getItem(key) ?? null
  if (!legacy) return null

  sessionStorage?.setItem(key, legacy)
  getLegacyStorage()?.removeItem(key)
  return legacy
}

export function setStudentStorageItem(key: StudentStorageKey, value: string) {
  const sessionStorage = getSessionStorage()
  sessionStorage?.setItem(key, value)

  // Ensure old shared storage cannot override per-window session state.
  getLegacyStorage()?.removeItem(key)
}

export function clearStudentStorage() {
  const keys: StudentStorageKey[] = ['student_token', 'session_id', 'student_id', 'student_name']
  const sessionStorage = getSessionStorage()
  const legacyStorage = getLegacyStorage()

  for (const key of keys) {
    sessionStorage?.removeItem(key)
    legacyStorage?.removeItem(key)
  }
}
