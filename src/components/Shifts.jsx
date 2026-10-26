import { CheckCircle2, Coffee, MessageSquarePlus, PencilLine, Utensils } from 'lucide-react'
import { useState } from 'react'
import { addReview, submitProgress } from '../api/shifts.js'
import { friendlyError } from '../lib/errors.js'
import { BREAK_LABEL, formatMinutes, scheduleRange, timeline } from '../lib/shifts.js'
import { formatDateTime, formatTime } from '../lib/time.js'
import { useToast } from './Toast.jsx'
import Badge from './ui/Badge.jsx'
import Button from './ui/Button.jsx'
import { Alert } from './ui/Feedback.jsx'
import { Input, Select, Textarea } from './ui/Field.jsx'

const toMin = (hm) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5))

/** Scheduled vs actual. Actual times are recorded events only; nothing is filled in from the schedule. */
export function ShiftTimeline({ row, schedule }) {
  const closed = row && (row.check_out_at || row.shift_status === 'incomplete')
  return (
    <ol className="flex flex-col" aria-label="Shift timeline">
      {timeline(row, schedule).map((it) => {
        if (it.kind === 'session')
          return (
            <li key={it.key} className="ml-[7px] border-l-2 border-dashed border-line py-2 pl-5 text-xs text-muted">
              {it.label} <span className="whitespace-nowrap">· {it.scheduled}</span>
            </li>
          )
        const actual = it.actual && formatTime(it.actual)
        const diff = actual ? toMin(actual) - toMin(it.scheduled) : 0
        const ongoing = !it.actual && ((it.key === 'tea-end' && row?.open_break === 'tea') || (it.key === 'lunch-end' && row?.open_break === 'lunch'))
        return (
          <li key={it.key} className="flex items-start gap-3 py-1.5">
            <span aria-hidden className={`mt-1 size-4 shrink-0 rounded-full border-2 ${it.actual ? 'border-purple bg-purple' : 'border-line-strong bg-white'}`} />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{it.label}</p>
              <p className="text-xs text-muted">Scheduled {it.scheduled}</p>
            </div>
            <div className="text-right">
              {actual ? <p className="font-semibold tabular-nums">{actual}</p>
                : <p className="text-xs text-muted">{ongoing ? 'In progress' : closed ? 'Not recorded' : '—'}</p>}
              {actual && diff !== 0 && (
                <p className={`text-[11px] ${diff > 0 ? 'text-warning' : 'text-muted'}`}>{diff > 0 ? `+${formatMinutes(diff)}` : `−${formatMinutes(-diff)}`} vs schedule</p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/** One break's status vs its allowance. */
export function BreakSummary({ row, type, schedule, now }) {
  const Icon = type === 'tea' ? Coffee : Utensils
  const start = row?.[`${type}_started_at`], end = row?.[`${type}_ended_at`]
  const allowed = toMin(schedule[`${type}_end`].slice(0, 5)) - toMin(schedule[`${type}_start`].slice(0, 5))
  const running = start && !end ? (now - new Date(start)) / 6e4 : null
  const status = !start
    ? row?.[`${type}_missed`] ? <Badge tone="late">Not taken</Badge> : <Badge tone="missing">Not started</Badge>
    : !end ? <Badge tone="pending">In progress</Badge>
      : row[`${type}_excessive`] ? <Badge tone="late">Over allowance</Badge> : <Badge tone="approved">Completed</Badge>
  return (
    <div className="flex items-start gap-3 rounded-[10px] bg-bg p-4">
      <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-white text-purple"><Icon className="size-5" aria-hidden /></span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold">{BREAK_LABEL[type]} break</p>{status}
        </div>
        <p className="text-xs text-muted">Scheduled {scheduleRange(schedule, type)} · allowance {formatMinutes(allowed)}</p>
        {start && (
          <p className="mt-1 text-xs">
            {formatTime(start)} – {end ? formatTime(end) : '…'} ·{' '}
            {end ? <strong>{formatMinutes(row[`${type}_minutes`])}</strong>
              : <span className={running > allowed ? 'font-semibold text-error' : ''}>{formatMinutes(running)} so far</span>}
          </p>
        )}
      </div>
    </div>
  )
}

const REPORT_FIELDS = [
  ['tasks_completed', 'Tasks completed', true],
  ['learning', 'Learning activities completed'],
  ['deliverables', 'Deliverables submitted'],
  ['challenges', 'Challenges encountered'],
  ['support_needed', 'Support required'],
  ['next_day_plan', 'Plans for the next working day'],
]

export function ProgressReportView({ report }) {
  return (
    <dl className="flex flex-col gap-3">
      {REPORT_FIELDS.map(([k, label]) => (
        <div key={k}>
          <dt className="label-caps">{label}</dt>
          <dd className="whitespace-pre-wrap">{report[k] || <span className="text-muted">—</span>}</dd>
        </div>
      ))}
      <p className="text-xs text-muted">Submitted {formatDateTime(report.submitted_at)}{report.updated_at !== report.submitted_at && ` · updated ${formatDateTime(report.updated_at)}`}</p>
    </dl>
  )
}

/** Daily progress update for today. Saved separately from the shift, so attendance is never lost with an unfinished report. */
export function ProgressReportForm({ report, onSaved }) {
  const toast = useToast()
  const [editing, setEditing] = useState(!report)
  const [form, setForm] = useState(() => Object.fromEntries(REPORT_FIELDS.map(([k]) => [k, report?.[k] ?? ''])))
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  if (report && !editing)
    return (
      <div className="flex flex-col gap-4">
        <Alert type="success" title="Progress update submitted" />
        <ProgressReportView report={report} />
        <Button variant="secondary" size="s" icon={PencilLine} className="self-start" onClick={() => setEditing(true)}>Edit today's update</Button>
      </div>
    )

  async function submit(e) {
    e.preventDefault()
    if (form.tasks_completed.trim().length < 3) return setError('Describe the tasks you completed')
    setBusy(true)
    setError(null)
    try {
      await submitProgress(form)
      toast('success', 'Progress update saved', 'Your Tech Champion can now see today\'s update.')
      setEditing(false)
      onSaved()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {error && <Alert type="error" title={error} onClose={() => setError(null)} />}
      {REPORT_FIELDS.map(([k, label, required]) => (
        <Textarea key={k} label={label} required={required} rows={k === 'tasks_completed' ? 4 : 2} maxLength={2000}
          value={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} />
      ))}
      <div className="flex gap-3">
        <Button type="submit" icon={CheckCircle2} loading={busy}>{report ? 'Save changes' : 'Submit progress update'}</Button>
        {report && <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>}
      </div>
    </form>
  )
}

const fmtValues = (v) => v ? Object.entries(v).map(([k, x]) => `${k.replace(/_at$/, '').replaceAll('_', ' ')}: ${/_at$/.test(k) ? formatTime(x) : x ?? '—'}`).join(' · ') : 'No record'

/** Corrections are shown apart from recorded events, with the original values kept. */
export function CorrectionList({ corrections }) {
  if (!corrections?.length) return null
  return (
    <ul className="flex flex-col gap-2">
      {corrections.map((c) => (
        <li key={c.id} className="rounded-[10px] border border-warning-border bg-warning-surface p-3 text-xs">
          <p className="font-semibold text-warning">
            Corrected {c.break_type ? `${c.break_type} break` : 'shift'} · {c.corrected_by_name ?? 'Tech Champion'} · {formatDateTime(c.created_at)}
          </p>
          <p><span className="text-muted">Before:</span> {fmtValues(c.before)}</p>
          <p><span className="text-muted">After:</span> {fmtValues(c.after)}</p>
          <p><span className="text-muted">Reason:</span> {c.reason}</p>
        </li>
      ))}
    </ul>
  )
}

// A detected exception is only a flag; 'Confirmed policy violation' is a Tech Champion's decision.
export const OUTCOMES = [['noted', 'Noted'], ['excused', 'Excused'], ['follow_up', 'Follow-up needed'], ['confirmed_violation', 'Confirmed policy violation']]
const OUTCOME_TONE = { noted: 'neutral', excused: 'approved', follow_up: 'pending', confirmed_violation: 'rejected' }
/** Staff note on a day (scope.workDate) or a week (scope.weekStart). Append-only. */
export function ReviewForm({ candidateId, scope, onSaved }) {
  const toast = useToast()
  const [f, setF] = useState({ outcome: 'noted', note: '', followUp: '', needsSupport: false })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  async function submit(e) {
    e.preventDefault()
    if (f.note.trim().length < 3) return setError('Add a note (3+ characters)')
    setBusy(true)
    setError(null)
    try {
      await addReview({ candidateId, ...scope, ...f })
      toast('success', 'Review note added')
      setF({ outcome: 'noted', note: '', followUp: '', needsSupport: false })
      onSaved()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      {error && <Alert type="error" title={error} />}
      <Select label="Outcome" value={f.outcome} onChange={(e) => setF({ ...f, outcome: e.target.value })}>
        {OUTCOMES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </Select>
      <Textarea label="Note" required rows={2} maxLength={2000} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
      <Input label="Follow-up action" maxLength={1000} value={f.followUp} onChange={(e) => setF({ ...f, followUp: e.target.value })} placeholder="Optional" />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-4 accent-purple" checked={f.needsSupport} onChange={(e) => setF({ ...f, needsSupport: e.target.checked })} />
        Candidate needs additional support
      </label>
      <Button type="submit" size="s" icon={MessageSquarePlus} loading={busy} className="self-start">Add note</Button>
    </form>
  )
}

export function ReviewList({ reviews }) {
  if (!reviews.length) return <p className="text-xs text-muted">No review notes yet.</p>
  return (
    <ul className="flex flex-col gap-2">
      {reviews.map((r) => (
        <li key={r.id} className="rounded-[10px] bg-bg p-3 text-xs">
          <p className="mb-1 flex flex-wrap items-center gap-2">
            <Badge tone={OUTCOME_TONE[r.outcome]}>{OUTCOMES.find(([v]) => v === r.outcome)[1]}</Badge>
            {r.needs_support && <Badge tone="late">Needs support</Badge>}
            <span className="text-muted">{formatDateTime(r.created_at)}</span>
          </p>
          <p className="text-sm whitespace-pre-wrap">{r.note}</p>
          {r.follow_up && <p><span className="text-muted">Follow-up:</span> {r.follow_up}</p>}
        </li>
      ))}
    </ul>
  )
}

