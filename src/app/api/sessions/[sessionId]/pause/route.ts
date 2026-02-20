import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('id, status, paused_at, total_paused_ms')
    .eq('id', sessionId)
    .single()

  if (sessionError) {
    if (sessionError.code === 'PGRST116') {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    return NextResponse.json({ error: sessionError.message }, { status: 500 })
  }
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  if (session.status === 'testing') {
    // Pause the test
    const { error } = await supabase
      .from('sessions')
      .update({
        status: 'paused',
        paused_at: new Date().toISOString(),
      })
      .eq('id', sessionId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ status: 'paused' })
  }

  if (session.status === 'paused') {
    // Resume the test — accumulate pause duration
    const pausedAt = session.paused_at ? new Date(session.paused_at).getTime() : Date.now()
    const pauseDuration = Date.now() - pausedAt
    const newTotalPausedMs = (session.total_paused_ms || 0) + pauseDuration

    const { error } = await supabase
      .from('sessions')
      .update({
        status: 'testing',
        paused_at: null,
        total_paused_ms: newTotalPausedMs,
      })
      .eq('id', sessionId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ status: 'testing' })
  }

  return NextResponse.json({ error: 'Can only pause/resume during testing' }, { status: 400 })
}
