import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import type { SessionStatus } from '@/lib/types/database'

const PHASE_ORDER: SessionStatus[] = ['lobby', 'testing', 'retest', 'complete']

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: session } = await supabase
    .from('sessions')
    .select('id, status')
    .eq('id', sessionId)
    .single()

  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  // Treat paused as testing for advancement purposes
  const effectiveStatus = session.status === 'paused' ? 'testing' : session.status
  const currentIdx = PHASE_ORDER.indexOf(effectiveStatus)
  const nextStatus = effectiveStatus === 'analyzing' || effectiveStatus === 'lesson'
    ? 'retest'
    : currentIdx === -1 || currentIdx >= PHASE_ORDER.length - 1
      ? null
      : PHASE_ORDER[currentIdx + 1]

  if (!nextStatus) return NextResponse.json({ error: 'Cannot advance further' }, { status: 400 })
  const admin = createAdminClient()

  const updates: Record<string, unknown> = { status: nextStatus }

  // Set test_started_at when advancing to testing
  if (nextStatus === 'testing') {
    updates.test_started_at = new Date().toISOString()
  }

  const { error } = await admin
    .from('sessions')
    .update(updates)
    .eq('id', sessionId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Prepare retests when entering retest phase
  if (nextStatus === 'retest') {
    const baseUrl = request.headers.get('origin') || 'http://localhost:3000'
    fetch(`${baseUrl}/api/sessions/${sessionId}/prepare-retest`, {
      method: 'POST',
      headers: {
        Cookie: request.headers.get('cookie') || '',
      },
    }).catch(console.error)
  }

  return NextResponse.json({ status: nextStatus })
}
