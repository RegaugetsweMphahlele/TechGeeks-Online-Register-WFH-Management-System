import { CalendarRange, ChevronLeft, ChevronRight, ClipboardList } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { listMyCandidates } from '../../api/profiles.js'
import { getSchedule, listProgress, listReviews, listShifts } from '../../api/shifts.js'
import { CandidateCell } from '../../components/AttendanceTable.jsx'
import { ExportButton } from '../../components/Filters.jsx'
import { PageHeader } from '../../components/layout/AppLayout.jsx'
import { ProgressReportView, ReviewForm, ReviewList } from '../../components/Shifts.jsx'
import Badge from '../../components/ui/Badge.jsx'
import Button from '../../components/ui/Button.jsx'
import { Card } from '../../components/ui/Card.jsx'
import { EmptyState, ErrorState, SkeletonRows } from '../../components/ui/Feedback.jsx'
import Modal from '../../components/ui/Modal.jsx'
import { Table } from '../../components/ui/Table.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { friendlyError } from '../../lib/errors.js'
import { WEEKLY_COLUMNS } from '../../lib/reports.js'
import { expectedDays, formatMinutes, shiftFlags, weeklySummary } from '../../lib/shifts.js'
import { addDays, formatDate, formatDay, sastToday, weekStart } from '../../lib/time.js'

async function load(week) {
  const to = addDays(week, 6)
  const [candidates, shifts, schedule, reviews] = await Promise.all([
    listMyCandidates(), listShifts({ from: week, to }), getSchedule(), listReviews({ weekStart: week }),
  ])
  const days = expectedDays(week, to, { schedule })
  const rows = candidates.filter((c) => c.status === 'active').map((c) => {
    const mine = shifts.filter((s) => s.candidate_id === c.id)
    const notes = reviews.filter((r) => r.candidate_id === c.id)
    return { id: c.id, full_name: c.full_name, candidate_identifier: c.candidate_identifier, week, shifts: mine, notes,
      needsSupport: notes.some((n) => n.needs_support), ...weeklySummary(mine, days) }
  })
  return { rows, days }
}

/** Shift hours beside the progress updates for each day of the week. */
function CandidateWeek({ row, week, onClose, onSaved }) {
  const { data: reports } = useAsync(() => listProgress({ candidateId: row.id, from: week, to: addDays(week, 6) }), [row.id, week])
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i))
  return (
    <Modal open size="lg" onClose={onClose} title={row.full_name} description={`Week of ${formatDate(week)} · attendance vs submitted work`}
      footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      <div className="flex flex-col gap-5">
        <ul className="flex flex-col gap-3">
          {days.map((d) => {
            const s = row.shifts.find((x) => x.attendance_date === d)
            const rep = reports?.find((r) => r.report_date === d)
            if (!s && !rep) return null
            return (
              <li key={d} className="rounded-[10px] border border-line p-3">
                <p className="mb-1 flex flex-wrap items-center gap-2 font-semibold">
                  {formatDay(d)} <span className="text-xs font-normal text-muted">net {formatMinutes(s?.net_minutes)}</span>
                  {s && shiftFlags(s).map((f) => <Badge key={f} tone="late">{f}</Badge>)}
                </p>
                {rep ? <ProgressReportView report={rep} /> : <p className="text-xs text-muted">No progress update.</p>}
              </li>
            )
          })}
        </ul>
        {!row.shifts.length && <p className="text-xs text-muted">No shifts recorded this week.</p>}
        <div>
          <h3 className="mb-2 font-semibold">Weekly feedback</h3>
          <ReviewList reviews={row.notes} />
          <div className="mt-3"><ReviewForm candidateId={row.id} scope={{ weekStart: week }} onSaved={onSaved} /></div>
        </div>
      </div>
    </Modal>
  )
}

export default function WeeklyReview() {
  const [params, setParams] = useSearchParams()
  const week = weekStart(params.get('week') || sastToday())
  const { data, error, loading, reload } = useAsync(() => load(week), [week])
  const [open, setOpen] = useState(null)
  const go = (n) => setParams({ week: addDays(week, n) }, { replace: true })
  const isCurrent = week === weekStart(sastToday())

  const columns = [
    { key: 'c', header: 'Candidate', render: (r) => (
      <span className="flex items-center gap-2"><CandidateCell name={r.full_name} id={r.candidate_identifier} />{r.needsSupport && <Badge tone="late">Needs support</Badge>}</span>
    ) },
    { key: 'att', header: 'Attended', render: (r) => `${r.attended}/${r.scheduledDays}` },
    { key: 'done', header: 'Completed', render: (r) => r.completed },
    { key: 'late', header: 'Late', render: (r) => r.late || '—' },
    { key: 'early', header: 'Early out', render: (r) => r.early || '—' },
    { key: 'miss', header: 'No clock-in', render: (r) => r.missing || '—' },
    { key: 'inc', header: 'Incomplete', render: (r) => r.incomplete || '—' },
    { key: 'net', header: 'Net hours', render: (r) => formatMinutes(r.netMinutes) },
    { key: 'tea', header: 'Tea', render: (r) => formatMinutes(r.teaMinutes) },
    { key: 'lunch', header: 'Lunch', render: (r) => formatMinutes(r.lunchMinutes) },
    { key: 'brk', header: 'Break issues', render: (r) => r.breakIssues || '—' },
    { key: 'rep', header: 'Progress updates', render: (r) => (r.reportRate == null ? '—' : `${r.reports}/${r.attended} (${r.reportRate}%)`) },
    { key: 'go', header: <span className="sr-only">Review</span>, render: (r) => <Button size="s" variant="ghost" icon={ClipboardList} onClick={() => setOpen(r)}>Review</Button> },
  ]

  return (
    <>
      <PageHeader title="Weekly review" subtitle={`${formatDate(week)} – ${formatDate(addDays(week, 6))} · from recorded shifts only`}
        actions={<>
          <div className="flex items-center gap-1">
            <Button variant="secondary" size="s" onClick={() => go(-7)} aria-label="Previous week"><ChevronLeft className="size-4" /></Button>
            <Button variant="secondary" size="s" onClick={() => go(7)} disabled={isCurrent} aria-label="Next week"><ChevronRight className="size-4" /></Button>
          </div>
          <ExportButton kind={`weekly-attendance_${week}`} filters={{}} fetchRows={async () => data?.rows ?? []} columns={WEEKLY_COLUMNS} />
        </>} />
      <Card>
        {error ? <ErrorState message={friendlyError(error)} onRetry={reload} /> : loading && !data ? <SkeletonRows rows={6} /> :
          data.rows.length === 0 ? <EmptyState icon={CalendarRange} title="No candidates assigned" /> : (
            <div className={loading ? 'opacity-60' : ''} aria-busy={loading}>
              <Table columns={columns} rows={data.rows} caption="Weekly attendance summary" />
              <p className="border-t border-line px-6 py-3 text-xs text-muted">
                {data.days.length} expected working day{data.days.length === 1 ? '' : 's'} so far (weekdays; public holidays are not excluded).
                Days without a clock-in count as missing, never as attended.
              </p>
            </div>
          )}
      </Card>
      {open && <CandidateWeek row={open} week={week} onClose={() => setOpen(null)} onSaved={() => { setOpen(null); reload() }} />}
    </>
  )
}
