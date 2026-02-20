import OpenAI from 'openai'
import type { PracticeProblem, AnswerChoice } from '@/lib/types/database'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function generatePracticeProblems(
  concept: string,
  section: string,
  originalQuestionText: string | null,
  count: number = 4
): Promise<PracticeProblem[]> {
  const response = await openai.chat.completions.create({
    model: 'gpt-5.2',
    messages: [
      {
        role: 'system',
        content: `You are an SAT question generator. Generate scaffolded practice problems that progress from easier to harder.
Each problem should:
1. Test the same concept
2. Start at an easier difficulty than the original
3. Progress to match the original difficulty by the last question
4. Have 4 answer choices (A, B, C, D)
5. Include a brief explanation for the correct answer

For math questions, use LaTeX notation with $ delimiters.

Return valid JSON with this structure:
{
  "problems": [
    {
      "question_text": "...",
      "answer_a": "...",
      "answer_b": "...",
      "answer_c": "...",
      "answer_d": "...",
      "correct_answer": "A" | "B" | "C" | "D",
      "explanation": "...",
      "difficulty": 1-5
    }
  ]
}`,
      },
      {
        role: 'user',
        content: `Generate ${count} scaffolded practice problems for the concept "${concept}" (SAT section: ${section}).

${originalQuestionText ? `The original question the student missed was:\n${originalQuestionText}\n\n` : ''}Start easier and build up to the original difficulty.`,
      },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 3000,
  })

  const content = response.choices[0]?.message?.content
  if (!content) return []

  try {
    const parsed = JSON.parse(content)
    const problems = parsed.problems || []
    return problems.map((p: Record<string, unknown>, i: number) => ({
      id: `practice-${concept}-${i}`,
      question_text: p.question_text as string || '',
      answer_a: p.answer_a as string || '',
      answer_b: p.answer_b as string || '',
      answer_c: p.answer_c as string || '',
      answer_d: p.answer_d as string || '',
      correct_answer: (p.correct_answer as AnswerChoice) || 'A',
      explanation: p.explanation as string || '',
      difficulty: (p.difficulty as number) || i + 1,
      concept_tag: concept,
      has_graphic: false,
    }))
  } catch {
    return []
  }
}
