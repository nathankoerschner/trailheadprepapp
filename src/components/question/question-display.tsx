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
  // Annotation props (all optional — retest page unaffected)
  eliminatedAnswers?: Set<AnswerChoice>
  eliminateMode?: boolean
  onToggleElimination?: (answer: AnswerChoice) => void
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
  eliminatedAnswers,
  eliminateMode,
  onToggleElimination,
}: QuestionDisplayProps) {
  const answers = { A: answerA, B: answerB, C: answerC, D: answerD } as const

  function handleAnswerClick(letter: AnswerChoice) {
    if (eliminateMode && onToggleElimination) {
      onToggleElimination(letter)
    } else {
      onSelectAnswer?.(letter)
    }
  }

  return (
    <Card>
      <CardContent className="p-4">
        {/* Show image above question text for questions with graphics */}
        {hasGraphic && imageUrl && (
          <div className="mb-4">
            <img
              src={imageUrl}
              alt={`Figure for question ${questionNumber}`}
              className="max-w-full rounded border border-slate-200"
            />
          </div>
        )}

        {/* Question text */}
        {questionText && (
          <p className="mb-4 text-base leading-relaxed">
            <MathText text={questionText} />
          </p>
        )}

        {/* Answer choices */}
        {answersAreVisual ? (
          <div className="flex gap-2">
            {(['A', 'B', 'C', 'D'] as const).map((letter) => {
              const isSelected = selectedAnswer === letter
              const isEliminated = eliminatedAnswers?.has(letter)
              return (
                <button
                  key={letter}
                  onClick={() => handleAnswerClick(letter)}
                  disabled={!onSelectAnswer && !eliminateMode}
                  className={`relative flex h-12 w-12 items-center justify-center rounded-lg border text-lg font-bold transition-colors ${
                    isEliminated
                      ? isSelected
                        ? 'border-slate-900 bg-slate-200 text-slate-400'
                        : 'border-slate-200 bg-white text-slate-300'
                      : isSelected
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <span className={isEliminated ? 'line-through decoration-2' : ''}>{letter}</span>
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
              const isEliminated = eliminatedAnswers?.has(letter)

              return (
                <button
                  key={letter}
                  onClick={() => handleAnswerClick(letter)}
                  disabled={!onSelectAnswer && !eliminateMode}
                  className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                    isEliminated
                      ? isSelected
                        ? 'border-slate-900 bg-slate-50/50 opacity-50'
                        : 'border-slate-200 opacity-50'
                      : isSelected
                        ? 'border-slate-900 bg-slate-50 font-medium'
                        : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    isEliminated
                      ? 'bg-slate-100 text-slate-400 line-through decoration-2'
                      : isSelected ? 'bg-slate-900 text-white' : 'bg-slate-100'
                  }`}>
                    {letter}
                  </span>
                  <span className={`text-sm ${isEliminated ? 'line-through text-slate-400 decoration-2' : ''}`}>
                    <MathText text={text} />
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
