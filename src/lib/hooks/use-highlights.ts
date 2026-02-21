'use client'

import { useState, useCallback, useEffect } from 'react'

export interface Highlight {
  id: string
  start: number
  end: number
  note: string
}

interface HighlightData {
  highlights: Highlight[]
}

const STORAGE_PREFIX = 'highlights:'

function getKey(sessionId: string, questionId: string) {
  return `${STORAGE_PREFIX}${sessionId}:${questionId}`
}

function load(sessionId: string, questionId: string): HighlightData {
  if (typeof window === 'undefined') return { highlights: [] }
  try {
    const raw = localStorage.getItem(getKey(sessionId, questionId))
    if (!raw) return { highlights: [] }
    return JSON.parse(raw)
  } catch {
    return { highlights: [] }
  }
}

function save(sessionId: string, questionId: string, data: HighlightData) {
  if (typeof window === 'undefined') return
  localStorage.setItem(getKey(sessionId, questionId), JSON.stringify(data))
}

export function useHighlights(sessionId: string | null, questionId: string | null) {
  const [highlights, setHighlights] = useState<Highlight[]>([])

  useEffect(() => {
    if (!sessionId || !questionId) return
    const data = load(sessionId, questionId)
    setHighlights(data.highlights)
  }, [sessionId, questionId])

  const addHighlight = useCallback((start: number, end: number) => {
    if (!sessionId || !questionId) return
    const current = load(sessionId, questionId)
    const newHighlight: Highlight = {
      id: `hl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      start,
      end,
      note: '',
    }
    const updated = [...current.highlights, newHighlight]
    save(sessionId, questionId, { highlights: updated })
    setHighlights(updated)
    return newHighlight.id
  }, [sessionId, questionId])

  const removeHighlight = useCallback((id: string) => {
    if (!sessionId || !questionId) return
    const current = load(sessionId, questionId)
    const updated = current.highlights.filter((h) => h.id !== id)
    save(sessionId, questionId, { highlights: updated })
    setHighlights(updated)
  }, [sessionId, questionId])

  const updateNote = useCallback((id: string, note: string) => {
    if (!sessionId || !questionId) return
    const current = load(sessionId, questionId)
    const updated = current.highlights.map((h) =>
      h.id === id ? { ...h, note } : h
    )
    save(sessionId, questionId, { highlights: updated })
    setHighlights(updated)
  }, [sessionId, questionId])

  return { highlights, addHighlight, removeHighlight, updateNote }
}

export function clearSessionHighlights(sessionId: string) {
  if (typeof window === 'undefined') return
  const toRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(`${STORAGE_PREFIX}${sessionId}:`)) {
      toRemove.push(key)
    }
  }
  toRemove.forEach((key) => localStorage.removeItem(key))
}
