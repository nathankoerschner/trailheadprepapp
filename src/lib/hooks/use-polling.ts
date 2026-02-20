'use client'

import { useEffect, useRef, useCallback } from 'react'

export function usePolling(
  callback: () => Promise<void>,
  intervalMs: number = 3000,
  enabled: boolean = true
) {
  const savedCallback = useRef(callback)

  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  useEffect(() => {
    if (!enabled) return

    let mounted = true

    async function poll() {
      if (!mounted) return
      await savedCallback.current()
      if (mounted) {
        timer = setTimeout(poll, intervalMs)
      }
    }

    let timer = setTimeout(poll, intervalMs)

    return () => {
      mounted = false
      clearTimeout(timer)
    }
  }, [intervalMs, enabled])
}

export function useSessionStatus(
  sessionId: string,
  onStatusChange?: (status: string) => void
) {
  const statusRef = useRef<string>('')

  const checkStatus = useCallback(async () => {
    const res = await fetch(`/api/sessions/${sessionId}/status`)
    if (!res.ok) return
    const data = await res.json()

    if (statusRef.current && data.status !== statusRef.current) {
      onStatusChange?.(data.status)
    }
    statusRef.current = data.status

    return data
  }, [sessionId, onStatusChange])

  usePolling(checkStatus, 3000)

  return { checkStatus }
}
