import { CalendarClock, CheckCircle2, Clock, Coffee, Hourglass, LogOut, NotebookPen, Timer, Utensils } from 'lucide-react'
import { useRef, useState } from 'react'
import { checkOut, getToday } from '../../api/attendance.js'
import { endBreak, getSchedule, listCorrections, listProgress, listShifts, startBreak } from '../../api/shifts.js'
import { getWfhForDate } from '../../api/wfh.js'
import { useAuth } from '../../auth/AuthProvider.jsx'
import CheckInForm from '../../components/CheckInForm.jsx'
import { PageHeader } from '../../components/layout/AppLayout.jsx'
import { BreakSummary, CorrectionList, ProgressReportForm, ShiftTimeline } from '../../components/Shifts.jsx'
import { useToast } from '../../components/Toast.jsx'
import Badge from '../../components/ui/Badge.jsx'
import Button from '../../components/ui/Button.jsx'
import { Card, CardHeader, StatCard } from '../../components/ui/Card.jsx'
import { Alert, EmptyState, ErrorState, SkeletonRows } from '../../components/ui/Feedback.jsx'
import Modal, { ModalIcon } from '../../components/ui/Modal.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { useNow, useRefresh } from '../../hooks/useNow.js'
import { friendlyError } from '../../lib/errors.js'
import { formatMinutes, nowHm, offScheduleWarning, punctuality, scheduledMinutes, scheduleRange, shiftActions, shiftFlags, shiftState, shiftTotals, remainingMinutes } from '../../lib/shifts.js'
import { addDays, formatDay, formatFullDate, formatTime, sastToday } from '../../lib/time.js'

const ACTIONS = {
  clock_out: { label: 'Clock Out', icon: LogOut, done: 'Clocked out' },
  start_tea: { label: 'Start Tea Break', icon: Coffee, done: 'Tea break started' },
  end_tea: { label: 'End Tea Break', icon: Coffee, done: 'Welcome back — tea break ended' },
  start_lunch: { label: 'Start Lunch Break', icon: Utensils, done: 'Lunch break started' },
  end_lunch: { label: 'End Lunch Break', icon: Utensils, done: 'Welcome back — lunch ended' },
}

async function load(uid) {
  const today = sastToday()
  const [schedule, row, wfh, recent, reports, corrections] = await Promise.all([
    getSchedule(), getToday(uid), getWfhForDate(uid, today),
    listShifts({ candidateId: uid, from: addDays(today, -13), to: addDays(today, -1) }),
    listProgress({ candidateId: uid, from: today, to: today }),
    listCorrections(uid, { from: today, to: today }),
  ])
  return { schedule, row, wfh, recent, report: reports[0] ?? null, corrections }
}

function headline(row, schedule) {
  if (!row) return ['Clock in to start your shift', `Your shift is scheduled for ${scheduleRange(schedule, 'workday')}.`]
  const since = `Clocked in at ${formatTime(row.check_in_at)} (scheduled ${formatTime(row.scheduled_start)})`
  if (row.shift_status === 'clocked_out') return ['Shift complete', `${since} · clocked out at ${formatTime(row.check_out_at)}`]
  if (row.shift_status === 'on_break') return [`You're on your ${row.open_break} break`, `Started at ${formatTime(row[`${row.open_break}_started_at`])}. End it when you're back at work.`]
  return ["You're working", since]
}

export default function Shifts() {
  const { profile } = useAuth()
  const toast = useToast()
  const today = sastToday()
  const now = useNow()
  const { data, error, loading, reload } = useAsync(() => load(profile.id), [profile.id])
  useRefresh(reload)
  const [busy, setBusy] = useState(null)
  const [confirm, setConfirm] = useState(null) // { action, warning }
  const [promptReport, setPromptReport] = useState(false)
  const reportRef = useRef(null)

  async function execute(action) {
    setBusy(action)
    try {
      const rec = action === 'clock_out' ? await checkOut() : action.startsWith('start_') ? await startBreak(action.slice(6)) : await endBreak()
      const at = rec.check_out_at ?? rec.ended_at ?? rec.started_at
      toast('success', ACTIONS[action].done, `Recorded at ${formatTime(at)} (server time).`)
      if (action === 'clock_out') setPromptReport(true)
    } catch (err) {
      toast('error', `Couldn't ${ACTIONS[action].label.toLowerCase()}`, friendlyError(err))
    } finally {
      setBusy(null)
      setConfirm(null)
      reload() // always show the real server state
    }
  }

  function press(action) {
    if (busy) return // a second click never sends a second request
    const warning = offScheduleWarning(action, data.schedule, nowHm(now))
    if (action === 'clock_out' || warning) setConfirm({ action, warning })
    else execute(action)
  }

  const goToReport = () => { setPromptReport(false); reportRef.current?.scrollIntoView({ behavior: 'smooth' }) }

  if (error) return <><PageHeader title="Shifts" /><Card><ErrorState message={friendlyError(error)} onRetry={reload} /></Card></>
  if (loading && !data) return <><PageHeader title="Shifts" subtitle={formatFullDate(today)} /><Card><SkeletonRows rows={5} /></Card></>

  const { schedule, row, report } = data
  const plan = scheduledMinutes(schedule)
  const actions = shiftActions(row, schedule, nowHm(now))
  const state = shiftState(row, { schedule, nowTime: nowHm(now) })
  const totals = row && shiftTotals(row, now)
  const flags = row ? shiftFlags(row, today, { schedule, now }) : []
  const [title, sub] = headline(row, schedule)
  const Primary = actions.primary && actions.primary !== 'clock_in' && ACTIONS[actions.primary]

  return (
    <>
      <PageHeader title="Shifts" subtitle={`${formatFullDate(today)} · Scheduled ${scheduleRange(schedule, 'workday')} (South African time)`} />
      <div className="flex flex-col gap-6">
        <Card className="flex flex-col gap-5 p-6 lg:flex-row lg:items-center">
          <span className="grid size-[52px] shrink-0 place-items-center rounded-[14px] bg-purple-tint text-purple"><Timer className="size-7" aria-hidden /></span>
          <div className="min-w-0 flex-1" aria-live="polite">
            <div className="mb-1 flex flex-wrap gap-2">
              <Badge tone={state.tone}>{state.label}</Badge>
              {row && (() => { const p = punctuality(row); return <Badge tone={p.tone}>{p.label}</Badge> })()}
              {row?.corrected && <Badge tone="pending">Corrected by staff</Badge>}
            </div>
            <p className="text-lg leading-[26px] font-semibold">{title}</p>
            <p className="text-xs text-muted">{sub}</p>
          </div>
          {Primary && (
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:justify-end">
              <Button icon={Primary.icon} loading={busy === actions.primary} disabled={Boolean(busy)} onClick={() => press(actions.primary)} className="h-12 px-6 text-base">
                {Primary.label}
              </Button>
              {actions.others.map((a) => (
                <Button key={a} variant="secondary" icon={ACTIONS[a].icon} loading={busy === a} disabled={Boolean(busy)} onClick={() => press(a)}>{ACTIONS[a].label}</Button>
              ))}
            </div>
          )}
        </Card>

        {flags.length > 0 && (
          <Alert type="warning" title="Flagged for your Tech Champion's review">
            {flags.join(' · ')}. These are automatic flags, not warnings — your Tech Champion reviews them.
          </Alert>
        )}
        {data.corrections.length > 0 && <CorrectionList corrections={data.corrections} />}

        {!row ? (
          <Card className="p-6"><CheckInForm wfh={data.wfh} title="Clock in" submitLabel="Clock In" onFailed={reload}
            onDone={() => { toast('success', 'Clocked in', 'Your shift has started.'); reload() }} /></Card>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Elapsed shift time" icon={Clock} value={formatMinutes(totals.elapsed)}
                caption={totals.final ? 'Clock-in to clock-out' : `So far · scheduled ${formatMinutes(plan.elapsed)}`} />
              <StatCard label="Time on breaks" icon={Coffee} tone="warning" value={formatMinutes(totals.breaks)}
                caption={`${totals.final ? 'Completed breaks' : 'So far'} · allowed ${formatMinutes(plan.tea + plan.lunch)}`} />
              <StatCard label="Net working time" icon={CheckCircle2} tone="success" value={formatMinutes(totals.net)}
                caption={`${totals.final ? 'Final' : 'So far'} · scheduled ${formatMinutes(plan.net)}`} />
              <StatCard label="Remaining scheduled time" icon={Hourglass} tone="kadet" value={row.check_out_at ? '—' : formatMinutes(remainingMinutes(row, now))}
                caption={`Until scheduled clock-out at ${formatTime(row.scheduled_end)}`} />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card aria-labelledby="tl">
                <CardHeader id="tl" title="Today's timeline" subtitle="Scheduled times beside what was actually recorded" />
                <div className="px-5 pb-5"><ShiftTimeline row={row} schedule={schedule} /></div>
              </Card>
              <div className="flex flex-col gap-6">
                <Card aria-labelledby="brk">
                  <CardHeader id="brk" title="Breaks" subtitle="Start and end each break yourself; durations come from the recorded times" />
                  <div className="flex flex-col gap-3 px-5 pb-5">
                    <BreakSummary row={row} type="tea" schedule={schedule} now={now} />
                    <BreakSummary row={row} type="lunch" schedule={schedule} now={now} />
                  </div>
                </Card>
                <Card aria-labelledby="rep" ref={reportRef}>
                  <CardHeader id="rep" title="Daily progress update" subtitle="Saved separately — your shift is recorded either way" />
                  <div className="px-5 pb-5">
                    {row.check_out_at || report
                      ? <ProgressReportForm key={report?.updated_at ?? 'new'} report={report} onSaved={reload} />
                      : <EmptyState icon={NotebookPen} title="After you clock out">You'll be asked for your tasks, learning, deliverables, challenges and plans for tomorrow.</EmptyState>}
                  </div>
                </Card>
              </div>
            </div>
          </>
        )}

        <Card aria-labelledby="recent-shifts">
          <CardHeader id="recent-shifts" title="Recent shifts" subtitle="Last two weeks" actionTo="/candidate/attendance" />
          {data.recent.length === 0 ? <EmptyState icon={CalendarClock} title="No earlier shifts yet" /> : (
            <ul className="px-5 pb-3">
              {data.recent.map((r) => {
                const s = shiftState(r)
                const f = shiftFlags(r, today)
                return (
                  <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line py-2.5">
                    <span className="w-28 font-medium">{formatDay(r.attendance_date)}</span>
                    <span className="text-xs text-muted">{formatTime(r.check_in_at)} – {r.check_out_at ? formatTime(r.check_out_at) : '…'}</span>
                    <span className="text-xs">Net {formatMinutes(r.net_minutes)}</span>
                    <span className="flex-1" />
                    {f.length > 0 && <span className="text-xs text-warning">{f.length} flag{f.length > 1 ? 's' : ''}</span>}
                    <Badge tone={s.tone}>{s.label}</Badge>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>

      <Modal open={Boolean(confirm)} onClose={() => !busy && setConfirm(null)} icon={<ModalIcon icon={confirm ? ACTIONS[confirm.action].icon : Timer} tone="purple" />}
        title={confirm ? `${ACTIONS[confirm.action].label}?` : ''}
        description={confirm?.warning ?? (confirm?.action === 'clock_out' ? 'You can only clock out once per day, and breaks cannot be added afterwards.' : '')}
        footer={<><Button variant="secondary" onClick={() => setConfirm(null)} disabled={Boolean(busy)}>Cancel</Button>
          <Button loading={Boolean(busy)} onClick={() => execute(confirm.action)}>{confirm && ACTIONS[confirm.action].label}</Button></>} />

      <Modal open={promptReport} onClose={() => setPromptReport(false)} icon={<ModalIcon icon={CheckCircle2} />} title="Shift complete"
        description="Your attendance is saved. Now submit your daily progress update for your Tech Champion."
        footer={<><Button variant="secondary" onClick={() => setPromptReport(false)}>Later</Button><Button icon={NotebookPen} onClick={goToReport}>Write update</Button></>} />
    </>
  )
}
