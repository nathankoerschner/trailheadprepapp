import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Public endpoint — students poll this (no auth required, uses service role)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
  const supabase = createAdminClient()

  const { data: session, error } = await supabase
    .from('sessions')
    .select('id, status, test_started_at, test_duration_minutes, paused_at, total_paused_ms')
    .eq('id', sessionId)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  const { data: students } = await supabase
    .from('session_students')
    .select('student_id, test_submitted, students(name)')
    .eq('session_id', sessionId)

  return NextResponse.json({
    status: session.status,
    testStartedAt: session.test_started_at,
    testDurationMinutes: session.test_duration_minutes,
    pausedAt: session.paused_at,
    totalPausedMs: session.total_paused_ms,
    students: students || [],
  })
}
