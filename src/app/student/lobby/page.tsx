'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Users } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { usePolling } from '@/lib/hooks/use-polling'
import { clearStudentStorage, getStudentStorageItem } from '@/lib/utils/student-storage'

function logStudentRedirect(reason: string, details: Record<string, unknown>) {
  // Lightweight client diagnostics to identify why a student was ejected.
  console.warn('[student:lobby] Redirecting to /student/join', { reason, ...details })
}

export default function StudentLobbyPage() {
  const router = useRouter()
  const [studentName] = useState(() => getStudentStorageItem('student_name') || 'Student')
  const [students, setStudents] = useState<Array<{ student_id: string; students: { name: string } }>>([])
  const missingStatusCountRef = useRef(0)

  useEffect(() => {
    const sessionId = getStudentStorageItem('session_id')
    const token = getStudentStorageItem('student_token')
    if (!sessionId || !token) {
      logStudentRedirect('missing-session-auth', {
        hasSessionId: Boolean(sessionId),
        hasToken: Boolean(token),
        hasStudentName: Boolean(getStudentStorageItem('student_name')),
      })
      clearStudentStorage()
      router.push('/student/join')
      return
    }
  }, [router])

  const checkStatus = useCallback(async () => {
    const sessionId = getStudentStorageItem('session_id')
    const token = getStudentStorageItem('student_token')

    if (!sessionId || !token) {
      logStudentRedirect('missing-session-auth-while-polling', {
        hasSessionId: Boolean(sessionId),
        hasToken: Boolean(token),
        hasStudentName: Boolean(getStudentStorageItem('student_name')),
      })
      clearStudentStorage()
      router.push('/student/join')
      return
    }

    const res = await fetch(`/api/sessions/${sessionId}/status`, { cache: 'no-store' })
    if (!res.ok) {
      if (res.status === 404) {
        missingStatusCountRef.current += 1
        if (missingStatusCountRef.current >= 3) {
          logStudentRedirect('status-404-threshold', {
            sessionId,
            misses: missingStatusCountRef.current,
          })
          clearStudentStorage()
          router.push('/student/join')
        }
      }
      return
    }

    missingStatusCountRef.current = 0
    const data = await res.json()

    setStudents(data.students || [])

    // Redirect based on phase
    switch (data.status) {
      case 'testing':
      case 'paused':
        router.push('/student/test')
        break
      case 'analyzing':
        router.push('/student/waiting')
        break
      case 'lesson':
        router.push('/student/waiting')
        break
      case 'retest':
        router.push('/student/retest')
        break
      case 'complete':
        clearStudentStorage()
        router.push('/student/join')
        break
    }
  }, [router])

  usePolling(checkStatus, 3000)

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardContent className="py-12 text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-slate-400" />
          <h2 className="text-lg font-semibold">Welcome, {studentName}</h2>
          <p className="mt-2 text-sm text-slate-500">
            Waiting for your tutor to start the session...
          </p>
          {students.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-center gap-1 text-sm text-slate-400">
                <Users className="h-4 w-4" />
                {students.length} students joined
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
