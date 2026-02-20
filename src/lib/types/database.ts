export type SessionStatus = 'lobby' | 'testing' | 'analyzing' | 'lesson' | 'retest' | 'complete'
export type QuestionSection = 'reading_writing' | 'math'
export type AnswerChoice = 'A' | 'B' | 'C' | 'D'
export type GroupType = 'tutor_1' | 'tutor_2' | 'tutor_3' | 'independent'
export type RetestSource = 'missed' | 'padding'
export type TestStatus = 'processing' | 'ready' | 'error'
export type AnalysisStatus = 'pending' | 'grading' | 'analyzing' | 'clustering' | 'generating_lessons' | 'generating_practice' | 'complete' | 'error'

export interface Organization {
  id: string
  name: string
  created_at: string
}

export interface Tutor {
  id: string
  org_id: string
  name: string
  email: string
  created_at: string
}

export interface Student {
  id: string
  org_id: string
  name: string
  created_at: string
}

export interface Test {
  id: string
  org_id: string
  name: string
  created_by: string
  status: TestStatus
  total_questions: number
  created_at: string
}

export interface Question {
  id: string
  test_id: string
  question_number: number
  image_url: string | null
  question_text: string | null
  answer_a: string | null
  answer_b: string | null
  answer_c: string | null
  answer_d: string | null
  correct_answer: AnswerChoice
  section: QuestionSection
  concept_tag: string | null
  ai_confidence: number | null
  has_graphic: boolean
  graphic_url: string | null
  answers_are_visual: boolean
  original_image_url: string | null
  created_at: string
}

export interface Session {
  id: string
  org_id: string
  test_id: string
  created_by: string
  pin_code: string
  status: SessionStatus
  tutor_count: number
  retest_question_count: number
  test_duration_minutes: number
  test_started_at: string | null
  created_at: string
}

export interface SessionStudent {
  id: string
  session_id: string
  student_id: string
  joined_at: string
  test_started_at: string | null
  test_submitted: boolean
  test_submitted_at: string | null
}

export interface StudentAnswer {
  id: string
  session_id: string
  student_id: string
  question_id: string
  selected_answer: AnswerChoice | null
  is_correct: boolean | null
  answered_at: string
}

export interface AnalysisJob {
  id: string
  session_id: string
  status: AnalysisStatus
  progress: number
  error_message: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export interface LessonGroup {
  id: string
  session_id: string
  group_type: GroupType
  concept_focus: string | null
  created_at: string
}

export interface LessonGroupStudent {
  id: string
  group_id: string
  student_id: string
}

export interface PracticeProblem {
  id: string
  question_text: string
  answer_a: string
  answer_b: string
  answer_c: string
  answer_d: string
  correct_answer: AnswerChoice
  explanation: string
  difficulty: number
  concept_tag: string
  has_graphic: boolean
  graphic_url?: string
}

export interface LessonPlan {
  id: string
  session_id: string
  group_id: string
  tutor_guide: string | null
  practice_problems: PracticeProblem[]
  created_at: string
}

export interface RetestQuestion {
  id: string
  session_id: string
  student_id: string
  question_id: string
  source: RetestSource
  question_order: number
  created_at: string
}

export interface RetestAnswer {
  id: string
  session_id: string
  student_id: string
  question_id: string
  selected_answer: AnswerChoice | null
  is_correct: boolean | null
  answered_at: string
}

export interface GridQuestion {
  id: string
  question_number: number
  question_text: string | null
  answer_a: string | null
  answer_b: string | null
  answer_c: string | null
  answer_d: string | null
  correct_answer: AnswerChoice
  section: QuestionSection
  has_graphic: boolean
  graphic_url: string | null
  image_url: string | null
  answers_are_visual: boolean
}

export interface GridAnswer {
  student_id: string
  question_id: string
  selected_answer: AnswerChoice | null
  is_correct: boolean | null
}

export interface ProgressReport {
  id: string
  session_id: string
  student_id: string
  summary: Record<string, unknown>
  created_at: string
}
