import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { verifyStudentRequest } from '@/lib/utils/verify-student'

// Student endpoint: get questions for current session's test
export async function GET(request: Request) {
  const student = verifyStudentRequest(request)
  if (!student) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()

  const { data: session } = await supabase
    .from('sessions')
    .select('test_id, status')
    .eq('id', student.sessionId)
    .single()

  if (!session || !['testing', 'retest'].includes(session.status)) {
    return NextResponse.json({ error: 'Test not active' }, { status: 400 })
  }

  const { data: questions } = await supabase
    .from('questions')
    .select('id, question_number, image_url, question_text, answer_a, answer_b, answer_c, answer_d, section, has_graphic, graphic_url, answers_are_visual')
    .eq('test_id', session.test_id)
    .order('question_number')

  // Get existing answers
  const { data: answers } = await supabase
    .from('student_answers')
    .select('question_id, selected_answer')
    .eq('session_id', student.sessionId)
    .eq('student_id', student.studentId)

  const answersMap = new Map(answers?.map((a) => [a.question_id, a.selected_answer]) || [])

  const questionsWithAnswers = questions?.map((q) => ({
    ...q,
    selectedAnswer: answersMap.get(q.id) || null,
  })) || []

  return NextResponse.json(questionsWithAnswers)
}
