'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Users } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { usePolling } from '@/lib/hooks/use-polling'

export default function StudentLobbyPage() {
  const router = useRouter()
  const [studentName, setStudentName] = useState('')
  const [students, setStudents] = useState<Array<{ student_id: string; students: { name: string } }>>([])

  useEffect(() => {
    const name = localStorage.getItem('student_name')
    if (!name) {
      router.push('/student/join')
      return
    }
    setStudentName(name)
  }, [router])

  const checkStatus = useCallback(async () => {
    const sessionId = localStorage.getItem('session_id')
    if (!sessionId) return

    const res = await fetch(`/api/sessions/${sessionId}/status`)
    if (!res.ok) return
    const data = await res.json()

    setStudents(data.students || [])

    // Redirect based on phase
    switch (data.status) {
      case 'testing':
        router.push('/student/test')
        break
      case 'analyzing':
        router.push('/student/waiting')
        break
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
