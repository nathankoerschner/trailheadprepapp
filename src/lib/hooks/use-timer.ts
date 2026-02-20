'use client'

import { useState, useEffect } from 'react'
import { calculateRemainingTime } from '@/lib/utils/timer'

export function useTimer(
  testStartedAt: string | null,
  durationMinutes: number,
  onExpiry?: () => void,
  totalPausedMs: number = 0,
  pausedAt: string | null = null
) {
  const [remaining, setRemaining] = useState<number>(durationMinutes * 60 * 1000)
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    if (!testStartedAt) return

    function tick() {
      const ms = calculateRemainingTime(testStartedAt!, durationMinutes, totalPausedMs, pausedAt)
      setRemaining(ms)
      if (ms <= 0 && !expired) {
        setExpired(true)
        onExpiry?.()
      }
    }

    tick()
    // Don't tick when paused — timer is frozen
    if (pausedAt) return
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [testStartedAt, durationMinutes, onExpiry, expired, totalPausedMs, pausedAt])

  return { remaining, expired }
}
