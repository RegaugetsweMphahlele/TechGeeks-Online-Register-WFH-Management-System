import { useEffect, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider.jsx'
import LearningProgressExperience from '../../components/LearningProgressExperience.jsx'
import { createPersonalLearningRecord, writeCandidateRecord } from '../../lib/mentorLearningDemo.js'

export default function Learning() {
  const { profile } = useAuth()
  const [candidate, setCandidate] = useState(() => createPersonalLearningRecord(profile))

  useEffect(() => {
    if (candidate) writeCandidateRecord(candidate)
  }, [candidate])

  return (
    <LearningProgressExperience
      key={candidate.id}
      candidate={candidate}
      onUpdate={setCandidate}
      audience="candidate"
    />
  )
}