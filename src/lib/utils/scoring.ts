import type { StudentAnswer, Question, AnswerChoice } from '@/lib/types/database'

export interface StudentScore {
  studentId: string
  totalQuestions: number
  correctCount: number
  incorrectCount: number
  unanswered: number
  percentage: number
  missedQuestionIds: string[]
  missedByConcept: Map<string, string[]> // concept -> question IDs
}

export function scoreStudent(
  studentId: string,
  questions: Question[],
  answers: StudentAnswer[]
): StudentScore {
  const answerMap = new Map(answers.map((a) => [a.question_id, a]))
  const missedQuestionIds: string[] = []
  const missedByConcept = new Map<string, string[]>()
  let correctCount = 0

  for (const question of questions) {
    const answer = answerMap.get(question.id)
    if (answer?.is_correct) {
      correctCount++
    } else {
      missedQuestionIds.push(question.id)
      const concept = question.concept_tag || 'unknown'
      if (!missedByConcept.has(concept)) {
        missedByConcept.set(concept, [])
      }
      missedByConcept.get(concept)!.push(question.id)
    }
  }

  const unanswered = questions.length - answers.length
  return {
    studentId,
    totalQuestions: questions.length,
    correctCount,
    incorrectCount: missedQuestionIds.length,
    unanswered: Math.max(0, unanswered),
    percentage: questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0,
    missedQuestionIds,
    missedByConcept,
  }
}

export interface ConceptFrequency {
  concept: string
  count: number
  studentIds: string[]
  questionIds: string[]
}

export function buildConceptFrequencyMatrix(
  scores: StudentScore[]
): ConceptFrequency[] {
  const conceptMap = new Map<string, { count: number; studentIds: Set<string>; questionIds: Set<string> }>()

  for (const score of scores) {
    for (const [concept, questionIds] of score.missedByConcept) {
      if (!conceptMap.has(concept)) {
        conceptMap.set(concept, { count: 0, studentIds: new Set(), questionIds: new Set() })
      }
      const entry = conceptMap.get(concept)!
      entry.count += questionIds.length
      entry.studentIds.add(score.studentId)
      for (const qId of questionIds) {
        entry.questionIds.add(qId)
      }
    }
  }

  return Array.from(conceptMap.entries())
    .map(([concept, data]) => ({
      concept,
      count: data.count,
      studentIds: Array.from(data.studentIds),
      questionIds: Array.from(data.questionIds),
    }))
    .sort((a, b) => b.count - a.count)
}
