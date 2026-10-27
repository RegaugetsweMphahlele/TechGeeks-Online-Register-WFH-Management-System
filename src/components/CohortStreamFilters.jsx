import { FilterSelect } from './Filters.jsx'
import { cohortOptions, streamOptions } from '../lib/mentorFilters.js'

export default function CohortStreamFilters({ cohort, stream, onChange }) {
  const cohorts = cohortOptions()
  const streams = streamOptions(cohort)

  return (
    <>
      {cohorts.length > 0 && <FilterSelect label="Cohort" value={cohort} onChange={(value) => onChange({ cohort: value, stream: undefined })} options={cohorts} />}
      {streams.length > 0 && <FilterSelect label="Stream" value={stream} onChange={(value) => onChange({ stream: value })} options={streams} />}
    </>
  )
}
