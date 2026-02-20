'use client'

import { useState, useEffect, useCallback } from 'react'
import { calculateRemainingTime } from '@/lib/utils/timer'

export function useTimer(
  testStartedAt: string | null,
  durationMinutes: number,
  onExpiry?: () => void
) {
  const [remaining, setRemaining] = useState<number>(durationMinutes * 60 * 1000)
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    if (!testStartedAt) return

    function tick() {
      const ms = calculateRemainingTime(testStartedAt!, durationMinutes)
      setRemaining(ms)
      if (ms <= 0 && !expired) {
        setExpired(true)
        onExpiry?.()
      }
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [testStartedAt, durationMinutes, onExpiry, expired])

  return { remaining, expired }
}
