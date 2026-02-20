import OpenAI from 'openai'
import type { Question } from '@/lib/types/database'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function generateTutorGuide(
  concept: string,
  missedQuestions: Question[],
  studentNames: string[]
): Promise<string> {
  const questionSummary = missedQuestions
    .slice(0, 5)
    .map((q, i) => `${i + 1}. ${q.question_text || `Question #${q.question_number}`} (${q.section})`)
    .join('\n')

  const response = await openai.chat.completions.create({
    model: 'gpt-5.2',
    messages: [
      {
        role: 'system',
        content: `You are an expert SAT tutor creating a brief teaching guide for an experienced tutor.
Keep it concise and actionable — the tutor knows the content, they just need:
1. A quick reminder of the concept
2. Key points to emphasize
3. 2-3 example problems to walk through with students
4. Common student mistakes to address

Use LaTeX notation ($ delimiters) for any math expressions. Keep the guide under 500 words.`,
      },
      {
        role: 'user',
        content: `Create a teaching guide for the concept: "${concept}"

Students in this group: ${studentNames.join(', ')}

These students missed questions like:
${questionSummary}

Write a brief teaching guide for the tutor.`,
      },
    ],
    max_completion_tokens: 1500,
  })

  return response.choices[0]?.message?.content || ''
}
