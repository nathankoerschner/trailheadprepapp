'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X, ChevronRight, Loader2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MathText } from '@/components/math/katex-renderer'
import { studentFetch } from '@/lib/utils/student-api'
import { usePolling } from '@/lib/hooks/use-polling'
import type { AnswerChoice, PracticeProblem } from '@/lib/types/database'

interface PracticeData {
  group: { type: string; concept: string } | null
  problems: PracticeProblem[]
  withTutor: boolean
}

export default function StudentPracticePage() {
  const router = useRouter()
  const [data, setData] = useState<PracticeData | null>(null)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<AnswerChoice | null>(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPractice()
  }, [])

  async function loadPractice() {
    const res = await studentFetch('/api/practice/questions')
    if (res.ok) {
      const practice = await res.json()
      setData(practice)
    }
    setLoading(false)
  }

  // Poll for phase changes
  const checkStatus = useCallback(async () => {
    const sessionId = localStorage.getItem('session_id')
    if (!sessionId) return
    const res = await fetch(`/api/sessions/${sessionId}/status`)
    if (!res.ok) return
    const status = await res.json()
    if (status.status === 'retest') router.push('/student/retest')
    if (status.status === 'complete') router.push('/student/report')
  }, [router])

  usePolling(checkStatus, 3000)

  function handleAnswer(answer: AnswerChoice) {
    setSelectedAnswer(answer)
    setShowFeedback(true)
  }

  function nextQuestion() {
    setSelectedAnswer(null)
    setShowFeedback(false)
    setCurrentIdx((i) => i + 1)
  }

  if (loading) return <p className="text-center text-slate-500 py-12">Loading...</p>

  // Working with tutor screen
  if (data?.withTutor) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="w-full max-w-sm">
          <CardContent className="py-12 text-center">
            <Users className="mx-auto mb-4 h-12 w-12 text-slate-400" />
            <h2 className="text-lg font-semibold">Working with Tutor</h2>
            <p className="mt-2 text-sm text-slate-500">
              Focus: <span className="font-medium">{data.group?.concept}</span>
            </p>
            <p className="mt-4 text-sm text-slate-400">
              Follow along with your tutor. The next phase will begin when they are ready.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!data?.problems?.length) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="w-full max-w-sm">
          <CardContent className="py-12 text-center">
            <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-slate-400" />
            <p className="text-slate-500">Loading practice problems...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // All done
  if (currentIdx >= data.problems.length) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="w-full max-w-sm">
          <CardContent className="py-12 text-center">
            <Check className="mx-auto mb-4 h-12 w-12 text-green-500" />
            <h2 className="text-lg font-semibold">Practice Complete!</h2>
            <p className="mt-2 text-sm text-slate-500">
              Great work. Wait for your tutor to start the retest.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const problem = data.problems[currentIdx]
  const isCorrect = selectedAnswer === problem.correct_answer

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Badge variant="secondary">
          {data.group?.concept || 'Practice'}
        </Badge>
        <span className="text-sm text-slate-500">
          {currentIdx + 1} of {data.problems.length}
        </span>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          {/* Question */}
          <div className="text-base">
            <MathText text={problem.question_text} />
          </div>

          {/* Answers */}
          <div className="space-y-2">
            {(['A', 'B', 'C', 'D'] as const).map((letter) => {
              const key = `answer_${letter.toLowerCase()}` as keyof PracticeProblem
              const text = problem[key] as string
              if (!text) return null

              const isSelected = selectedAnswer === letter
              const isCorrectChoice = letter === problem.correct_answer

              let style = 'border-slate-200 hover:bg-slate-50'
              if (showFeedback) {
                if (isCorrectChoice) style = 'border-green-500 bg-green-50'
                else if (isSelected && !isCorrectChoice) style = 'border-red-500 bg-red-50'
              } else if (isSelected) {
                style = 'border-slate-900 bg-slate-50'
              }

              return (
                <button
                  key={letter}
                  onClick={() => !showFeedback && handleAnswer(letter)}
                  disabled={showFeedback}
                  className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${style}`}
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    showFeedback && isCorrectChoice
                      ? 'bg-green-500 text-white'
                      : showFeedback && isSelected && !isCorrectChoice
                      ? 'bg-red-500 text-white'
                      : isSelected
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100'
                  }`}>
                    {letter}
                  </span>
                  <span className="text-sm"><MathText text={text} /></span>
                </button>
              )
            })}
          </div>

          {/* Feedback */}
          {showFeedback && (
            <div className={`rounded-lg p-4 ${isCorrect ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className="flex items-center gap-2 mb-2">
                {isCorrect ? (
                  <Check className="h-5 w-5 text-green-600" />
                ) : (
                  <X className="h-5 w-5 text-red-600" />
                )}
                <span className={`font-medium ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                  {isCorrect ? 'Correct!' : 'Not quite'}
                </span>
              </div>
              {problem.explanation && (
                <p className="text-sm text-slate-600">
                  <MathText text={problem.explanation} />
                </p>
              )}
              <Button onClick={nextQuestion} className="mt-3" size="sm">
                {currentIdx < data.problems.length - 1 ? (
                  <>Next <ChevronRight className="h-4 w-4" /></>
                ) : (
                  'Finish'
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
