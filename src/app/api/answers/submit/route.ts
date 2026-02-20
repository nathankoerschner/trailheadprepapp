import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { verifyStudentRequest } from '@/lib/utils/verify-student'

export async function POST(request: Request) {
  const student = verifyStudentRequest(request)
  if (!student) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()

  // Get all question IDs for this session's test
  const { data: session } = await supabase
    .from('sessions')
    .select('test_id')
    .eq('id', student.sessionId)
    .single()

  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  const { data: questions } = await supabase
    .from('questions')
    .select('id')
    .eq('test_id', session.test_id)

  // Get already-answered question IDs
  const { data: existingAnswers } = await supabase
    .from('student_answers')
    .select('question_id')
    .eq('session_id', student.sessionId)
    .eq('student_id', student.studentId)

  const answeredIds = new Set(existingAnswers?.map((a) => a.question_id) || [])

  // Insert unanswered questions as incorrect
  const unansweredRows = (questions || [])
    .filter((q) => !answeredIds.has(q.id))
    .map((q) => ({
      session_id: student.sessionId,
      student_id: student.studentId,
      question_id: q.id,
      selected_answer: null,
      is_correct: false,
      answered_at: new Date().toISOString(),
    }))

  if (unansweredRows.length > 0) {
    await supabase.from('student_answers').insert(unansweredRows)
  }

  // Mark as submitted
  const { error } = await supabase
    .from('session_students')
    .update({
      test_submitted: true,
      test_submitted_at: new Date().toISOString(),
    })
    .eq('session_id', student.sessionId)
    .eq('student_id', student.studentId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
