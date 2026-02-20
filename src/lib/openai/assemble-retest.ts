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
    .select('question_id')
    .eq('session_id', sessionId)
    .eq('student_id', studentId)
    .eq('is_correct', false)

  const missedQuestionIds = missedAnswers?.map((a) => a.question_id) || []

  // Retest = only missed questions, capped at target count
  const retestQuestions = missedQuestionIds.slice(0, targetCount).map((id, idx) => ({
    questionId: id,
    source: 'missed' as const,
    order: idx + 1,
  }))

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
