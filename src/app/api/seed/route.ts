import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

const ORG_ID = '00000000-0000-0000-0000-000000000001'
const TUTOR_EMAIL = 'tutor@trailhead.test'
const TUTOR_PASSWORD = 'password123'

export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  const supabase = createAdminClient()

  // Create org if it doesn't exist
  await supabase
    .from('organizations')
    .upsert({ id: ORG_ID, name: 'Trailhead Prep' })

  // Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: TUTOR_EMAIL,
    password: TUTOR_PASSWORD,
    email_confirm: true,
  })

  if (authError && !authError.message.includes('already been registered')) {
    return NextResponse.json({ error: authError.message }, { status: 500 })
  }

  const userId = authData?.user?.id
  if (userId) {
    await supabase
      .from('tutors')
      .upsert({
        id: userId,
        org_id: ORG_ID,
        name: 'Demo Tutor',
        email: TUTOR_EMAIL,
      })
  }

  // Create some sample students
  const students = [
    'Alex Johnson', 'Maria Garcia', 'James Wilson', 'Sarah Chen',
    'David Kim', 'Emma Brown', 'Michael Davis', 'Sophia Martinez',
  ]

  for (const name of students) {
    await supabase
      .from('students')
      .upsert(
        { org_id: ORG_ID, name },
        { onConflict: 'id' }
      )
  }

  return NextResponse.json({
    message: 'Seed complete',
    tutor: { email: TUTOR_EMAIL, password: TUTOR_PASSWORD },
  })
}
