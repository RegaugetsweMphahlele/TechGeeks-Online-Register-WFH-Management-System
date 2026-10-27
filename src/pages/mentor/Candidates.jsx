import { ClipboardCheck, Laptop, Users } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { listMyCandidates } from '../../api/profiles.js'
import { CandidateCell } from '../../components/AttendanceTable.jsx'
import CohortStreamFilters from '../../components/CohortStreamFilters.jsx'
import { FilterBar, SearchField, useUrlFilters } from '../../components/Filters.jsx'
import { PageHeader } from '../../components/layout/AppLayout.jsx'
import Badge from '../../components/ui/Badge.jsx'
import Button from '../../components/ui/Button.jsx'
import { Card } from '../../components/ui/Card.jsx'
import { EmptyState, ErrorState, SkeletonRows } from '../../components/ui/Feedback.jsx'
import { Table } from '../../components/ui/Table.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { friendlyError } from '../../lib/errors.js'
import { formatDate } from '../../lib/time.js'

export default function Candidates() {
  const { data, error, loading, reload } = useAsync(listMyCandidates, [])
  const [params, setParams] = useSearchParams()
  const f = useUrlFilters(params, setParams, ['search', 'cohort', 'stream'])
  const search = f.filters.search ?? ''
  const q = search.trim().toLowerCase()
  const rows = (data ?? []).filter((c) =>
    (!f.filters.cohort || c.cohort === f.filters.cohort) &&
    (!f.filters.stream || c.stream === f.filters.stream) &&
    (!q || `${c.full_name} ${c.candidate_identifier ?? ''} ${c.email}`.toLowerCase().includes(q)))

  const columns = [
    { key: 'name', header: 'Candidate', render: (c) => <CandidateCell name={c.full_name} id={c.candidate_identifier} /> },
    { key: 'email', header: 'Email', className: 'wrap-anywhere', render: (c) => <a className="text-muted hover:text-purple" href={`mailto:${c.email}`}>{c.email}</a> },
    { key: 'cohort', header: 'Cohort', render: (c) => c.cohort ?? '—' },
    { key: 'stream', header: 'Stream', render: (c) => c.stream ?? '—' },
    { key: 'since', header: 'Joined', render: (c) => formatDate(c.created_at) },
    { key: 'status', header: 'Account', render: (c) => <Badge tone={c.status === 'active' ? 'approved' : 'neutral'}>{c.status === 'active' ? 'Active' : 'Inactive'}</Badge> },
    { key: 'act', header: <span className="sr-only">Records</span>, className: 'text-right whitespace-nowrap', render: (c) => (
      <span className="inline-flex gap-1">
        <Button size="s" variant="ghost" icon={ClipboardCheck} to={`/mentor/attendance?candidate=${c.id}`} aria-label={`${c.full_name}'s attendance`}>Attendance</Button>
        <Button size="s" variant="ghost" icon={Laptop} to={`/mentor/wfh?search=${encodeURIComponent(c.full_name)}`} aria-label={`${c.full_name}'s WFH requests`}>WFH</Button>
      </span>
    ) },
  ]

  return (
    <>
      <PageHeader title="Candidates" subtitle="Candidates assigned to you." />
      <Card>
        <FilterBar active={f.active} onClear={f.clear}>
          <SearchField value={search} onChange={(value) => f.set({ search: value })} placeholder="Search by name, ID or email" />
          <CohortStreamFilters cohort={f.filters.cohort} stream={f.filters.stream} onChange={f.set} />
        </FilterBar>
        {error ? <ErrorState message={friendlyError(error)} onRetry={reload} /> : loading && !data ? <SkeletonRows rows={6} /> :
          rows.length === 0 ? (
            <EmptyState icon={Users} title={f.active ? 'No candidates match these filters' : 'No candidates assigned yet'}>
              {!f.active && 'CAPACITI will assign candidates to you.'}
            </EmptyState>
          ) : <Table columns={columns} rows={rows} caption="Assigned candidates" minWidth={920} />}
      </Card>
    </>
  )
}
