import { createAdminClient } from '@/lib/supabase/admin'

export async function assembleRetest(
  sessionId: string,
  studentId: string,
  targetCount: number = 20
) {
  const supabase = createAdminClient()

  // Get questions the student missed
  const { data: missedAnswers } = await supabase
    .from('student_answers')
    .select('question_id, questions(id, section, concept_tag)')
    .eq('session_id', sessionId)
    .eq('student_id', studentId)
    .eq('is_correct', false)

  const missedQuestionIds = missedAnswers?.map((a) => a.question_id) || []

  // Get the session's test for padding questions
  const { data: session } = await supabase
    .from('sessions')
    .select('test_id')
    .eq('id', sessionId)
    .single()

  let retestQuestions: Array<{ questionId: string; source: 'missed' | 'padding'; order: number }> = []

  // Add missed questions
  missedQuestionIds.forEach((id, idx) => {
    retestQuestions.push({ questionId: id, source: 'missed', order: idx + 1 })
  })

  // If fewer than target, pad with related questions from concepts covered in lesson
  if (retestQuestions.length < targetCount && session?.test_id) {
    // Get concepts from missed questions
    const missedConcepts = new Set(
      missedAnswers
        ?.map((a) => (a.questions as unknown as { concept_tag: string })?.concept_tag)
        .filter(Boolean) || []
    )

    // Find other questions from the same concepts that weren't missed
    const { data: paddingQuestions } = await supabase
      .from('questions')
      .select('id')
      .eq('test_id', session.test_id)
      .in('concept_tag', Array.from(missedConcepts))
      .not('id', 'in', `(${missedQuestionIds.join(',')})`)
      .limit(targetCount - retestQuestions.length)

    paddingQuestions?.forEach((q) => {
      retestQuestions.push({
        questionId: q.id,
        source: 'padding',
        order: retestQuestions.length + 1,
      })
    })
  }

  // If still not enough, grab random questions from the test
  if (retestQuestions.length < targetCount && session?.test_id) {
    const existingIds = retestQuestions.map((r) => r.questionId)
    const { data: extraQuestions } = await supabase
      .from('questions')
      .select('id')
      .eq('test_id', session.test_id)
      .not('id', 'in', `(${existingIds.join(',')})`)
      .limit(targetCount - retestQuestions.length)

    extraQuestions?.forEach((q) => {
      retestQuestions.push({
        questionId: q.id,
        source: 'padding',
        order: retestQuestions.length + 1,
      })
    })
  }

  // Trim to target count
  retestQuestions = retestQuestions.slice(0, targetCount)

  // Save retest questions
  if (retestQuestions.length > 0) {
    await supabase.from('retest_questions').insert(
      retestQuestions.map((rq) => ({
        session_id: sessionId,
        student_id: studentId,
        question_id: rq.questionId,
        source: rq.source,
        question_order: rq.order,
      }))
    )
  }

  return retestQuestions
}

export function calculateRetestDuration(
  mathCount: number,
  rwCount: number
): number {
  // ~1.5 min/question for math, ~1.25 min/question for R/W
  const mathMinutes = mathCount * 1.5
  const rwMinutes = rwCount * 1.25
  return Math.ceil(mathMinutes + rwMinutes)
}
