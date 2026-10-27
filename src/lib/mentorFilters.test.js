import { describe, expect, it } from 'vitest'
import { candidateIdsForFilters, cohortOptions, filterCandidates, streamOptions } from './mentorFilters.js'

const candidates = [
  { id: '1', cohort: 'Demand 1', stream: 'Software Development' },
  { id: '2', cohort: 'Demand 1', stream: 'IT Support' },
  { id: '3', cohort: 'Data', stream: null },
]

describe('mentor cohort and stream filters', () => {
  it('uses the Candidate Learning Progress cohort and Demand 1 stream options', () => {
    expect(cohortOptions()).toEqual([
      ['Demand 1', 'Demand 1'],
      ['Data', 'Data'],
      ['Computer Centre', 'Computer Centre'],
      ['Marketing', 'Marketing'],
      ['Clickatell', 'Clickatell'],
    ])
    expect(streamOptions('Demand 1')).toEqual([
      ['Software Development', 'Software Development'],
      ['IT Support', 'IT Support'],
      ['Web Development', 'Web Development'],
    ])
    expect(streamOptions('Data')).toEqual([])
    expect(streamOptions('Demand 1')).toHaveLength(3)
  })

  it('filters candidates and returns matching IDs for record queries', () => {
    expect(filterCandidates(candidates, { cohort: 'Demand 1' }).map((candidate) => candidate.id)).toEqual(['1', '2'])
    expect(candidateIdsForFilters(candidates, { cohort: 'Demand 1', stream: 'IT Support' })).toEqual(['2'])
    expect(candidateIdsForFilters(candidates, { cohort: 'Unknown' })).toEqual([])
    expect(filterCandidates(candidates, { cohort: 'Data', stream: 'Software Development' })).toEqual([])
    expect(candidateIdsForFilters(candidates, {})).toBeUndefined()
  })
})
