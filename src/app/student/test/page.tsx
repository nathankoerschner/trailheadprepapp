'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, ChevronLeft, ChevronRight, Send, Pause, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { QuestionDisplay } from '@/components/question/question-display'
import { AnnotationToolbar } from '@/components/question/annotation-toolbar'
import { useTimer } from '@/lib/hooks/use-timer'
import { useAnnotations, clearSessionAnnotations } from '@/lib/hooks/use-annotations'
import { studentFetch } from '@/lib/utils/student-api'
import { formatTime } from '@/lib/utils/timer'
import { toast } from 'sonner'
import { clearStudentStorage, getStudentStorageItem } from '@/lib/utils/student-storage'
import { MathReference } from '@/components/question/math-reference'
import type { AnswerChoice } from '@/lib/types/database'

function logStudentRedirect(reason: string, details: Record<string, unknown>) {
  // Lightweight client diagnostics to identify why a student was ejected.
  console.warn('[student:test] Redirecting to /student/join', { reason, ...details })
}


interface TestQuestion {
  id: string
  question_number: number
  image_url: string | null
  question_text: string | null
  answer_a: string | null
  answer_b: string | null
  answer_c: string | null
  answer_d: string | null
  section: string
  has_graphic: boolean
  graphic_url: string | null
  answers_are_visual: boolean
  selectedAnswer: AnswerChoice | null
}

export default function StudentTestPage() {
  const router = useRouter()
  const [questions, setQuestions] = useState<TestQuestion[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answers, setAnswers] = useState<Map<string, AnswerChoice>>(new Map())
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [testStartedAt, setTestStartedAt] = useState<string | null>(null)
  const [durationMinutes, setDurationMinutes] = useState(180)
  const [paused, setPaused] = useState(false)
  const [pausedAt, setPausedAt] = useState<string | null>(null)
  const [totalPausedMs, setTotalPausedMs] = useState(0)
  const [timerHidden, setTimerHidden] = useState(false)
  const status404CountRef = useRef(0)

  // Annotation state
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [eliminateMode, setEliminateMode] = useState(false)

  const question = questions[currentIdx]
  const { eliminated, toggleElimination } =
    useAnnotations(sessionId, question?.id ?? null)

  // Reset eliminate mode on question navigation
  useEffect(() => {
    setEliminateMode(false)
  }, [currentIdx])

  const handleStatus404 = useCallback(
    (sid: string) => {
      status404CountRef.current += 1
      if (status404CountRef.current >= 3) {
        logStudentRedirect('status-404-threshold', {
          sessionId: sid,
          misses: status404CountRef.current,
        })
        clearStudentStorage()
        router.push('/student/join')
      }
    },
    [router]
  )

  const loadTestData = useCallback(async () => {
    const sid = getStudentStorageItem('session_id')
    const token = getStudentStorageItem('student_token')
    if (!sid || !token) {
      logStudentRedirect('missing-session-auth', {
        hasSessionId: Boolean(sid),
        hasToken: Boolean(token),
        hasStudentName: Boolean(getStudentStorageItem('student_name')),
      })
      clearStudentStorage()
      router.push('/student/join')
      return
    }

    setSessionId(sid)

    try {
      // Get session info for timer
      const statusRes = await fetch(`/api/sessions/${sid}/status`, { cache: 'no-store' })
      if (!statusRes.ok) {
        if (statusRes.status === 404) {
          handleStatus404(sid)
          return
        }
        toast.error('Failed to verify session status')
        setLoading(false)
        return
      }

      const status = await statusRes.json()
      status404CountRef.current = 0
      setTestStartedAt(status.testStartedAt)
      setDurationMinutes(status.testDurationMinutes)
      setPaused(status.status === 'paused')
      setPausedAt(status.pausedAt || null)
      setTotalPausedMs(status.totalPausedMs || 0)

      if (status.status === 'lobby') {
        router.push('/student/lobby')
        return
      }

      if (status.status === 'analyzing' || status.status === 'lesson') {
        router.push('/student/waiting')
        return
      }

      if (status.status === 'retest') {
        router.push('/student/retest')
        return
      }

      if (status.status === 'complete') {
        clearStudentStorage()
        router.push('/student/join')
        return
      }

      if (status.status !== 'testing' && status.status !== 'paused') {
        toast.error('Unexpected session status')
        router.push('/student/lobby')
        return
      }

      // Get questions
      const res = await studentFetch('/api/test/questions', { cache: 'no-store' })
      if (!res.ok) {
        toast.error('Failed to load test')
        setLoading(false)
        return
      }

      const data: TestQuestion[] = await res.json()
      setQuestions(data)

      // Restore saved answers
      const savedAnswers = new Map<string, AnswerChoice>()
      data.forEach((q) => {
        if (q.selectedAnswer) {
          savedAnswers.set(q.id, q.selectedAnswer)
        }
      })
      setAnswers(savedAnswers)
      setLoading(false)
    } catch {
      toast.error('Failed to load test')
      setLoading(false)
    }
  }, [router, handleStatus404])

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadTestData()
    }, 0)
    return () => clearTimeout(timeout)
  }, [loadTestData])

  // Poll session status to detect pause/resume
  useEffect(() => {
    if (loading) return
    const sid = getStudentStorageItem('session_id')
    if (!sid) return

    const interval = setInterval(async () => {
      const res = await fetch(`/api/sessions/${sid}/status`, { cache: 'no-store' })
      if (!res.ok) {
        if (res.status === 404) {
          handleStatus404(sid)
        }
        return
      }

      status404CountRef.current = 0
      const data = await res.json()
      const isPaused = data.status === 'paused'
      setPaused(isPaused)
      setPausedAt(data.pausedAt || null)
      setTotalPausedMs(data.totalPausedMs || 0)

      if (data.status === 'lobby') {
        router.push('/student/lobby')
      } else if (data.status === 'retest') {
        router.push('/student/retest')
      } else if (data.status === 'complete') {
        clearStudentStorage()
        router.push('/student/join')
      } else if (data.status !== 'testing' && data.status !== 'paused') {
        router.push('/student/waiting')
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [loading, router, handleStatus404])

  const handleSubmit = useCallback(async () => {
    if (submitted) return
    setSubmitted(true)

    const res = await studentFetch('/api/answers/submit', { method: 'POST' })
    if (res.ok) {
      if (sessionId) clearSessionAnnotations(sessionId)
      toast.success('Test submitted!')
      router.push('/student/waiting')
    } else {
      toast.error('Failed to submit')
      setSubmitted(false)
    }
  }, [submitted, router, sessionId])

  const { remaining } = useTimer(testStartedAt, durationMinutes, handleSubmit, totalPausedMs, pausedAt)

  async function selectAnswer(questionId: string, answer: AnswerChoice) {
    if (paused) return
    setAnswers((prev) => new Map(prev).set(questionId, answer))

    // Auto-save
    await studentFetch('/api/answers', {
      method: 'POST',
      body: JSON.stringify({ questionId, selectedAnswer: answer }),
    })
  }

  if (loading) return <p className="text-center text-slate-500 py-12">Loading test...</p>
  if (questions.length === 0) return <p className="text-center text-slate-500 py-12">No questions found</p>

  const answeredCount = answers.size

  return (
    <div className="pb-20 relative">
      {/* Pause overlay */}
      {paused && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/95 backdrop-blur-sm">
          <div className="text-center">
            <Pause className="mx-auto h-16 w-16 text-slate-400" />
            <h2 className="mt-4 text-2xl font-bold text-slate-900">Test Paused</h2>
            <p className="mt-2 text-slate-500">Your tutor has paused the test. Please wait.</p>
          </div>
        </div>
      )}

      {/* Timer bar */}
      <div className="sticky top-0 z-10 -mx-4 border-b bg-white px-4 py-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">
            Question {currentIdx + 1} of {questions.length}
          </span>
          <button
            onClick={() => setTimerHidden(!timerHidden)}
            className={`flex items-center gap-1 font-mono text-lg font-bold ${
              remaining < 5 * 60 * 1000 ? 'text-red-600' : 'text-slate-900'
            }`}
          >
            {timerHidden ? (
              <>
                <EyeOff className="h-4 w-4" />
                <span className="text-sm text-slate-400">Show timer</span>
              </>
            ) : (
              <>
                <Clock className="h-4 w-4" />
                {formatTime(remaining)}
              </>
            )}
          </button>
          <span className="text-sm text-slate-500">
            {answeredCount}/{questions.length} answered
          </span>
        </div>
      </div>

      {/* Question navigation strip */}
      <div className="my-4 flex flex-wrap gap-1">
        {questions.map((q, i) => (
          <button
            key={q.id}
            onClick={() => setCurrentIdx(i)}
            className={`h-8 w-8 rounded text-xs font-medium transition-colors ${
              i === currentIdx
                ? 'bg-slate-900 text-white'
                : answers.has(q.id)
                ? 'bg-green-100 text-green-700'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {q.question_number}
          </button>
        ))}
      </div>

      {/* Annotation toolbar */}
      <div className="mb-3">
        <AnnotationToolbar
          eliminateMode={eliminateMode}
          onToggleEliminateMode={() => setEliminateMode((m) => !m)}
        />
      </div>

      {/* Question display */}
      <QuestionDisplay
        questionText={question.question_text}
        imageUrl={question.image_url}
        hasGraphic={question.has_graphic}
        questionNumber={question.question_number}
        answersAreVisual={question.answers_are_visual}
        answerA={question.answer_a}
        answerB={question.answer_b}
        answerC={question.answer_c}
        answerD={question.answer_d}
        selectedAnswer={answers.get(question.id) ?? null}
        onSelectAnswer={(answer) => selectAnswer(question.id, answer)}
        eliminatedAnswers={eliminated}
        eliminateMode={eliminateMode}
        onToggleElimination={toggleElimination}
      />

      {/* Navigation */}
      <div className="mt-4 flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))}
          disabled={currentIdx === 0}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>

        {currentIdx === questions.length - 1 ? (
          <Button onClick={handleSubmit} disabled={submitted}>
            <Send className="h-4 w-4" />
            {submitted ? 'Submitting...' : 'Submit Test'}
          </Button>
        ) : (
          <Button
            onClick={() => setCurrentIdx(Math.min(questions.length - 1, currentIdx + 1))}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
      <MathReference />
    </div>
  )
}
