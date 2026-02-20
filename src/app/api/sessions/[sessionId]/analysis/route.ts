import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { scoreStudent, buildConceptFrequencyMatrix } from '@/lib/utils/scoring'
import { clusterStudents } from '@/lib/openai/cluster-students'
import { generateTutorGuide } from '@/lib/openai/generate-lesson-plan'
import { generatePracticeProblems } from '@/lib/openai/generate-practice'
import type { Question, StudentAnswer } from '@/lib/types/database'

// GET: check analysis progress
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
  const supabase = createAdminClient()

  const { data: job } = await supabase
    .from('analysis_jobs')
    .select('*')
    .eq('session_id', sessionId)
    .maybeSingle()

  if (!job) {
    return NextResponse.json({ status: 'not_started', progress: 0 })
  }

  return NextResponse.json({
    status: job.status,
    progress: job.progress,
    error: job.error_message,
  })
}

// POST: trigger analysis
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Create analysis job
  await admin.from('analysis_jobs').upsert({
    session_id: sessionId,
    status: 'grading',
    progress: 0,
    started_at: new Date().toISOString(),
  }, { onConflict: 'session_id' })

  // Run analysis asynchronously
  runAnalysis(sessionId, admin).catch(async (err) => {
    console.error('Analysis failed:', err)
    await admin
      .from('analysis_jobs')
      .update({ status: 'error', error_message: String(err) })
      .eq('session_id', sessionId)
  })

  return NextResponse.json({ status: 'started' })
}

async function runAnalysis(
  sessionId: string,
  admin: ReturnType<typeof createAdminClient>
) {
  // Get session info
  const { data: session } = await admin
    .from('sessions')
    .select('test_id, tutor_count')
    .eq('id', sessionId)
    .single()

  if (!session) throw new Error('Session not found')

  // Get all questions
  const { data: questions } = await admin
    .from('questions')
    .select('*')
    .eq('test_id', session.test_id)
    .order('question_number')

  if (!questions?.length) throw new Error('No questions found')

  // Get all session students
  const { data: sessionStudents } = await admin
    .from('session_students')
    .select('student_id, students(name)')
    .eq('session_id', sessionId)

  if (!sessionStudents?.length) throw new Error('No students in session')

  // Step 1: Grade all students (10%)
  await updateProgress(admin, sessionId, 'grading', 10)

  const scores = []
  for (const ss of sessionStudents) {
    const { data: answers } = await admin
      .from('student_answers')
      .select('*')
      .eq('session_id', sessionId)
      .eq('student_id', ss.student_id)

    const score = scoreStudent(
      ss.student_id,
      questions as Question[],
      (answers || []) as StudentAnswer[]
    )
    scores.push(score)
  }

  // Step 2: Analyze gaps (30%)
  await updateProgress(admin, sessionId, 'analyzing', 30)
  const conceptFrequencies = buildConceptFrequencyMatrix(scores)

  // Step 3: Cluster students (50%)
  await updateProgress(admin, sessionId, 'clustering', 50)
  const { groups } = clusterStudents(scores, conceptFrequencies, session.tutor_count)

  // Save groups to database
  for (const group of groups) {
    const { data: lessonGroup } = await admin
      .from('lesson_groups')
      .insert({
        session_id: sessionId,
        group_type: group.groupType,
        concept_focus: group.conceptFocus,
      })
      .select()
      .single()

    if (!lessonGroup) continue

    // Add students to group
    await admin.from('lesson_group_students').insert(
      group.studentIds.map((studentId) => ({
        group_id: lessonGroup.id,
        student_id: studentId,
      }))
    )

    // Step 4: Generate lesson plans (70%)
    await updateProgress(admin, sessionId, 'generating_lessons', 60)

    // Get student names for this group
    const studentNames = group.studentIds
      .map((id) => {
        const ss = sessionStudents.find((s) => s.student_id === id)
        return (ss?.students as unknown as { name: string })?.name || 'Unknown'
      })

    // Get missed questions for this concept
    const conceptQuestions = questions.filter(
      (q) => q.concept_tag === group.conceptFocus
    )

    if (group.groupType !== 'independent') {
      // Generate tutor guide
      const guide = await generateTutorGuide(
        group.conceptFocus,
        conceptQuestions as Question[],
        studentNames
      )

      await admin.from('lesson_plans').insert({
        session_id: sessionId,
        group_id: lessonGroup.id,
        tutor_guide: guide,
        practice_problems: [],
      })
    } else {
      // Generate practice problems for independent students
      await updateProgress(admin, sessionId, 'generating_practice', 80)

      // Get top concepts these students missed
      const independentScores = scores.filter((s) =>
        group.studentIds.includes(s.studentId)
      )
      const indConcepts = buildConceptFrequencyMatrix(independentScores)

      const allProblems = []
      for (const concept of indConcepts.slice(0, 5)) {
        const sampleQuestion = questions.find(
          (q) => q.concept_tag === concept.concept
        )
        const problems = await generatePracticeProblems(
          concept.concept,
          sampleQuestion?.section || 'math',
          sampleQuestion?.question_text || null,
          3
        )
        allProblems.push(...problems)
      }

      await admin.from('lesson_plans').insert({
        session_id: sessionId,
        group_id: lessonGroup.id,
        practice_problems: allProblems,
      })
    }
  }

  // Complete
  await updateProgress(admin, sessionId, 'complete', 100)

  // Advance session to lesson phase
  await admin
    .from('sessions')
    .update({ status: 'lesson' })
    .eq('id', sessionId)
}

async function updateProgress(
  admin: ReturnType<typeof createAdminClient>,
  sessionId: string,
  status: string,
  progress: number
) {
  await admin
    .from('analysis_jobs')
    .update({ status, progress })
    .eq('session_id', sessionId)
}
