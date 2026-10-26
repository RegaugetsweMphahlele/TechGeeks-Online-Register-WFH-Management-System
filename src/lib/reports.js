import { registerStatus } from './attendance.js'
import { shiftFlags } from './shifts.js'
import { formatDate, formatDateTime, formatTime } from './time.js'

const MODE = { office: 'Office', wfh: 'Working From Home' }
const STATUS = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' }

export const ATTENDANCE_COLUMNS = [
  { header: 'Candidate name', value: (r) => r.full_name },
  { header: 'Candidate ID', value: (r) => r.candidate_identifier },
  { header: 'Cohort', value: (r) => r.cohort },
  { header: 'Date', value: (r) => r.attendance_date },
  { header: 'Check-in time', value: (r) => formatTime(r.check_in_at) },
  { header: 'Check-out time', value: (r) => (r.check_out_at ? formatTime(r.check_out_at) : '') },
  { header: 'Working hours', value: (r) => (r.hours == null ? '' : Number(r.hours).toFixed(2)) },
  { header: 'Work mode', value: (r) => MODE[r.work_mode] },
  { header: 'WFH approved', value: (r) => (r.work_mode === 'wfh' ? (r.wfh_approved ? 'Yes' : 'No') : '') },
  { header: 'Attendance status', value: (r) => registerStatus(r).label },
  { header: 'Location note', value: (r) => r.location_note },
  { header: 'Detected address', value: (r) => r.location_address },
  { header: 'Latitude', value: (r) => r.location_latitude },
  { header: 'Longitude', value: (r) => r.location_longitude },
]

export const WFH_COLUMNS = [
  { header: 'Candidate name', value: (r) => r.full_name },
  { header: 'Candidate ID', value: (r) => r.candidate_identifier },
  { header: 'Cohort', value: (r) => r.cohort },
  { header: 'WFH requested date', value: (r) => r.requested_date },
  { header: 'Reason', value: (r) => r.reason },
  { header: 'Details', value: (r) => r.details },
  { header: 'WFH status', value: (r) => STATUS[r.status] },
  { header: 'Submitted', value: (r) => formatDateTime(r.submitted_at) },
  { header: 'Decision date', value: (r) => (r.reviewed_at ? formatDateTime(r.reviewed_at) : '') },
  { header: 'Decision-maker', value: (r) => r.reviewer_name ?? '' },
  { header: 'Decision comment', value: (r) => r.decision_comment ?? '' },
  { header: 'Location address', value: (r) => r.location_address },
  { header: 'Latitude', value: (r) => r.location_latitude },
  { header: 'Longitude', value: (r) => r.location_longitude },
]

export function reportFilename(kind, { from, to } = {}) {
  const range = from || to ? `_${from || 'start'}_to_${to || 'today'}` : ''
  return `capaciti-${kind}${range}.csv`
}

export const describeRange = ({ from, to }) =>
  from && to ? `${formatDate(from)} – ${formatDate(to)}` : from ? `from ${formatDate(from)}` : to ? `until ${formatDate(to)}` : 'all dates'

const SHIFT_STATE = { working: 'Working', on_break: 'On break', clocked_out: 'Clocked out', incomplete: 'Incomplete' }
const t = (ts) => (ts ? formatTime(ts) : '')

export const SHIFT_COLUMNS = [
  { header: 'Candidate name', value: (r) => r.full_name },
  { header: 'Candidate ID', value: (r) => r.candidate_identifier },
  { header: 'Date', value: (r) => r.attendance_date },
  { header: 'Scheduled start', value: (r) => t(r.scheduled_start) },
  { header: 'Scheduled end', value: (r) => t(r.scheduled_end) },
  { header: 'Clock-in', value: (r) => t(r.check_in_at) },
  { header: 'Clock-out', value: (r) => t(r.check_out_at) },
  { header: 'Shift status', value: (r) => SHIFT_STATE[r.shift_status] },
  { header: 'Punctuality', value: (r) => (r.late ? 'Late' : 'On time') },
  { header: 'Elapsed (min)', value: (r) => r.elapsed_minutes },
  { header: 'Breaks (min)', value: (r) => (r.check_out_at ? r.break_minutes : '') },
  { header: 'Net working (min)', value: (r) => r.net_minutes },
  { header: 'Tea start', value: (r) => t(r.tea_started_at) },
  { header: 'Tea end', value: (r) => t(r.tea_ended_at) },
  { header: 'Tea (min)', value: (r) => r.tea_minutes },
  { header: 'Lunch start', value: (r) => t(r.lunch_started_at) },
  { header: 'Lunch end', value: (r) => t(r.lunch_ended_at) },
  { header: 'Lunch (min)', value: (r) => r.lunch_minutes },
  { header: 'Exceptions (flagged for review)', value: (r) => shiftFlags(r).join('; ') },
  { header: 'Progress update', value: (r) => (r.report_submitted ? 'Submitted' : 'Not submitted') },
  { header: 'Corrected by staff', value: (r) => (r.corrected ? 'Yes' : 'No') },
]

const hours = (m) => (m / 60).toFixed(2)
export const WEEKLY_COLUMNS = [
  { header: 'Candidate name', value: (r) => r.full_name },
  { header: 'Candidate ID', value: (r) => r.candidate_identifier },
  { header: 'Week starting', value: (r) => r.week },
  { header: 'Scheduled days', value: (r) => r.scheduledDays },
  { header: 'Days attended', value: (r) => r.attended },
  { header: 'Completed shifts', value: (r) => r.completed },
  { header: 'Late arrivals', value: (r) => r.late },
  { header: 'Early departures', value: (r) => r.early },
  { header: 'Missing clock-ins', value: (r) => r.missing },
  { header: 'Incomplete shifts', value: (r) => r.incomplete },
  { header: 'Net working hours', value: (r) => hours(r.netMinutes) },
  { header: 'Tea break (min)', value: (r) => r.teaMinutes },
  { header: 'Lunch break (min)', value: (r) => r.lunchMinutes },
  { header: 'Missed/excessive breaks', value: (r) => r.breakIssues },
  { header: 'Progress updates', value: (r) => `${r.reports}/${r.attended}` },
  { header: 'Progress completion %', value: (r) => r.reportRate ?? '' },
]
