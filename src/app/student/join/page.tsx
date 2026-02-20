'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'
import type { Student } from '@/lib/types/database'
import { getStudentStorageItem, setStudentStorageItem } from '@/lib/utils/student-storage'

export default function StudentJoinPage() {
  const router = useRouter()
  const [pin, setPin] = useState('')
  const [step, setStep] = useState<'pin' | 'name'>('pin')
  const [sessionId, setSessionId] = useState('')
  const [students, setStudents] = useState<Student[]>([])
  const [selectedStudent, setSelectedStudent] = useState<string>('')
  const [loading, setLoading] = useState(false)

  // Check if already in session
  useEffect(() => {
    const token = getStudentStorageItem('student_token')
    const storedSessionId = getStudentStorageItem('session_id')
    if (token && storedSessionId) {
      router.push('/student/lobby')
    }
  }, [router])

  async function handlePinSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (pin.length !== 6) return

    setLoading(true)
    // Find session by PIN
    const res = await fetch(`/api/sessions/find?pin=${pin}`)
    if (!res.ok) {
      toast.error('Session not found')
      setLoading(false)
      return
    }

    const data = await res.json()
    setSessionId(data.sessionId)
    setStudents(data.students)
    setStep('name')
    setLoading(false)
  }

  async function handleJoin() {
    if (!selectedStudent) {
      toast.error('Select your name')
      return
    }

    setLoading(true)
    const res = await fetch(`/api/sessions/${sessionId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pin,
        studentId: selectedStudent,
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      toast.error(err.error || 'Failed to join')
      setLoading(false)
      return
    }

    const data = await res.json()
    setStudentStorageItem('student_token', data.token)
    setStudentStorageItem('session_id', data.sessionId)
    setStudentStorageItem('student_id', data.studentId)
    setStudentStorageItem('student_name', data.studentName)

    router.push('/student/lobby')
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Join Session</CardTitle>
          <CardDescription>
            {step === 'pin' ? 'Enter the session PIN from your tutor' : 'Select your name'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 'pin' ? (
            <form onSubmit={handlePinSubmit} className="space-y-4">
              <Input
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="text-center text-3xl tracking-widest font-mono"
                maxLength={6}
                inputMode="numeric"
              />
              <Button type="submit" className="w-full" disabled={pin.length !== 6 || loading}>
                {loading ? 'Finding session...' : 'Continue'}
              </Button>
            </form>
          ) : (
            <div className="space-y-3">
              {students.map((student) => (
                <button
                  key={student.id}
                  onClick={() => setSelectedStudent(student.id)}
                  className={`w-full rounded-lg border p-3 text-left text-sm font-medium transition-colors ${
                    selectedStudent === student.id
                      ? 'border-slate-900 bg-slate-50'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {student.name}
                </button>
              ))}
              <Button onClick={handleJoin} className="w-full" disabled={!selectedStudent || loading}>
                {loading ? 'Joining...' : 'Join Session'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
