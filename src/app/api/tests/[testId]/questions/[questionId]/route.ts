import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { updateQuestionSchema } from '@/lib/schemas/test'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ testId: string; questionId: string }> }
) {
  const { testId, questionId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = updateQuestionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  const data = parsed.data
  if (data.questionText !== undefined) updates.question_text = data.questionText
  if (data.answerA !== undefined) updates.answer_a = data.answerA
  if (data.answerB !== undefined) updates.answer_b = data.answerB
  if (data.answerC !== undefined) updates.answer_c = data.answerC
  if (data.answerD !== undefined) updates.answer_d = data.answerD
  if (data.correctAnswer !== undefined) updates.correct_answer = data.correctAnswer
  if (data.section !== undefined) updates.section = data.section
  if (data.conceptTag !== undefined) updates.concept_tag = data.conceptTag

  const { error } = await supabase
    .from('questions')
    .update(updates)
    .eq('id', questionId)
    .eq('test_id', testId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ testId: string; questionId: string }> }
) {
  const { testId, questionId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('questions')
    .delete()
    .eq('id', questionId)
    .eq('test_id', testId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
