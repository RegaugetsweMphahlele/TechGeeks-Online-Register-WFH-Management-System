import { AlarmClockOff, CalendarCheck, ChevronRight, Clock, Coffee, Timer, UserX } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { listMyCandidates } from '../../api/profiles.js'
import { getSchedule, listShifts } from '../../api/shifts.js'
import { CandidateCell } from '../../components/AttendanceTable.jsx'
import { ExportButton, FilterBar, FilterSelect, useUrlFilters } from '../../components/Filters.jsx'
import { PageHeader } from '../../components/layout/AppLayout.jsx'
import Badge from '../../components/ui/Badge.jsx'
import Button from '../../components/ui/Button.jsx'
import { Card, StatCard } from '../../components/ui/Card.jsx'
import { EmptyState, ErrorState, SkeletonRows } from '../../components/ui/Feedback.jsx'
import { Table } from '../../components/ui/Table.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { useNow, useRefresh } from '../../hooks/useNow.js'
import { friendlyError } from '../../lib/errors.js'
import { SHIFT_COLUMNS } from '../../lib/reports.js'
import { BREAK_FLAGS, buildDay, formatMinutes, punctuality, scheduleRange } from '../../lib/shifts.js'
import { formatFullDate, formatTime, isWeekend, sastToday } from '../../lib/time.js'

const STATUS_OPTIONS = [['working', 'Working'], ['on_break', 'On break'], ['clocked_out', 'Clocked out'], ['incomplete', 'Incomplete'], ['absent', 'No clock-in']]
const FLAG_OPTIONS = [['late', 'Late arrivals'], ['incomplete', 'Incomplete shifts'], ['breaks', 'Break exceptions'], ['early', 'Early departures'], ['report', 'No progress update']]
const FLAG_TEST = {
  late: (r) => r.row?.late,
  incomplete: (r) => r.row?.shift_status === 'incomplete' || r.row?.break_incomplete,
  breaks: (r) => r.flags.some((f) => BREAK_FLAGS.includes(f) || f.endsWith('running over')),
  early: (r) => r.row?.early_departure,
  report: (r) => r.flags.includes('No progress update'),
}

export default function MentorShifts() {
  const [params, setParams] = useSearchParams()
  const f = useUrlFilters(params, setParams, ['date', 'candidate', 'status', 'flag'])
  const date = f.filters.date ?? sastToday()
  const now = useNow(60000)
  const { data, error, loading, reload } = useAsync(
    () => Promise.all([listMyCandidates(), listShifts({ from: date, to: date }), getSchedule()])
      .then(([candidates, shifts, schedule]) => ({ candidates, shifts, schedule })),
    [date],
  )
  useRefresh(reload, 60000)

  const day = data ? buildDay(data.candidates, data.shifts, { date, schedule: data.schedule, now }) : []
  const rows = day.filter((r) =>
    (!f.filters.candidate || r.id === f.filters.candidate) &&
    (!f.filters.status || (f.filters.status === 'absent' ? !r.row : r.row?.shift_status === f.filters.status)) &&
    (!f.filters.flag || FLAG_TEST[f.filters.flag](r)))
  const count = (p) => day.filter(p).length

  const columns = [
    { key: 'c', header: 'Candidate', render: (r) => <CandidateCell name={r.candidate.full_name} id={r.candidate.candidate_identifier} /> },
    { key: 'sched', header: 'Scheduled', render: (r) => r.row ? `${formatTime(r.row.scheduled_start)}–${formatTime(r.row.scheduled_end)}` : scheduleRange(data.schedule, 'workday') },
    { key: 'in', header: 'Clock in', render: (r) => formatTime(r.row?.check_in_at) },
    { key: 'out', header: 'Clock out', render: (r) => formatTime(r.row?.check_out_at) },
    { key: 'status', header: 'Status', render: (r) => (
      <span className="flex flex-wrap gap-1.5">
        <Badge tone={r.state.tone}>{r.state.label}</Badge>
        {r.row && (() => { const p = punctuality(r.row); return <Badge tone={p.tone}>{p.label}</Badge> })()}
      </span>
    ) },
    { key: 'net', header: 'Net work', render: (r) => formatMinutes(r.row?.net_minutes) },
    { key: 'tea', header: 'Tea', render: (r) => formatMinutes(r.row?.tea_minutes) },
    { key: 'lunch', header: 'Lunch', render: (r) => formatMinutes(r.row?.lunch_minutes) },
    { key: 'flags', header: 'Exceptions', render: (r) => r.flags.length
      ? <span className="flex max-w-64 flex-wrap gap-1">{r.flags.map((x) => <Badge key={x} tone="late">{x}</Badge>)}</span>
      : <span className="text-xs text-muted">None</span> },
    { key: 'rep', header: 'Progress', render: (r) => !r.row ? '—' : r.row.report_submitted ? <Badge tone="approved">Submitted</Badge> : <Badge tone="missing">Not yet</Badge> },
    { key: 'go', header: <span className="sr-only">Open</span>, render: (r) => (
      <Button size="s" variant="ghost" to={`/mentor/shifts/${r.id}?date=${date}`} aria-label={`Open ${r.candidate.full_name}'s shift`}>
        Details <ChevronRight className="size-4" aria-hidden />
      </Button>
    ) },
  ]

  return (
    <>
      <PageHeader title="Shifts" subtitle={`${formatFullDate(date)} · live clock-ins, breaks and exceptions for your candidates.`}
        actions={<>
          <Button variant="secondary" icon={CalendarCheck} to="/mentor/weekly-review">Weekly review</Button>
          <ExportButton kind="shifts" filters={{ from: date, to: date }} fetchRows={listShifts} columns={SHIFT_COLUMNS} />
        </>} />
      {error ? <Card><ErrorState message={friendlyError(error)} onRetry={reload} /></Card> : (
        <div className="flex flex-col gap-6">
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Clocked in" icon={Clock} loading={!data} value={data && `${count((r) => r.row)}/${day.length}`}
              caption={data ? `${count((r) => r.row?.shift_status === 'on_break')} on break now` : '…'} />
            <StatCard label="No clock-in" icon={UserX} tone="error" loading={!data} value={count((r) => !r.row && r.state.tone === 'rejected')}
              caption={isWeekend(date) ? 'Weekend' : 'After scheduled start'} />
            <StatCard label="Late arrivals" icon={AlarmClockOff} tone="warning" loading={!data} value={count((r) => r.row?.late)} caption="Flagged for review" />
            <StatCard label="Break exceptions" icon={Coffee} tone="kadet" loading={!data} value={count(FLAG_TEST.breaks)}
              caption={`${count(FLAG_TEST.incomplete)} incomplete shift${count(FLAG_TEST.incomplete) === 1 ? '' : 's'}`} />
          </div>
          <Card>
            <FilterBar active={f.active} onClear={f.clear}>
              <label className="block min-w-[170px] flex-1 sm:flex-none">
                <span className="sr-only">Working date</span>
                <input type="date" value={date} max={sastToday()} onChange={(e) => f.set({ date: e.target.value || undefined })}
                  className="h-11 w-full rounded-lg border border-line-strong bg-white px-3 text-sm focus:border-[1.5px] focus:border-purple focus:ring-3 focus:ring-purple/15 focus:outline-none" />
              </label>
              <FilterSelect label="Candidate" value={f.filters.candidate} onChange={(candidate) => f.set({ candidate })}
                options={(data?.candidates ?? []).map((c) => [c.id, c.full_name])} />
              <FilterSelect label="Status" value={f.filters.status} onChange={(status) => f.set({ status })} options={STATUS_OPTIONS} />
              <FilterSelect label="Exception" value={f.filters.flag} onChange={(flag) => f.set({ flag })} options={FLAG_OPTIONS} />
            </FilterBar>
            {loading && !data ? <SkeletonRows rows={6} /> : rows.length === 0 ? (
              <EmptyState icon={Timer} title={day.length ? 'No candidates match these filters' : 'No candidates assigned'}
                action={f.active && <Button variant="secondary" size="s" onClick={f.clear}>Clear filters</Button>} />
            ) : (
              <div className={loading ? 'opacity-60' : ''} aria-busy={loading}>
                <Table columns={columns} rows={rows} caption="Shifts for the selected date" />
              </div>
            )}
          </Card>
          <p className="text-xs text-muted">Exceptions are detected automatically from recorded times and are for your review — they are not confirmed policy violations.</p>
        </div>
      )}
    </>
  )
}
