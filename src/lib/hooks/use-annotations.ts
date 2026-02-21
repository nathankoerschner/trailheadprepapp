'use client'

import { useState, useCallback, useEffect } from 'react'
import type { AnswerChoice } from '@/lib/types/database'

interface AnnotationData {
  eliminated: AnswerChoice[]
}

const STORAGE_PREFIX = 'annotations:'

function getKey(sessionId: string, questionId: string) {
  return `${STORAGE_PREFIX}${sessionId}:${questionId}`
}

function load(sessionId: string, questionId: string): AnnotationData {
  if (typeof window === 'undefined') return { eliminated: [] }
  try {
    const raw = localStorage.getItem(getKey(sessionId, questionId))
    if (!raw) return { eliminated: [] }
    return JSON.parse(raw)
  } catch {
    return { eliminated: [] }
  }
}

function save(sessionId: string, questionId: string, data: AnnotationData) {
  if (typeof window === 'undefined') return
  localStorage.setItem(getKey(sessionId, questionId), JSON.stringify(data))
}

export function useAnnotations(sessionId: string | null, questionId: string | null) {
  const [eliminated, setEliminated] = useState<Set<AnswerChoice>>(new Set())

  useEffect(() => {
    if (!sessionId || !questionId) return
    const data = load(sessionId, questionId)
    setEliminated(new Set(data.eliminated))
  }, [sessionId, questionId])

  const toggleElimination = useCallback((answer: AnswerChoice) => {
    if (!sessionId || !questionId) return
    const current = load(sessionId, questionId)
    const elim = new Set(current.eliminated as AnswerChoice[])
    if (elim.has(answer)) elim.delete(answer)
    else elim.add(answer)
    save(sessionId, questionId, { eliminated: [...elim] })
    setEliminated(elim)
  }, [sessionId, questionId])

  return { eliminated, toggleElimination }
}

export function clearSessionAnnotations(sessionId: string) {
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
