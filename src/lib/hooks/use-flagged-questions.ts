'use client'

import { useState, useCallback, useEffect } from 'react'

const STORAGE_PREFIX = 'flagged:'

function getKey(sessionId: string) {
  return `${STORAGE_PREFIX}${sessionId}`
}

function load(sessionId: string): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(getKey(sessionId))
    if (!raw) return new Set()
    return new Set(JSON.parse(raw))
  } catch {
    return new Set()
  }
}

function save(sessionId: string, flagged: Set<string>) {
  if (typeof window === 'undefined') return
  localStorage.setItem(getKey(sessionId), JSON.stringify([...flagged]))
}

export function useFlaggedQuestions(sessionId: string | null) {
  const [flagged, setFlagged] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!sessionId) return
    setFlagged(load(sessionId))
  }, [sessionId])

  const toggleFlag = useCallback(
    (questionId: string) => {
      if (!sessionId) return
      const current = load(sessionId)
      if (current.has(questionId)) current.delete(questionId)
      else current.add(questionId)
      save(sessionId, current)
      setFlagged(new Set(current))
    },
    [sessionId]
  )

  return { flagged, toggleFlag }
}

export function clearSessionFlags(sessionId: string) {
  if (typeof window === 'undefined') return
  localStorage.removeItem(`${STORAGE_PREFIX}${sessionId}`)
}
