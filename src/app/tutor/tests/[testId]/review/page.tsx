'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Save, AlertTriangle, Crop, RotateCcw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MathText } from '@/components/math/katex-renderer'
import { QuestionDisplay } from '@/components/question/question-display'
import { ImageCropper } from '@/components/question/image-cropper'
import { toast } from 'sonner'
import type { Question, AnswerChoice, QuestionSection } from '@/lib/types/database'

export default function ReviewCarousel() {
  const { testId } = useParams<{ testId: string }>()
  const router = useRouter()
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [editing, setEditing] = useState<Partial<Question>>({})
  const [loading, setLoading] = useState(true)
  const [cropOpen, setCropOpen] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    loadQuestions()
  }, [testId])

  async function loadQuestions() {
    const { data } = await supabase
      .from('questions')
      .select('*')
      .eq('test_id', testId)
      .order('question_number')
    setQuestions(data || [])
    if (data?.length) setEditing(data[0])
    setLoading(false)
  }

  useEffect(() => {
    if (questions[currentIdx]) {
      setEditing(questions[currentIdx])
    }
  }, [currentIdx, questions])

  async function saveQuestion() {
    if (!editing.id) return

    const res = await fetch(`/api/tests/${testId}/questions/${editing.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questionText: editing.question_text,
        answerA: editing.answer_a,
        answerB: editing.answer_b,
        answerC: editing.answer_c,
        answerD: editing.answer_d,
        correctAnswer: editing.correct_answer,
        section: editing.section,
        conceptTag: editing.concept_tag,
      }),
    })

    if (res.ok) {
      toast.success('Question saved')
      // Update local state
      setQuestions((prev) =>
        prev.map((q) => (q.id === editing.id ? { ...q, ...editing } as Question : q))
      )
    } else {
      toast.error('Failed to save')
    }
  }

  const question = questions[currentIdx] as Question | undefined

  async function handleCropComplete(blob: Blob) {
    if (!question) return
    const form = new FormData()
    form.append('file', blob, 'crop.png')

    const res = await fetch(`/api/tests/${testId}/questions/${question.id}/crop`, {
      method: 'POST',
      body: form,
    })

    if (res.ok) {
      const data = await res.json()
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === question.id
            ? { ...q, image_url: data.image_url, original_image_url: data.original_image_url }
            : q
        )
      )
      toast.success('Image cropped')
    } else {
      toast.error('Failed to crop image')
    }
  }

  async function resetToOriginal() {
    if (!question) return
    const res = await fetch(`/api/tests/${testId}/questions/${question.id}/crop`, {
      method: 'DELETE',
    })

    if (res.ok) {
      const data = await res.json()
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === question.id
            ? { ...q, image_url: data.image_url, original_image_url: null }
            : q
        )
      )
      toast.success('Restored original image')
    } else {
      toast.error('Failed to restore image')
    }
  }

  if (loading) return <p className="text-slate-500">Loading questions...</p>
  if (!question) return <p className="text-slate-500">No questions found</p>
  const isLowConfidence = (question.ai_confidence || 0) < 0.7

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" onClick={() => router.push('/tutor/tests')}>
          Back to Tests
        </Button>
        <span className="text-sm text-slate-500">
          Question {currentIdx + 1} of {questions.length}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Original Image */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Original Image
                {question.original_image_url && (
                  <Badge variant="secondary" className="ml-2 text-xs font-normal">
                    Cropped
                  </Badge>
                )}
              </CardTitle>
              {question.image_url && (
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCropOpen(true)}
                  >
                    <Crop className="mr-1 h-4 w-4" />
                    Crop
                  </Button>
                  {question.original_image_url && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={resetToOriginal}
                    >
                      <RotateCcw className="mr-1 h-4 w-4" />
                      Reset
                    </Button>
                  )}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {question.image_url ? (
              <img
                src={question.image_url}
                alt={`Question ${question.question_number}`}
                className="w-full rounded border"
              />
            ) : (
              <p className="text-slate-400">No image available</p>
            )}
          </CardContent>
        </Card>

        {/* Extracted Data */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Extracted Data
                {isLowConfidence && (
                  <Badge variant="warning" className="ml-2">
                    <AlertTriangle className="mr-1 h-3 w-3" />
                    Low confidence
                  </Badge>
                )}
              </CardTitle>
              <Badge variant="secondary">
                {Math.round((question.ai_confidence || 0) * 100)}% confidence
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Question Text</Label>
              <textarea
                className="w-full rounded-lg border border-slate-300 p-2 text-sm"
                rows={4}
                value={editing.question_text || ''}
                onChange={(e) => setEditing({ ...editing, question_text: e.target.value })}
              />
              {editing.question_text && (
                <div className="rounded bg-slate-50 p-2 text-sm">
                  <MathText text={editing.question_text} />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              {(['A', 'B', 'C', 'D'] as const).map((letter) => {
                const key = `answer_${letter.toLowerCase()}` as keyof Question
                return (
                  <div key={letter} className="space-y-1">
                    <Label className="text-xs">{letter}</Label>
                    <Input
                      value={(editing[key] as string) || ''}
                      onChange={(e) => setEditing({ ...editing, [key]: e.target.value })}
                      className="text-sm"
                    />
                  </div>
                )
              })}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Correct Answer</Label>
                <Select
                  value={editing.correct_answer || ''}
                  onValueChange={(v) => setEditing({ ...editing, correct_answer: v as AnswerChoice })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['A', 'B', 'C', 'D'].map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Section</Label>
                <Select
                  value={editing.section || ''}
                  onValueChange={(v) => setEditing({ ...editing, section: v as QuestionSection })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reading_writing">R/W</SelectItem>
                    <SelectItem value="math">Math</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Concept</Label>
                <Input
                  value={editing.concept_tag || ''}
                  onChange={(e) => setEditing({ ...editing, concept_tag: e.target.value })}
                  className="text-sm"
                />
              </div>
            </div>

            <Button onClick={saveQuestion} className="w-full">
              <Save className="h-4 w-4" />
              Save Changes
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Question Preview */}
      <div className="mt-6">
        <div className="mb-2">
          <h3 className="text-base font-semibold">Question Preview</h3>
          <p className="text-xs text-slate-500">How students will see this question</p>
        </div>
        <div className="mx-auto max-w-2xl">
          <QuestionDisplay
            questionText={editing.question_text ?? null}
            imageUrl={question.image_url}
            hasGraphic={question.has_graphic}
            questionNumber={question.question_number}
            answersAreVisual={question.answers_are_visual}
            answerA={(editing.answer_a as string) ?? null}
            answerB={(editing.answer_b as string) ?? null}
            answerC={(editing.answer_c as string) ?? null}
            answerD={(editing.answer_d as string) ?? null}
          />
        </div>
      </div>

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))}
          disabled={currentIdx === 0}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>

        {/* Question pills */}
        <div className="flex flex-wrap justify-center gap-1">
          {questions.map((q, i) => (
            <button
              key={q.id}
              onClick={() => setCurrentIdx(i)}
              className={`h-8 w-8 rounded-full text-xs font-medium transition-colors ${
                i === currentIdx
                  ? 'bg-slate-900 text-white'
                  : (q.ai_confidence || 0) < 0.7
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {q.question_number}
            </button>
          ))}
        </div>

        <Button
          variant="outline"
          onClick={() => setCurrentIdx(Math.min(questions.length - 1, currentIdx + 1))}
          disabled={currentIdx === questions.length - 1}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Crop dialog */}
      {question.image_url && (
        <ImageCropper
          open={cropOpen}
          onOpenChange={setCropOpen}
          imageUrl={question.original_image_url || question.image_url}
          onCropComplete={handleCropComplete}
        />
      )}
    </div>
  )
}
