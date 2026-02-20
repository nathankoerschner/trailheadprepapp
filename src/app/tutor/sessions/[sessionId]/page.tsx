'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Users, ArrowRight, Clock, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { usePolling } from '@/lib/hooks/use-polling'
import { toast } from 'sonner'
import { AnswerGrid } from '@/components/session/answer-grid'
import { QuestionDetailDialog } from '@/components/session/question-detail-dialog'
import type { SessionStatus, GridQuestion, GridAnswer, CounterpartQuestion } from '@/lib/types/database'

interface SessionData {
  id: string
  pin_code: string
  status: SessionStatus
  tutor_count: number
  test_duration_minutes: number
  test_started_at: string | null
  tests: { name: string; total_questions: number }
  session_students: Array<{
    student_id: string
    test_submitted: boolean
    students: { name: string }
  }>
  questions?: GridQuestion[]
  student_answers?: GridAnswer[]
}

const phaseLabels: Record<SessionStatus, string> = {
  lobby: 'Lobby',
  testing: 'Practice Test',
  analyzing: 'Transition',
  lesson: 'Transition',
  retest: 'Retest',
  complete: 'Complete',
}

const stepperPhases: Array<{ key: SessionStatus; label: string }> = [
  { key: 'lobby', label: 'Lobby' },
  { key: 'testing', label: 'Practice Test' },
  { key: 'retest', label: 'Retest' },
]

const nextPhaseAction: Partial<Record<SessionStatus, string>> = {
  lobby: 'Start Test',
  testing: 'Start Retest',
  analyzing: 'Start Retest',
  lesson: 'Start Retest',
  retest: 'Complete Session',
}

export default function SessionControlPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const [session, setSession] = useState<SessionData | null>(null)
  const [advancing, setAdvancing] = useState(false)
  const [selectedQuestion, setSelectedQuestion] = useState<GridQuestion | null>(null)
  const [counterpartData, setCounterpartData] = useState<CounterpartQuestion | null>(null)
  const [counterpartLoadingId, setCounterpartLoadingId] = useState<string | null>(null)

  const loadSession = useCallback(async () => {
    const res = await fetch(`/api/sessions/${sessionId}`)
    if (res.ok) {
      const data = await res.json()
      setSession(data)
    }
  }, [sessionId])

  useEffect(() => { loadSession() }, [loadSession])
  usePolling(loadSession, 3000)

  async function advancePhase() {
    setAdvancing(true)
    const res = await fetch(`/api/sessions/${sessionId}/advance`, { method: 'POST' })
    if (res.ok) {
      const data = await res.json()
      toast.success(`Advanced to ${phaseLabels[data.status as SessionStatus]}`)
      loadSession()
    } else {
      toast.error('Failed to advance')
    }
    setAdvancing(false)
  }

  async function handleCounterpartClick(question: GridQuestion) {
    setCounterpartLoadingId(question.id)
    try {
      const res = await fetch(`/api/questions/${question.id}/counterpart`)
      if (res.ok) {
        const data = await res.json()
        setCounterpartData(data.counterpart)
        setSelectedQuestion(question)
      } else {
        toast.error('Failed to generate counterpart')
      }
    } catch {
      toast.error('Failed to generate counterpart')
    }
    setCounterpartLoadingId(null)
  }

  if (!session) return <p className="text-slate-500">Loading session...</p>

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{session.tests.name}</h1>
          <div className="mt-1 flex items-center gap-3 text-sm text-slate-500">
            <span>PIN: <span className="font-mono text-lg font-bold text-slate-900">{session.pin_code}</span></span>
            <Badge>{phaseLabels[session.status]}</Badge>
          </div>
        </div>
        {nextPhaseAction[session.status] && (
          <Button onClick={advancePhase} disabled={advancing} size="lg">
            {advancing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
            {nextPhaseAction[session.status]}
          </Button>
        )}
      </div>

      {/* Phase indicator */}
      <div className="mb-6 flex gap-1">
        {stepperPhases.map(({ key, label }) => {
          const stepperKeys = stepperPhases.map((p) => p.key)
          // Map analyzing/lesson to retest for stepper positioning
          const effectiveStatus =
            session.status === 'analyzing' || session.status === 'lesson'
              ? 'retest'
              : session.status === 'complete'
              ? 'complete'
              : session.status
          const currentIdx = stepperKeys.indexOf(effectiveStatus as SessionStatus)
          const thisIdx = stepperKeys.indexOf(key)
          const isPast = currentIdx === -1 ? true : thisIdx < currentIdx
          const isCurrent = thisIdx === currentIdx
          return (
            <div
              key={key}
              className={`flex-1 rounded-full py-1 text-center text-xs font-medium ${
                isPast
                  ? 'bg-green-100 text-green-700'
                  : isCurrent
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              {label}
            </div>
          )
        })}
      </div>

      {/* Lobby view */}
      {session.status === 'lobby' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4" />
                Students ({session.session_students.length})
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {session.session_students.length === 0 ? (
              <p className="text-center text-slate-500 py-8">
                Waiting for students to join with PIN <span className="font-mono font-bold">{session.pin_code}</span>
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {session.session_students.map((ss) => (
                  <div key={ss.student_id} className="rounded-lg bg-green-50 p-3 text-center">
                    <span className="text-sm font-medium text-green-700">
                      {ss.students.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Answer grid for all post-lobby statuses */}
      {session.status !== 'lobby' && session.questions && session.questions.length > 0 && (
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Clock className="h-4 w-4" />
              Answer Grid
            </h2>
            <span className="text-xs text-slate-500">
              {session.session_students.filter((s) => s.test_submitted).length}/{session.session_students.length} submitted
            </span>
          </div>
          <AnswerGrid
            questions={session.questions}
            students={session.session_students}
            studentAnswers={session.student_answers || []}
            onQuestionClick={(q) => { setCounterpartData(null); setSelectedQuestion(q) }}
            onCounterpartClick={handleCounterpartClick}
            counterpartLoadingId={counterpartLoadingId}
          />
        </div>
      )}

      {/* Transition view */}
      {(session.status === 'lesson' || session.status === 'analyzing') && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-lg font-medium">Ready to start retest</p>
            <p className="mt-2 text-sm text-slate-500">Use the button above to begin the retest phase.</p>
          </CardContent>
        </Card>
      )}

      {/* Retest view placeholder */}
      {session.status === 'retest' && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-lg font-medium">Retest in progress</p>
            <p className="mt-2 text-sm text-slate-500">Students are taking their personalized retest</p>
          </CardContent>
        </Card>
      )}

      {/* Complete */}
      {session.status === 'complete' && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-lg font-medium text-green-700">Session Complete</p>
            <p className="mt-2 text-sm text-slate-500">All students have finished</p>
          </CardContent>
        </Card>
      )}

      {/* Question detail popup */}
      <QuestionDetailDialog
        question={selectedQuestion}
        counterpart={counterpartData}
        onOpenChange={(open) => { if (!open) { setSelectedQuestion(null); setCounterpartData(null) } }}
        onQuestionUpdate={(questionId, updates) => {
          setSelectedQuestion((prev) => prev ? { ...prev, ...updates } : prev)
          setSession((prev) => {
            if (!prev) return prev
            return {
              ...prev,
              questions: prev.questions?.map((q) =>
                q.id === questionId ? { ...q, ...updates } : q
              ),
            }
          })
        }}
      />
    </div>
  )
}
