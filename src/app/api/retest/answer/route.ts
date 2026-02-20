import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { verifyStudentRequest } from '@/lib/utils/verify-student'
import { answerSchema } from '@/lib/schemas/session'

export async function POST(request: Request) {
  const student = verifyStudentRequest(request)
  if (!student) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = answerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Get correct answer
  const { data: question } = await supabase
    .from('questions')
    .select('correct_answer')
    .eq('id', parsed.data.questionId)
    .single()

  const isCorrect = question ? parsed.data.selectedAnswer === question.correct_answer : null

  const { error } = await supabase
    .from('retest_answers')
    .upsert(
      {
        session_id: student.sessionId,
        student_id: student.studentId,
        question_id: parsed.data.questionId,
        selected_answer: parsed.data.selectedAnswer,
        is_correct: isCorrect,
        answered_at: new Date().toISOString(),
      },
      { onConflict: 'session_id,student_id,question_id' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
