import type { ConceptFrequency, StudentScore } from '@/lib/utils/scoring'
import type { GroupType } from '@/lib/types/database'

export interface ClusterResult {
  groups: Array<{
    groupType: GroupType
    conceptFocus: string
    studentIds: string[]
  }>
}

export function clusterStudents(
  scores: StudentScore[],
  conceptFrequencies: ConceptFrequency[],
  tutorCount: number
): ClusterResult {
  const groups: ClusterResult['groups'] = []

  // Top N concepts become tutor groups (N = tutorCount, max 3)
  const tutorGroupCount = Math.min(tutorCount, conceptFrequencies.length)
  const assignedStudents = new Set<string>()
  const groupTypes: GroupType[] = ['tutor_1', 'tutor_2', 'tutor_3']

  for (let i = 0; i < tutorGroupCount; i++) {
    const concept = conceptFrequencies[i]
    // Students who missed this concept and aren't already assigned
    const eligibleStudents = concept.studentIds.filter((id) => !assignedStudents.has(id))

    if (eligibleStudents.length > 0) {
      groups.push({
        groupType: groupTypes[i],
        conceptFocus: concept.concept,
        studentIds: eligibleStudents,
      })
      eligibleStudents.forEach((id) => assignedStudents.add(id))
    }
  }

  // Remaining students go to independent practice
  const independentStudents = scores
    .map((s) => s.studentId)
    .filter((id) => !assignedStudents.has(id))

  if (independentStudents.length > 0) {
    groups.push({
      groupType: 'independent',
      conceptFocus: 'mixed',
      studentIds: independentStudents,
    })
  }

  // If no tutor groups were created (sparse data), put everyone in independent
  if (groups.length === 0) {
    groups.push({
      groupType: 'independent',
      conceptFocus: 'general review',
      studentIds: scores.map((s) => s.studentId),
    })
  }

  return { groups }
}
