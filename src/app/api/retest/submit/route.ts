import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { verifyStudentRequest } from '@/lib/utils/verify-student'

export async function POST(request: Request) {
  const student = verifyStudentRequest(request)
  if (!student) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()

  // Get all retest question IDs for this student
  const { data: retestQuestions } = await supabase
    .from('retest_questions')
    .select('question_id')
    .eq('session_id', student.sessionId)
    .eq('student_id', student.studentId)

  // Get already-answered retest question IDs
  const { data: existingAnswers } = await supabase
    .from('retest_answers')
    .select('question_id')
    .eq('session_id', student.sessionId)
    .eq('student_id', student.studentId)

  const answeredIds = new Set(existingAnswers?.map((a) => a.question_id) || [])

  // Insert unanswered retest questions as incorrect
  const unansweredRows = (retestQuestions || [])
    .filter((q) => !answeredIds.has(q.question_id))
    .map((q) => ({
      session_id: student.sessionId,
      student_id: student.studentId,
      question_id: q.question_id,
      selected_answer: null,
      is_correct: false,
      answered_at: new Date().toISOString(),
    }))

  if (unansweredRows.length > 0) {
    await supabase.from('retest_answers').insert(unansweredRows)
  }

  return NextResponse.json({ success: true })
}
