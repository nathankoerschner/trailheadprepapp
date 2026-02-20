'use client'

import { Card, CardContent } from '@/components/ui/card'
import { MathText } from '@/components/math/katex-renderer'
import type { AnswerChoice } from '@/lib/types/database'

interface QuestionDisplayProps {
  questionText: string | null
  imageUrl: string | null
  hasGraphic: boolean
  questionNumber: number
  answersAreVisual: boolean
  answerA: string | null
  answerB: string | null
  answerC: string | null
  answerD: string | null
  selectedAnswer?: AnswerChoice | null
  onSelectAnswer?: (answer: AnswerChoice) => void
}

export function QuestionDisplay({
  questionText,
  imageUrl,
  hasGraphic,
  questionNumber,
  answersAreVisual,
  answerA,
  answerB,
  answerC,
  answerD,
  selectedAnswer,
  onSelectAnswer,
}: QuestionDisplayProps) {
  const answers = { A: answerA, B: answerB, C: answerC, D: answerD } as const

  return (
    <Card>
      <CardContent className="p-4">
        {/* Question text */}
        {questionText && (
          <p className="mb-4 text-base leading-relaxed">
            <MathText text={questionText} />
          </p>
        )}

        {/* Show image only for questions with graphics (charts, graphs, diagrams) */}
        {hasGraphic && imageUrl && (
          <div className="mb-4">
            <img
              src={imageUrl}
              alt={`Figure for question ${questionNumber}`}
              className="max-w-full rounded border border-slate-200"
            />
          </div>
        )}

        {/* Answer choices */}
        {answersAreVisual ? (
          <div className="flex gap-2">
            {(['A', 'B', 'C', 'D'] as const).map((letter) => {
              const isSelected = selectedAnswer === letter
              return (
                <button
                  key={letter}
                  onClick={() => onSelectAnswer?.(letter)}
                  disabled={!onSelectAnswer}
                  className={`flex h-12 w-12 items-center justify-center rounded-lg border text-lg font-bold transition-colors ${
                    isSelected
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  {letter}
                </button>
              )
            })}
          </div>
        ) : (
          <div className="space-y-2">
            {(['A', 'B', 'C', 'D'] as const).map((letter) => {
              const text = answers[letter]
              if (!text) return null

              const isSelected = selectedAnswer === letter

              return (
                <button
                  key={letter}
                  onClick={() => onSelectAnswer?.(letter)}
                  disabled={!onSelectAnswer}
                  className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                    isSelected
                      ? 'border-slate-900 bg-slate-50 font-medium'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    isSelected ? 'bg-slate-900 text-white' : 'bg-slate-100'
                  }`}>
                    {letter}
                  </span>
                  <span className="text-sm"><MathText text={text} /></span>
                </button>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
