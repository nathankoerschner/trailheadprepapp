'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Users, ArrowRight, Clock, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import Markdown from 'react-markdown'
import { usePolling } from '@/lib/hooks/use-polling'
import { toast } from 'sonner'
import { AnswerGrid } from '@/components/session/answer-grid'
import { QuestionDetailDialog } from '@/components/session/question-detail-dialog'
import type { SessionStatus, GridQuestion, GridAnswer } from '@/lib/types/database'

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
  analyzing: 'AI Analysis',
  lesson: 'Lesson',
  retest: 'Retest',
  complete: 'Complete',
}

const nextPhaseAction: Partial<Record<SessionStatus, string>> = {
  lobby: 'Start Test',
  testing: 'End Test & Analyze',
  analyzing: 'Start Lesson',
  lesson: 'Start Retest',
  retest: 'Complete Session',
}

export default function SessionControlPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const [session, setSession] = useState<SessionData | null>(null)
  const [advancing, setAdvancing] = useState(false)
  const [selectedQuestion, setSelectedQuestion] = useState<GridQuestion | null>(null)

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
        {Object.entries(phaseLabels).map(([key, label]) => {
          const phases = Object.keys(phaseLabels)
          const currentIdx = phases.indexOf(session.status)
          const thisIdx = phases.indexOf(key)
          return (
            <div
              key={key}
              className={`flex-1 rounded-full py-1 text-center text-xs font-medium ${
                thisIdx < currentIdx
                  ? 'bg-green-100 text-green-700'
                  : thisIdx === currentIdx
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
            onQuestionClick={setSelectedQuestion}
          />
        </div>
      )}

      {/* Analyzing view */}
      {session.status === 'analyzing' && (
        <AnalysisProgress sessionId={session.id} />
      )}

      {/* Lesson view */}
      {session.status === 'lesson' && (
        <LessonGroupsView sessionId={session.id} />
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
        onOpenChange={(open) => { if (!open) setSelectedQuestion(null) }}
      />
    </div>
  )
}

function AnalysisProgress({ sessionId }: { sessionId: string }) {
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')

  const checkProgress = useCallback(async () => {
    const res = await fetch(`/api/sessions/${sessionId}/analysis`)
    if (res.ok) {
      const data = await res.json()
      setProgress(data.progress || 0)
      setStatus(data.status || '')
    }
  }, [sessionId])

  usePolling(checkProgress, 2000)

  return (
    <Card>
      <CardContent className="py-12 text-center">
        <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-slate-400" />
        <p className="text-lg font-medium">AI Analysis in Progress</p>
        <p className="mt-2 text-sm text-slate-500">{status || 'Starting analysis...'}</p>
        <div className="mx-auto mt-4 h-2 w-64 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full bg-slate-900 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-slate-400">{progress}%</p>
      </CardContent>
    </Card>
  )
}

interface LessonGroup {
  id: string
  group_type: string
  concept_focus: string
  lesson_group_students: Array<{ student_id: string; students: { name: string } }>
  lesson_plans: Array<{ tutor_guide: string | null; practice_problems: unknown[] }>
}

function LessonGroupsView({ sessionId }: { sessionId: string }) {
  const [groups, setGroups] = useState<LessonGroup[]>([])

  useEffect(() => {
    fetch(`/api/sessions/${sessionId}/groups`)
      .then((r) => r.json())
      .then(setGroups)
      .catch(console.error)
  }, [sessionId])

  if (!groups.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-slate-400" />
          <p className="text-slate-500">Loading lesson groups...</p>
        </CardContent>
      </Card>
    )
  }

  const groupLabels: Record<string, string> = {
    tutor_1: 'Tutor Group 1',
    tutor_2: 'Tutor Group 2',
    tutor_3: 'Tutor Group 3',
    independent: 'Independent',
  }

  return (
    <Tabs defaultValue={groups[0]?.id}>
      <TabsList className="mb-4 w-full">
        {groups.map((g) => (
          <TabsTrigger key={g.id} value={g.id} className="flex-1">
            {groupLabels[g.group_type] || g.group_type}
          </TabsTrigger>
        ))}
      </TabsList>

      {groups.map((group) => (
        <TabsContent key={group.id} value={group.id}>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  {groupLabels[group.group_type]} — {group.concept_focus}
                </CardTitle>
                <Badge variant="secondary">
                  {group.lesson_group_students.length} students
                </Badge>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {group.lesson_group_students.map((s) => (
                  <Badge key={s.student_id} variant="outline">
                    {s.students.name}
                  </Badge>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              {group.lesson_plans[0]?.tutor_guide ? (
                <div className="prose prose-sm max-w-none">
                  <Markdown>{group.lesson_plans[0].tutor_guide}</Markdown>
                </div>
              ) : group.group_type === 'independent' ? (
                <p className="text-sm text-slate-500">
                  Students are working through {group.lesson_plans[0]?.practice_problems?.length || 0} practice problems independently.
                </p>
              ) : (
                <p className="text-sm text-slate-500">No teaching guide generated.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      ))}
    </Tabs>
  )
}
