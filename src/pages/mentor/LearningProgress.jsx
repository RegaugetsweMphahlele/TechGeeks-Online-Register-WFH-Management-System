import { useMemo, useState } from 'react'
import { BookOpen, ChartNoAxesColumnIncreasing, CirclePlay, Search, Trophy, Users } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../components/layout/AppLayout.jsx'
import Badge from '../../components/ui/Badge.jsx'
import Button from '../../components/ui/Button.jsx'
import { Card, StatCard } from '../../components/ui/Card.jsx'
import { Table } from '../../components/ui/Table.jsx'
import {
  candidateProgress,
  candidateStatus,
  completedCourseCount,
  currentCourse,
  latestActivity,
  LEARNING_COHORTS,
  LEARNING_STREAMS,
  readDemoCandidates,
} from '../../lib/mentorLearningDemo.js'

const FILTER_STATUSES = ['All', 'Not Started', 'In Progress', 'Completed']

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No activity yet'
}

function ProgressBar({ value }) {
  return (
    <div className="w-36 max-w-full">
      <div className="mb-1 flex justify-between text-xs"><span className="text-muted">Progress</span><strong>{value}%</strong></div>
      <div className="h-2 overflow-hidden rounded-full bg-bg" role="progressbar" aria-label="Candidate course progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={value}>
        <div className="h-full rounded-full bg-purple transition-[width]" style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

function LearningStatus({ value }) {
  const tone = value === 'Completed' ? 'approved' : value === 'In Progress' ? 'submitted' : 'neutral'
  return <Badge tone={tone}>{value}</Badge>
}

export default function LearningProgress() {
  const candidates = useMemo(() => readDemoCandidates(), [])
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const cohort = LEARNING_COHORTS.includes(params.get('cohort')) ? params.get('cohort') : LEARNING_COHORTS[0]
  const streamParam = params.get('stream')
  const stream = LEARNING_STREAMS.includes(streamParam) ? streamParam : LEARNING_STREAMS[0]
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')

  const streamCandidates = candidates.filter((candidate) => (
    candidate.cohort === cohort && (cohort !== 'Demand 1' || candidate.stream === stream)
  ))
  const visibleCandidates = useMemo(() => {
    const query = search.trim().toLowerCase()
    return streamCandidates.filter((candidate) => {
      const matchesSearch = !query || `${candidate.name} ${candidate.id}`.toLowerCase().includes(query)
      return matchesSearch && (statusFilter === 'All' || candidateStatus(candidate) === statusFilter)
    })
  }, [search, statusFilter, streamCandidates])

  const stats = {
    total: streamCandidates.length,
    started: streamCandidates.filter((candidate) => candidateStatus(candidate) !== 'Not Started').length,
    completed: streamCandidates.filter((candidate) => candidateStatus(candidate) === 'Completed').length,
    average: streamCandidates.length
      ? Math.round(streamCandidates.reduce((sum, candidate) => sum + candidateProgress(candidate), 0) / streamCandidates.length)
      : 0,
  }

  const updateCohort = (nextCohort) => {
    const nextParams = { cohort: nextCohort }
    if (nextCohort === 'Demand 1') nextParams.stream = LEARNING_STREAMS[0]
    setParams(nextParams, { replace: true })
  }

  const updateStream = (nextStream) => {
    setParams({ cohort, stream: nextStream }, { replace: true })
  }

  const columns = [
    { key: 'name', header: 'Candidate', render: (candidate) => (
      <div className="min-w-40"><p className="font-medium">{candidate.name}</p><p className="mt-0.5 font-mono text-xs text-muted">{candidate.id}</p></div>
    ) },
    { key: 'cohort', header: 'Cohort', render: (candidate) => candidate.cohort },
    ...(cohort === 'Demand 1' ? [{ key: 'stream', header: 'Stream', render: (candidate) => candidate.stream }] : []),
    { key: 'current', header: 'Current Course', render: (candidate) => {
      const course = currentCourse(candidate)
      const index = course ? candidate.courses.indexOf(course) : -1
      return <div className="min-w-52"><p className="max-w-64 text-sm font-medium">{course?.title ?? 'Learning path complete'}</p><p className="mt-1 text-xs text-muted">{course ? `Course ${index + 1} of ${candidate.courses.length}` : 'All courses completed'}</p></div>
    } },
    { key: 'progress', header: 'Progress', render: (candidate) => <ProgressBar value={candidateProgress(candidate)} /> },
    { key: 'courses', header: 'Courses Completed', render: (candidate) => <span className="whitespace-nowrap">{completedCourseCount(candidate)} / {candidate.courses.length}</span> },
    { key: 'activity', header: 'Last Activity', render: (candidate) => <span className="whitespace-nowrap">{formatDate(latestActivity(candidate))}</span> },
    { key: 'status', header: 'Status', render: (candidate) => <LearningStatus value={candidateStatus(candidate)} /> },
    { key: 'action', header: <span className="sr-only">Action</span>, render: (candidate) => (
      <Button size="s" variant="secondary" onClick={() => navigate(`/mentor/learning/${candidate.id}?cohort=${encodeURIComponent(cohort)}&stream=${encodeURIComponent(stream)}`)}>View Progress</Button>
    ) },
  ]

  return (
    <>
      <PageHeader title="Candidate Learning Progress" subtitle="Compare candidate learning progress by cohort and stream." />

      <div className="mb-5 rounded-lg border border-purple/20 bg-purple-tint px-4 py-3 text-sm leading-5 text-kadet">
        <strong>Demo Learning Environment:</strong> candidate names, identifiers, course data, progress and activity are fictional. Changes are stored in this browser only and are not synced with Coursera or Supabase.
      </div>

      <section aria-label="Cohort and stream filters" className={`mb-6 grid grid-cols-1 gap-4 rounded-xl border border-line bg-white p-5 shadow-card ${cohort === 'Demand 1' ? 'sm:grid-cols-2' : 'sm:grid-cols-1'}`}>
        <div>
          <label className="label-caps" htmlFor="cohort-select">Cohort</label>
          <select id="cohort-select" value={cohort} onChange={(event) => updateCohort(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-purple">
            {LEARNING_COHORTS.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </div>
        {cohort === 'Demand 1' && <div>
          <label className="label-caps" htmlFor="stream-select">Stream</label>
          <select id="stream-select" value={stream} onChange={(event) => updateStream(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-purple">
            {LEARNING_STREAMS.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>}
      </section>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Candidates in cohort" value={stats.total} caption={cohort === 'Demand 1' ? `${cohort} · ${stream}` : cohort} icon={Users} tone="kadet" />
        <StatCard label="Started learning" value={stats.started} caption="At least one course started" icon={CirclePlay} tone="purple" />
        <StatCard label="Completed learning" value={stats.completed} caption="All 15 courses completed" icon={Trophy} tone="success" />
        <StatCard label="Average progress" value={`${stats.average}%`} caption="Across selected candidates" icon={ChartNoAxesColumnIncreasing} tone="warning" />
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:px-6">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search candidate name or ID" aria-label="Search candidates" className="h-10 w-full rounded-lg border border-line bg-white pr-3 pl-10 text-sm outline-none focus:border-purple" />
          </div>
          <label className="sr-only" htmlFor="candidate-status">Filter by learning status</label>
          <select id="candidate-status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-10 rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-purple">
            {FILTER_STATUSES.map((status) => <option key={status} value={status}>{status === 'All' ? 'All statuses' : status}</option>)}
          </select>
          <span className="text-sm text-muted">{visibleCandidates.length} candidates</span>
        </div>
        {visibleCandidates.length ? <Table columns={columns} rows={visibleCandidates} caption={`${stream} candidate learning progress`} minWidth={1260} /> : (
          <p className="p-8 text-center text-sm text-muted">No candidates match these filters.</p>
        )}
      </Card>
      <p className="mt-5 flex items-start gap-2 text-xs leading-5 text-muted"><BookOpen className="mt-0.5 size-4 shrink-0 text-purple" aria-hidden />Production learning records are not available in the current schema. Cohort, stream, course assignments, learning records, and mentor-scoped RLS would be needed to replace these simulated records.</p>
    </>
  )
}