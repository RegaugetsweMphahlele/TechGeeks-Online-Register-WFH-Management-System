import { ArrowLeft, Coffee, History, NotebookPen, PencilLine } from 'lucide-react'
import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { getProfile } from '../../api/profiles.js'
import { correctBreak, correctShift, getSchedule, listCorrections, listProgress, listReviews, listShifts } from '../../api/shifts.js'
import { PageHeader } from '../../components/layout/AppLayout.jsx'
import { BreakSummary, CorrectionList, ProgressReportView, ReviewForm, ReviewList, ShiftTimeline } from '../../components/Shifts.jsx'
import { useToast } from '../../components/Toast.jsx'
import Badge, { ModeBadge } from '../../components/ui/Badge.jsx'
import Button from '../../components/ui/Button.jsx'
import { Card, CardHeader } from '../../components/ui/Card.jsx'
import { Alert, EmptyState, ErrorState, SkeletonRows } from '../../components/ui/Feedback.jsx'
import { Input, Select, Textarea } from '../../components/ui/Field.jsx'
import Modal from '../../components/ui/Modal.jsx'
import { Table } from '../../components/ui/Table.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { useNow } from '../../hooks/useNow.js'
import { friendlyError } from '../../lib/errors.js'
import { formatMinutes, punctuality, shiftFlags, shiftState, shiftTotals } from '../../lib/shifts.js'
import { addDays, formatDayLong, formatFullDate, formatTime, sastToday } from '../../lib/time.js'

// SAST has no daylight saving, so a wall-clock time on a date is always +02:00.
const sastIso = (date, hhmm) => (hhmm ? `${date}T${hhmm}:00+02:00` : null)

async function load(candidateId, date) {
  const [candidate, schedule, history, corrections, reports, reviews] = await Promise.all([
    getProfile(candidateId), getSchedule(),
    listShifts({ candidateId, from: addDays(date, -27), to: date }),
    listCorrections(candidateId, { from: date, to: date }),
    listProgress({ candidateId, from: date, to: date }),
    listReviews({ candidateId, workDate: date }),
  ])
  return { candidate, schedule, history, row: history.find((r) => r.attendance_date === date) ?? null, corrections, report: reports[0] ?? null, reviews }
}

function CorrectionModal({ kind, row, date, candidateId, onClose, onSaved }) {
  const toast = useToast()
  const [f, setF] = useState(() => kind === 'shift'
    ? { in: row ? formatTime(row.check_in_at) : '', out: row?.check_out_at ? formatTime(row.check_out_at) : '', mode: row?.work_mode ?? '', reason: '' }
    : { type: row?.open_break ?? 'tea', in: '', out: '', reason: '' })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))

  async function save() {
    setBusy(true)
    setError(null)
    try {
      if (kind === 'shift') await correctShift({ candidateId, date, checkInAt: sastIso(date, f.in), checkOutAt: sastIso(date, f.out), reason: f.reason, workMode: f.mode })
      else await correctBreak({ attendanceId: row.id, type: f.type, startedAt: sastIso(date, f.in), endedAt: sastIso(date, f.out), reason: f.reason })
      toast('success', 'Correction saved', 'The original values are kept in the audit trail and the candidate has been notified.')
      onSaved()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} size="lg" title={kind === 'shift' ? (row ? 'Correct shift times' : 'Record a missed shift') : 'Resolve a break'}
      description={`${formatFullDate(date)} · times in South African time. Corrections never replace the audit trail.`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={save}>Save correction</Button></>}>
      <div className="flex flex-col gap-4">
        {error && <Alert type="error" title={error} />}
        {kind === 'break' && (
          <Select label="Break" required value={f.type} onChange={set('type')}>
            <option value="tea">Tea</option><option value="lunch">Lunch</option>
          </Select>
        )}
        {kind === 'shift' && !row && (
          <Select label="Work mode" required value={f.mode} onChange={set('mode')}>
            <option value="" disabled>Select</option><option value="office">Office</option><option value="wfh">Working From Home</option>
          </Select>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input type="time" required label={kind === 'shift' ? 'Clock-in' : 'Break started'} value={f.in} onChange={set('in')} />
          <Input type="time" required={kind === 'break'} label={kind === 'shift' ? 'Clock-out' : 'Break ended'} value={f.out} onChange={set('out')}
            hint={kind === 'shift' ? 'Leave empty to keep the shift open (today only)' : undefined} />
        </div>
        <Textarea label="Reason for correction" required rows={3} maxLength={1000} value={f.reason} onChange={set('reason')}
          placeholder="e.g. Candidate confirmed by phone they finished at 16:00" hint="Shown to the candidate and kept with the record." />
      </div>
    </Modal>
  )
}

export default function ShiftDetail() {
  const { candidateId } = useParams()
  const [params, setParams] = useSearchParams()
  const date = params.get('date') || sastToday()
  const { data, error, loading, reload } = useAsync(() => load(candidateId, date), [candidateId, date])
  const [modal, setModal] = useState(null) // 'shift' | 'break'
  const now = useNow(60000)
  const setDate = (d) => setParams(d ? { date: d } : {}, { replace: true })

  const back = <Button variant="secondary" icon={ArrowLeft} to={`/mentor/shifts?date=${date}`}>All shifts</Button>
  if (error) return <><PageHeader title="Candidate shifts" actions={back} /><Card><ErrorState message={friendlyError(error)} onRetry={reload} /></Card></>
  if (loading && !data) return <><PageHeader title="Candidate shifts" actions={back} /><Card><SkeletonRows rows={6} /></Card></>

  const { candidate, schedule, row } = data
  const state = shiftState(row, { date, schedule })
  const flags = row ? shiftFlags(row, sastToday(), { schedule, now }) : []
  const totals = row && shiftTotals(row, now)

  return (
    <>
      <PageHeader title={candidate.full_name} subtitle={`${candidate.candidate_identifier ?? 'Candidate'} · ${formatFullDate(date)}`} actions={back} />
      <div className="flex flex-col gap-6">
        <Card className="flex flex-col gap-4 p-5 md:flex-row md:items-center">
          <label className="flex items-center gap-2 text-sm font-medium">
            Working date
            <input type="date" value={date} max={sastToday()} onChange={(e) => setDate(e.target.value)}
              className="h-11 rounded-lg border border-line-strong bg-white px-3 focus:border-purple focus:outline-none" />
          </label>
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <Badge tone={state.tone}>{state.label}</Badge>
            {row && (() => { const p = punctuality(row); return <Badge tone={p.tone}>{p.label}</Badge> })()}
            {row && <ModeBadge mode={row.work_mode} />}
            {row?.corrected && <Badge tone="pending">Corrected</Badge>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="s" variant="secondary" icon={PencilLine} onClick={() => setModal('shift')}>{row ? 'Correct shift' : 'Record missed shift'}</Button>
            {row && <Button size="s" variant="secondary" icon={Coffee} onClick={() => setModal('break')}>Resolve break</Button>}
          </div>
        </Card>

        {flags.length > 0 && <Alert type="warning" title="Detected exceptions (for review)">{flags.join(' · ')}</Alert>}
        <CorrectionList corrections={data.corrections} />

        <div className="grid gap-6 lg:grid-cols-2">
          <Card aria-labelledby="tl">
            <CardHeader id="tl" title="Shift timeline" subtitle={row ? `Net ${formatMinutes(totals.net)}${totals.final ? '' : ' so far'} · breaks ${formatMinutes(totals.breaks)} · elapsed ${formatMinutes(totals.elapsed)}` : 'No clock-in recorded for this date'} />
            <div className="px-5 pb-5">
              <ShiftTimeline row={row} schedule={schedule} />
              {row && <div className="mt-4 flex flex-col gap-3">
                <BreakSummary row={row} type="tea" schedule={schedule} now={now} />
                <BreakSummary row={row} type="lunch" schedule={schedule} now={now} />
              </div>}
            </div>
          </Card>
          <div className="flex flex-col gap-6">
            <Card aria-labelledby="prog">
              <CardHeader id="prog" title="Daily progress update" subtitle="Compare with the hours recorded" />
              <div className="px-5 pb-5">
                {data.report ? <ProgressReportView report={data.report} />
                  : <EmptyState icon={NotebookPen} title="Not submitted">{row ? 'No progress update for this date yet.' : 'No shift recorded for this date.'}</EmptyState>}
              </div>
            </Card>
            <Card aria-labelledby="notes">
              <CardHeader id="notes" title="Review notes & follow-up" subtitle="Visible to Tech Champions only" />
              <div className="flex flex-col gap-4 px-5 pb-5">
                <ReviewList reviews={data.reviews} />
                <ReviewForm candidateId={candidateId} scope={{ workDate: date }} onSaved={reload} />
              </div>
            </Card>
          </div>
        </div>

        <Card aria-labelledby="hist">
          <CardHeader id="hist" title="Attendance history" subtitle="Last four weeks of recorded shifts · select a day to open it" />
          {data.history.length === 0 ? <EmptyState icon={History} title="No shifts recorded" /> : (
            <Table caption="Shift history" rows={data.history} onRowClick={(r) => setDate(r.attendance_date)} columns={[
              { key: 'd', header: 'Date', className: 'whitespace-nowrap', render: (r) => <span className={r.attendance_date === date ? 'font-semibold text-purple' : ''}>{formatDayLong(r.attendance_date)}</span> },
              { key: 'in', header: 'In', render: (r) => formatTime(r.check_in_at) },
              { key: 'out', header: 'Out', render: (r) => formatTime(r.check_out_at) },
              { key: 'net', header: 'Net', render: (r) => formatMinutes(r.net_minutes) },
              { key: 's', header: 'Status', render: (r) => { const s = shiftState(r); return <Badge tone={s.tone}>{s.label}</Badge> } },
              { key: 'f', header: 'Exceptions', render: (r) => shiftFlags(r).join(', ') || '—' },
              { key: 'r', header: 'Progress', render: (r) => (r.report_submitted ? 'Submitted' : '—') },
            ]} />
          )}
        </Card>
      </div>
      {modal && <CorrectionModal kind={modal} row={row} date={date} candidateId={candidateId} onClose={() => setModal(null)}
        onSaved={() => { setModal(null); reload() }} />}
    </>
  )
}
