'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { usePolling } from '@/lib/hooks/use-polling'

export default function StudentWaitingPage() {
  const router = useRouter()

  const checkStatus = useCallback(async () => {
    const sessionId = localStorage.getItem('session_id')
    if (!sessionId) return

    const res = await fetch(`/api/sessions/${sessionId}/status`)
    if (!res.ok) return
    const data = await res.json()

    switch (data.status) {
      case 'lesson':
        router.push('/student/practice')
        break
      case 'retest':
        router.push('/student/retest')
        break
      case 'complete':
        router.push('/student/report')
        break
    }
  }, [router])

  usePolling(checkStatus, 3000)

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardContent className="py-12 text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-slate-400" />
          <h2 className="text-lg font-semibold">Great job!</h2>
          <p className="mt-2 text-sm text-slate-500">
            Your tutor is analyzing results. Sit tight while the AI works its magic...
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
