// Shift display logic. The database records every timestamp and derives every final value
// (attendance_overview); this only labels them and shows "so far" values for open shifts.
import { addDays, formatTime, isWeekend, sastToday } from './time.js'

export const BREAK_LABEL = { tea: 'Tea', lunch: 'Lunch' }

const hm = (t) => (t ? t.slice(0, 5) : '') // '09:00:00' → '09:00'
const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
const fromMin = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

/** Current SAST wall-clock time as 'HH:MM' (display/suggestions only — the server stamps every action). */
export const nowHm = (now = new Date()) => formatTime(now)

export function formatMinutes(m) {
  if (m == null) return '—'
  const total = Math.max(0, Math.round(m))
  const h = Math.floor(total / 60)
  return h ? `${h}h ${String(total % 60).padStart(2, '0')}m` : `${total}m`
}

/** Scheduled totals: 09:00–16:00 with 15 + 60 minutes of breaks → 420 / 75 / 345. */
export function scheduledMinutes(s) {
  const elapsed = toMin(hm(s.workday_end)) - toMin(hm(s.workday_start))
  const tea = toMin(hm(s.tea_end)) - toMin(hm(s.tea_start))
  const lunch = toMin(hm(s.lunch_end)) - toMin(hm(s.lunch_start))
  return { elapsed, tea, lunch, net: elapsed - tea - lunch }
}

export const scheduleRange = (s, kind) => `${hm(s[`${kind}_start`])}–${hm(s[`${kind}_end`])}`

/** State badge for a day. row = attendance_overview row, or null when there is no clock-in. */
export function shiftState(row, { date = sastToday(), today = sastToday(), nowTime = nowHm(), schedule } = {}) {
  if (!row) {
    if (isWeekend(date)) return { tone: 'neutral', label: 'No shift' }
    if (date < today) return { tone: 'rejected', label: 'Absent' }
    return schedule && nowTime > hm(schedule.workday_start)
      ? { tone: 'rejected', label: 'Not clocked in' }
      : { tone: 'missing', label: 'Not started' }
  }
  switch (row.shift_status) {
    case 'clocked_out': return { tone: 'submitted', label: 'Clocked out' }
    case 'incomplete': return { tone: 'late', label: 'Incomplete' }
    case 'on_break': return { tone: 'pending', label: `On ${row.open_break} break` }
    default: return { tone: 'working', label: 'Working' }
  }
}

export const punctuality = (row) => (row.late ? { tone: 'late', label: 'Late' } : { tone: 'approved', label: 'On time' })

/** Automatically detected exceptions — flags for review, not confirmed violations. */
export function shiftFlags(row, today = sastToday(), { schedule, now = new Date() } = {}) {
  const f = []
  const open = row.open_break
  if (open && schedule && row.attendance_date === today) {
    const allowed = toMin(hm(schedule[`${open}_end`])) - toMin(hm(schedule[`${open}_start`]))
    if ((now - new Date(row[`${open}_started_at`])) / 6e4 > allowed) f.push(`${BREAK_LABEL[open]} break running over`)
  }
  if (row.late) f.push('Late arrival')
  if (row.early_departure) f.push('Early departure')
  if (row.shift_status === 'incomplete') f.push('No clock-out')
  if (row.break_incomplete) f.push('Break not ended')
  if (row.tea_excessive) f.push('Long tea break')
  if (row.lunch_excessive) f.push('Long lunch')
  if (row.tea_missed) f.push('Tea not taken')
  if (row.lunch_missed) f.push('Lunch not taken')
  if (row.break_off_schedule) f.push('Break off schedule')
  if (!row.report_submitted && (row.check_out_at || row.attendance_date < today)) f.push('No progress update')
  return f
}

export const BREAK_FLAGS = ['Long tea break', 'Long lunch', 'Tea not taken', 'Lunch not taken', 'Break not ended', 'Break off schedule']

/** Live "so far" totals for an open shift; the server's final values once clocked out. */
export function shiftTotals(row, now = new Date()) {
  if (row.check_out_at) return { elapsed: row.elapsed_minutes, breaks: row.break_minutes, net: row.net_minutes, final: true }
  const mins = (a, b) => (new Date(b) - new Date(a)) / 6e4
  const elapsed = mins(row.check_in_at, now)
  let breaks = 0
  for (const t of ['tea', 'lunch']) {
    const start = row[`${t}_started_at`]
    if (start) breaks += mins(start, row[`${t}_ended_at`] ?? now)
  }
  return { elapsed, breaks, net: elapsed - breaks, final: false }
}

/** Minutes until the scheduled clock-out (0 once it has passed). */
export const remainingMinutes = (row, now = new Date()) => Math.max(0, (new Date(row.scheduled_end) - now) / 6e4)

/** Which buttons the candidate may press, and which one the schedule suggests. Mirrors the RPC rules. */
export function shiftActions(row, schedule, nowTime = nowHm()) {
  if (!row) return { primary: 'clock_in', others: [] }
  if (row.check_out_at || row.shift_status === 'incomplete') return { primary: null, others: [] }
  if (row.open_break) return { primary: `end_${row.open_break}`, others: [] }
  const tea = !row.tea_started_at, lunch = !row.lunch_started_at
  const primary =
    nowTime >= hm(schedule.workday_end) ? 'clock_out'
      : lunch && nowTime >= hm(schedule.lunch_start) ? 'start_lunch'
        : tea ? 'start_tea'
          : lunch ? 'start_lunch' : 'clock_out'
  const all = [tea && 'start_tea', lunch && 'start_lunch', 'clock_out'].filter(Boolean)
  return { primary, others: all.filter((a) => a !== primary) }
}

/** Warning shown before an out-of-window break or early clock-out. Null when it's on schedule. */
export function offScheduleWarning(action, schedule, nowTime = nowHm()) {
  if (action === 'clock_out')
    return nowTime < hm(schedule.workday_end)
      ? `Your scheduled clock-out is ${hm(schedule.workday_end)}. Clocking out now will be recorded as an early departure.`
      : null
  const type = action.replace('start_', '')
  if (!BREAK_LABEL[type]) return null
  const start = hm(schedule[`${type}_start`]), end = hm(schedule[`${type}_end`])
  const earliest = fromMin(Math.max(0, toMin(start) - schedule.break_window_minutes))
  if (nowTime >= earliest && nowTime <= end) return null
  return `${BREAK_LABEL[type]} break is scheduled for ${start}–${end}. ${nowTime < earliest ? 'Starting it this early' : 'Starting it after the window'} will be flagged for your Tech Champion to review.`
}

/** The day as scheduled vs actually recorded. Actual times come only from recorded events. */
export function timeline(row, schedule) {
  const sched = (k) => hm(schedule[k])
  const ev = (key, label, scheduled, actual) => ({ key, kind: 'event', label, scheduled, actual })
  const session = (key, label, from, to) => ({ key, kind: 'session', label, scheduled: `${from}–${to}` })
  return [
    ev('in', 'Clocked in', row ? formatTime(row.scheduled_start) : sched('workday_start'), row?.check_in_at),
    session('s1', 'Morning work session', sched('workday_start'), sched('tea_start')),
    ev('tea-start', 'Tea break started', sched('tea_start'), row?.tea_started_at),
    ev('tea-end', 'Tea break ended', sched('tea_end'), row?.tea_ended_at),
    session('s2', 'Midday work session', sched('tea_end'), sched('lunch_start')),
    ev('lunch-start', 'Lunch started', sched('lunch_start'), row?.lunch_started_at),
    ev('lunch-end', 'Lunch ended', sched('lunch_end'), row?.lunch_ended_at),
    session('s3', 'Afternoon work session', sched('lunch_end'), sched('workday_end')),
    ev('out', 'Clocked out', row ? formatTime(row.scheduled_end) : sched('workday_end'), row?.check_out_at),
  ]
}

/** Weekdays from `from` to `to` (inclusive) that have started by now — the days a shift was expected. */
export function expectedDays(from, to, { today = sastToday(), nowTime = nowHm(), schedule } = {}) {
  const days = []
  for (let d = from; d <= to && d <= today; d = addDays(d, 1)) {
    if (isWeekend(d)) continue
    if (d === today && schedule && nowTime <= hm(schedule.workday_start)) continue
    days.push(d)
  }
  return days
}

/** One candidate's week from recorded shifts only. Days without a clock-in count as missing, never as attended. */
export function weeklySummary(rows, days) {
  const dates = new Set(rows.map((r) => r.attendance_date))
  const count = (p) => rows.filter(p).length
  const sum = (k) => rows.reduce((t, r) => t + (r[k] ?? 0), 0)
  const attended = rows.length
  const reports = count((r) => r.report_submitted)
  return {
    scheduledDays: days.length,
    attended,
    completed: count((r) => r.shift_status === 'clocked_out'),
    late: count((r) => r.late),
    early: count((r) => r.early_departure),
    missing: days.filter((d) => !dates.has(d)).length,
    incomplete: count((r) => r.shift_status === 'incomplete'),
    netMinutes: sum('net_minutes'), // completed shifts only: open shifts have no final value
    teaMinutes: sum('tea_minutes'),
    lunchMinutes: sum('lunch_minutes'),
    breakIssues: count((r) => r.tea_missed) + count((r) => r.lunch_missed) + count((r) => r.tea_excessive) + count((r) => r.lunch_excessive),
    reports,
    reportRate: attended ? Math.round((reports / attended) * 100) : null,
  }
}

/** One line per assigned candidate for the date — including those with no clock-in, who are never counted as present. */
export function buildDay(candidates, shifts, { date, schedule, now }) {
  const today = sastToday(now)
  const byId = new Map(shifts.map((s) => [s.candidate_id, s]))
  return candidates.filter((c) => c.status === 'active').map((c) => {
    const row = byId.get(c.id) ?? null
    const state = shiftState(row, { date, today, nowTime: nowHm(now), schedule })
    const flags = row ? shiftFlags(row, today, { schedule, now }) : state.tone === 'rejected' ? ['No clock-in'] : []
    return { id: c.id, candidate: c, row, state, flags }
  })
}
