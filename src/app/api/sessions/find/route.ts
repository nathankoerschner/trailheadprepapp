import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const pin = searchParams.get('pin')

  if (!pin) {
    return NextResponse.json({ error: 'PIN required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: session } = await supabase
    .from('sessions')
    .select('id, org_id, status')
    .eq('pin_code', pin)
    .in('status', ['lobby', 'testing'])
    .maybeSingle()

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  // Get available students for this org
  const { data: students } = await supabase
    .from('students')
    .select('id, name')
    .eq('org_id', session.org_id)
    .order('name')

  return NextResponse.json({
    sessionId: session.id,
    status: session.status,
    students: students || [],
  })
}
