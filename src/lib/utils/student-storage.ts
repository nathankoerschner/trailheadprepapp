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

  // Fallback path for sessions where sessionStorage is unavailable/reset.
  const legacy = getLegacyStorage()?.getItem(key) ?? null
  if (!legacy) return null

  // Rehydrate sessionStorage when possible for fast subsequent reads.
  sessionStorage?.setItem(key, legacy)
  return legacy
}

export function setStudentStorageItem(key: StudentStorageKey, value: string) {
  const sessionStorage = getSessionStorage()
  sessionStorage?.setItem(key, value)

  // Mirror into localStorage so session state survives sessionStorage loss.
  getLegacyStorage()?.setItem(key, value)
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
