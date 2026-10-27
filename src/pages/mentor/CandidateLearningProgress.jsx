import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../components/layout/AppLayout.jsx'
import LearningProgressExperience from '../../components/LearningProgressExperience.jsx'
import Button from '../../components/ui/Button.jsx'
import { createDemoCandidates, readCandidateRecord, writeCandidateRecord } from '../../lib/mentorLearningDemo.js'

export default function CandidateLearningProgress() {
  const { candidateId } = useParams()
  const [searchParams] = useSearchParams()
  const [candidates, setCandidates] = useState(() => createDemoCandidates().map((item) => readCandidateRecord(item.id, item)))
  const candidate = candidates.find((item) => item.id === candidateId)

  useEffect(() => {
    candidates.forEach(writeCandidateRecord)
  }, [candidates])

  const stream = candidate?.stream ?? searchParams.get('stream')
  const cohort = candidate?.cohort ?? searchParams.get('cohort') ?? 'Demand 1'
  const backParams = new URLSearchParams({ cohort })
  if (cohort === 'Demand 1') backParams.set('stream', stream || 'Software Development')
  const backTo = `/mentor/learning?${backParams.toString()}`

  if (!candidate) {
    return (
      <>
        <PageHeader title="Candidate record unavailable" subtitle="This demo candidate could not be found." />
        <Button to={backTo} variant="secondary">Back to Candidate Learning Progress</Button>
      </>
    )
  }

  const updateCandidate = (updated) => {
    setCandidates((current) => current.map((item) => item.id === updated.id ? updated : item))
  }

  return (
    <LearningProgressExperience
      key={candidate.id}
      candidate={candidate}
      onUpdate={updateCandidate}
      backTo={backTo}
      audience="mentor"
    />
  )
}