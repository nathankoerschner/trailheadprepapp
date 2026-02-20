import { createAdminClient } from '@/lib/supabase/admin'

export interface ReportSummary {
  studentName: string
  testScore: { correct: number; total: number; percentage: number }
  retestScore: { correct: number; total: number; percentage: number }
  improvement: number
  missedConcepts: Array<{ concept: string; missedCount: number; retestCorrect: number }>
  practiceCompleted: boolean
  groupType: string
}

export async function generateReport(
  sessionId: string,
  studentId: string
): Promise<ReportSummary> {
  const supabase = createAdminClient()

  // Get student name
  const { data: student } = await supabase
    .from('students')
    .select('name')
    .eq('id', studentId)
    .single()

  // Get test answers
  const { data: testAnswers } = await supabase
    .from('student_answers')
    .select('question_id, is_correct, questions(concept_tag)')
    .eq('session_id', sessionId)
    .eq('student_id', studentId)

  // Get retest answers
  const { data: retestAnswers } = await supabase
    .from('retest_answers')
    .select('question_id, is_correct, questions(concept_tag)')
    .eq('session_id', sessionId)
    .eq('student_id', studentId)

  // Get group assignment
  const { data: membership } = await supabase
    .from('lesson_group_students')
    .select('lesson_groups(group_type, concept_focus)')
    .eq('student_id', studentId)

  const sessionGroups = await supabase
    .from('lesson_groups')
    .select('id')
    .eq('session_id', sessionId)

  const sessionGroupIds = new Set(sessionGroups.data?.map((g) => g.id) || [])

  // Calculate scores
  const testTotal = testAnswers?.length || 0
  const testCorrect = testAnswers?.filter((a) => a.is_correct).length || 0
  const retestTotal = retestAnswers?.length || 0
  const retestCorrect = retestAnswers?.filter((a) => a.is_correct).length || 0

  const testPercentage = testTotal > 0 ? Math.round((testCorrect / testTotal) * 100) : 0
  const retestPercentage = retestTotal > 0 ? Math.round((retestCorrect / retestTotal) * 100) : 0

  // Concept breakdown
  const conceptMap = new Map<string, { missed: number; retestCorrect: number }>()

  testAnswers?.forEach((a) => {
    if (!a.is_correct) {
      const concept = (a.questions as unknown as { concept_tag: string })?.concept_tag || 'unknown'
      if (!conceptMap.has(concept)) {
        conceptMap.set(concept, { missed: 0, retestCorrect: 0 })
      }
      conceptMap.get(concept)!.missed++
    }
  })

  retestAnswers?.forEach((a) => {
    if (a.is_correct) {
      const concept = (a.questions as unknown as { concept_tag: string })?.concept_tag || 'unknown'
      if (conceptMap.has(concept)) {
        conceptMap.get(concept)!.retestCorrect++
      }
    }
  })

  const missedConcepts = Array.from(conceptMap.entries())
    .map(([concept, data]) => ({
      concept,
      missedCount: data.missed,
      retestCorrect: data.retestCorrect,
    }))
    .sort((a, b) => b.missedCount - a.missedCount)

  return {
    studentName: student?.name || 'Unknown',
    testScore: { correct: testCorrect, total: testTotal, percentage: testPercentage },
    retestScore: { correct: retestCorrect, total: retestTotal, percentage: retestPercentage },
    improvement: retestPercentage - testPercentage,
    missedConcepts,
    practiceCompleted: true,
    groupType: 'independent', // Simplified for MVP
  }
}
