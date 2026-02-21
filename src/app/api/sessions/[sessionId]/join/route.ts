import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { studentJoinSchema } from '@/lib/schemas/auth'
import { createStudentToken } from '@/lib/utils/student-token'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
  const supabase = createAdminClient()

  const body = await request.json()
  const parsed = studentJoinSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  // Verify session exists and is in lobby
  const { data: session } = await supabase
    .from('sessions')
    .select('id, pin_code, status')
    .eq('id', sessionId)
    .single()

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  if (session.pin_code !== parsed.data.pin) {
    return NextResponse.json({ error: 'Invalid PIN' }, { status: 403 })
  }

  if (session.status !== 'lobby' && session.status !== 'testing') {
    return NextResponse.json({ error: 'Session is not accepting students' }, { status: 400 })
  }

  // Verify student exists
  const { data: student } = await supabase
    .from('students')
    .select('id, name')
    .eq('id', parsed.data.studentId)
    .single()

  if (!student) {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 })
  }

  // Check if already joined
  const { data: existing } = await supabase
    .from('session_students')
    .select('id')
    .eq('session_id', sessionId)
    .eq('student_id', student.id)
    .maybeSingle()

  if (existing) {
    // Already joined — only allow if same student is re-joining (idempotent)
    const token = createStudentToken(student.id, sessionId)
    return NextResponse.json({
      token,
      studentId: student.id,
      studentName: student.name,
      sessionId,
      sessionStatus: session.status,
    })
  }

  const { error: insertError } = await supabase.from('session_students').insert({
    session_id: sessionId,
    student_id: student.id,
  })

  if (insertError) {
    // Unique constraint violation — race condition, name was just taken
    return NextResponse.json({ error: 'This name has already been taken' }, { status: 409 })
  }

  const token = createStudentToken(student.id, sessionId)

  return NextResponse.json({
    token,
    studentId: student.id,
    studentName: student.name,
    sessionId,
    sessionStatus: session.status,
  })
}
