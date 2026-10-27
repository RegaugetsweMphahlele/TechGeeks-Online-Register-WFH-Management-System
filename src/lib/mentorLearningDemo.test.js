import { describe, expect, it } from 'vitest'
import {
  candidateProgress,
  candidateStatus,
  courseProgress,
  completeCourse,
  createDemoCandidates,
  currentCourse,
  LEARNING_COHORTS,
  LEARNING_STREAMS,
  updateCourseProgress,
} from './mentorLearningDemo.js'

describe('mentor learning demonstration data', () => {
  const candidates = createDemoCandidates()

  it('provides nine fictional candidates in each cohort and Demand 1 stream', () => {
    expect(candidates).toHaveLength(63)
    expect(candidates.filter((candidate) => candidate.cohort === 'Demand 1')).toHaveLength(27)
    for (const cohort of LEARNING_COHORTS.filter((item) => item !== 'Demand 1')) {
      expect(candidates.filter((candidate) => candidate.cohort === cohort)).toHaveLength(9)
    }
    for (const stream of LEARNING_STREAMS) {
      const streamCandidates = candidates.filter((candidate) => candidate.cohort === 'Demand 1' && candidate.stream === stream)
      expect(streamCandidates).toHaveLength(9)
      expect(streamCandidates.every((candidate) => candidate.id.startsWith('DEMO-'))).toBe(true)
      expect(streamCandidates.every((candidate) => candidate.courses.length === 15)).toBe(true)
    }
    expect(new Set(candidates.map((candidate) => candidate.id)).size).toBe(63)
  })

  it('includes not-started, in-progress, and completed examples', () => {
    const statuses = candidates.map(candidateStatus)
    expect(statuses).toContain('Not Started')
    expect(statuses).toContain('In Progress')
    expect(statuses).toContain('Completed')
    expect(currentCourse(candidates.find((candidate) => candidateStatus(candidate) === 'Completed'))).toBeUndefined()
  })

  it('provides a fifteen-course path and unique IDs for every candidate', () => {
    expect(candidates.every((candidate) => candidate.courses.length === 15)).toBe(true)
    expect(new Set(candidates.map((candidate) => candidate.id)).size).toBe(63)
  })

  it('keeps overall progress consistent with completed courses and current progress', () => {
    for (const candidate of candidates) {
      expect(candidateProgress(candidate)).toBe(Math.round(
        candidate.courses.reduce((sum, course) => sum + courseProgress(course), 0) / candidate.courses.length,
      ))
    }
  })

  it('updates course completion and candidate progress consistently', () => {
    const candidate = candidates[0]
    const currentCourse = candidate.courses[10]
    const changed = updateCourseProgress(candidate, currentCourse.id, 65)
    expect(courseProgress(changed.courses[10])).toBe(65)
    expect(changed.courses[10].status).toBe('In Progress')

    const completed = completeCourse(changed, currentCourse.id)
    expect(courseProgress(completed.courses[10])).toBe(100)
    expect(completed.courses[10].status).toBe('Completed')
    expect(completed.courses[11].status).toBe('Upcoming')
    expect(candidateProgress(completed)).toBeGreaterThan(candidateProgress(candidate))
  })
})