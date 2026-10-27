import { LEARNING_COHORTS, LEARNING_STREAMS } from './mentorLearningDemo.js'

export function cohortOptions() {
  return LEARNING_COHORTS.map((cohort) => [cohort, cohort])
}

export function streamOptions(cohort) {
  return cohort === 'Demand 1' ? LEARNING_STREAMS.map((stream) => [stream, stream]) : []
}

export function filterCandidates(candidates = [], { cohort, stream } = {}) {
  return candidates.filter((candidate) =>
    (!cohort || candidate.cohort === cohort) &&
    (!stream || (cohort === 'Demand 1' && candidate.stream === stream)))
}

export function candidateIdsForFilters(candidates, filters = {}) {
  if (!filters.cohort && !filters.stream) return undefined
  return filterCandidates(candidates, filters).map((candidate) => candidate.id)
}
