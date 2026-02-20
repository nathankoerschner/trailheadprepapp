import OpenAI from 'openai'
import type { StudentScore, ConceptFrequency } from '@/lib/utils/scoring'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export interface GapAnalysis {
  topConcepts: ConceptFrequency[]
  studentSummaries: Array<{
    studentId: string
    weakAreas: string[]
    strongAreas: string[]
    score: number
  }>
}

export async function analyzeGaps(
  scores: StudentScore[],
  conceptFrequencies: ConceptFrequency[]
): Promise<GapAnalysis> {
  const studentSummaries = scores.map((score) => {
    const weakAreas = Array.from(score.missedByConcept.keys())
    return {
      studentId: score.studentId,
      weakAreas,
      strongAreas: [] as string[], // Could be derived from correctly answered concepts
      score: score.percentage,
    }
  })

  return {
    topConcepts: conceptFrequencies.slice(0, 10),
    studentSummaries,
  }
}
