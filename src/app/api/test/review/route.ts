import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { verifyStudentRequest } from '@/lib/utils/verify-student'

// Student endpoint: get questions with answers + correct answers (only after submission)
export async function GET(request: Request) {
  const student = verifyStudentRequest(request)
  if (!student) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()

  // Only allow review after the retest phase
  const { data: session } = await supabase
    .from('sessions')
    .select('test_id, status')
    .eq('id', student.sessionId)
    .single()

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  if (!['retest', 'complete'].includes(session.status)) {
    return NextResponse.json({ error: 'Review not available yet' }, { status: 400 })
  }

  // Get questions WITH correct_answer
  const { data: questions } = await supabase
    .from('questions')
    .select('id, question_number, image_url, question_text, answer_a, answer_b, answer_c, answer_d, correct_answer, section, has_graphic, graphic_url, answers_are_visual')
    .eq('test_id', session.test_id)
    .order('question_number')

  // Get student's answers
  const { data: answers } = await supabase
    .from('student_answers')
    .select('question_id, selected_answer, is_correct')
    .eq('session_id', student.sessionId)
    .eq('student_id', student.studentId)

  const answersMap = new Map(
    answers?.map((a) => [a.question_id, { selectedAnswer: a.selected_answer, isCorrect: a.is_correct }]) || []
  )

  const reviewData = questions?.map((q) => {
    const answer = answersMap.get(q.id)
    return {
      ...q,
      selectedAnswer: answer?.selectedAnswer ?? null,
      isCorrect: answer?.isCorrect ?? null,
    }
  }) || []

  return NextResponse.json(reviewData)
}
