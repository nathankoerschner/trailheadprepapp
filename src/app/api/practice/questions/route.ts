import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { verifyStudentRequest } from '@/lib/utils/verify-student'

// Get practice problems for the current student
export async function GET(request: Request) {
  const student = verifyStudentRequest(request)
  if (!student) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()

  // Find student's lesson group
  const { data: membership } = await supabase
    .from('lesson_group_students')
    .select('group_id, lesson_groups(id, group_type, concept_focus)')
    .eq('student_id', student.studentId)

  if (!membership?.length) {
    return NextResponse.json({ group: null, problems: [] })
  }

  // Find the group that belongs to this session
  const { data: groups } = await supabase
    .from('lesson_groups')
    .select('id, group_type, concept_focus')
    .eq('session_id', student.sessionId)

  const groupIds = new Set(groups?.map((g) => g.id) || [])
  const myMembership = membership.find((m) => groupIds.has(m.group_id))

  if (!myMembership) {
    return NextResponse.json({ group: null, problems: [] })
  }

  const group = groups?.find((g) => g.id === myMembership.group_id)

  // If in a tutor group, they work with the tutor (no practice problems)
  if (group?.group_type !== 'independent') {
    return NextResponse.json({
      group: {
        type: group?.group_type,
        concept: group?.concept_focus,
      },
      problems: [],
      withTutor: true,
    })
  }

  // Get practice problems from lesson plan
  const { data: plan } = await supabase
    .from('lesson_plans')
    .select('practice_problems')
    .eq('group_id', myMembership.group_id)
    .maybeSingle()

  return NextResponse.json({
    group: {
      type: 'independent',
      concept: group?.concept_focus,
    },
    problems: plan?.practice_problems || [],
    withTutor: false,
  })
}
