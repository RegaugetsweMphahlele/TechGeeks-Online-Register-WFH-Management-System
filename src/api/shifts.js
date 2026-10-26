// Shifts reuse the attendance record: clock in/out are checkIn()/checkOut() in attendance.js,
// and shift rows (with break totals and flags) come from attendance_overview.
import { db, fetchAll, run } from './client.js'

export const getSchedule = () => run(db().from('shift_schedule').select('*').single())

export const startBreak = (type) => run(db().rpc('start_break', { p_type: type }).single())
export const endBreak = () => run(db().rpc('end_break').single())

/** Every shift in a date range; RLS limits it to the caller's own or assigned candidates. */
export const listShifts = ({ candidateId, from, to }) =>
  fetchAll(() => {
    let q = db().from('attendance_overview').select('*')
    if (candidateId) q = q.eq('candidate_id', candidateId)
    if (from) q = q.gte('attendance_date', from)
    if (to) q = q.lte('attendance_date', to)
    return q.order('attendance_date', { ascending: false }).order('full_name')
  })

export const submitProgress = (f) =>
  run(db().rpc('submit_progress_report', {
    p_tasks: f.tasks_completed, p_learning: f.learning || null, p_deliverables: f.deliverables || null,
    p_challenges: f.challenges || null, p_support: f.support_needed || null, p_next_plan: f.next_day_plan || null,
  }).single())

export const listProgress = ({ candidateId, from, to }) => {
  let q = db().from('progress_reports').select('*')
  if (candidateId) q = q.eq('candidate_id', candidateId)
  if (from) q = q.gte('report_date', from)
  if (to) q = q.lte('report_date', to)
  return run(q.order('report_date', { ascending: false }))
}

export const correctShift = ({ candidateId, date, checkInAt, checkOutAt, reason, workMode }) =>
  run(db().rpc('correct_shift', {
    p_candidate: candidateId, p_date: date, p_check_in_at: checkInAt, p_check_out_at: checkOutAt || null,
    p_reason: reason, p_work_mode: workMode || null,
  }).single())

export const correctBreak = ({ attendanceId, type, startedAt, endedAt, reason }) =>
  run(db().rpc('correct_break', {
    p_attendance_id: attendanceId, p_type: type, p_started_at: startedAt, p_ended_at: endedAt, p_reason: reason,
  }).single())

export const listCorrections = (candidateId, { from, to } = {}) => {
  let q = db().from('correction_overview').select('*').eq('candidate_id', candidateId)
  if (from) q = q.gte('attendance_date', from)
  if (to) q = q.lte('attendance_date', to)
  return run(q.order('created_at', { ascending: false }))
}

export const listReviews = ({ candidateId, workDate, weekStart }) => {
  let q = db().from('attendance_reviews').select('*')
  if (candidateId) q = q.eq('candidate_id', candidateId)
  if (workDate) q = q.eq('work_date', workDate)
  if (weekStart) q = q.eq('week_start', weekStart)
  return run(q.order('created_at', { ascending: false }))
}

/** reviewer_id is set by the database (auth.uid()); RLS only allows assigned Tech Champions. */
export const addReview = ({ candidateId, workDate, weekStart, outcome, needsSupport, note, followUp }) =>
  run(db().from('attendance_reviews').insert({
    candidate_id: candidateId, work_date: workDate ?? null, week_start: weekStart ?? null,
    outcome, needs_support: Boolean(needsSupport), note: note.trim(), follow_up: followUp?.trim() || null,
  }).select().single())
