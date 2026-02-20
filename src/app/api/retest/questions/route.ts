import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { verifyStudentRequest } from '@/lib/utils/verify-student'

export async function GET(request: Request) {
  const student = verifyStudentRequest(request)
  if (!student) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()

  // Get retest questions for this student
  const { data: retestQuestions } = await supabase
    .from('retest_questions')
    .select('question_id, question_order, source, questions(id, question_number, image_url, question_text, answer_a, answer_b, answer_c, answer_d, section, has_graphic)')
    .eq('session_id', student.sessionId)
    .eq('student_id', student.studentId)
    .order('question_order')

  if (!retestQuestions?.length) {
    return NextResponse.json({ questions: [], duration: 0 })
  }

  // Get existing retest answers
  const { data: answers } = await supabase
    .from('retest_answers')
    .select('question_id, selected_answer')
    .eq('session_id', student.sessionId)
    .eq('student_id', student.studentId)

  const answersMap = new Map(answers?.map((a) => [a.question_id, a.selected_answer]) || [])

  // Calculate duration
  let mathCount = 0
  let rwCount = 0
  const questions = retestQuestions.map((rq) => {
    const q = rq.questions as unknown as Record<string, unknown>
    if (q.section === 'math') mathCount++
    else rwCount++
    return {
      ...q,
      selectedAnswer: answersMap.get(rq.question_id) || null,
      retestOrder: rq.question_order,
      source: rq.source,
    }
  })

  const durationMinutes = Math.ceil(mathCount * 1.5 + rwCount * 1.25)

  return NextResponse.json({ questions, duration: durationMinutes })
}
