import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { verifyStudentRequest } from '@/lib/utils/verify-student'
import { answerSchema } from '@/lib/schemas/session'

// Upsert a single answer
export async function POST(request: Request) {
  const student = verifyStudentRequest(request)
  if (!student) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = answerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Verify session is in testing phase
  const { data: session } = await supabase
    .from('sessions')
    .select('status')
    .eq('id', student.sessionId)
    .single()

  if (!session || (session.status !== 'testing' && session.status !== 'paused')) {
    return NextResponse.json({ error: 'Test not active' }, { status: 400 })
  }

  // Get correct answer for grading
  const { data: question } = await supabase
    .from('questions')
    .select('correct_answer')
    .eq('id', parsed.data.questionId)
    .single()

  const isCorrect = question ? parsed.data.selectedAnswer === question.correct_answer : null

  // Upsert answer
  const { error } = await supabase
    .from('student_answers')
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
