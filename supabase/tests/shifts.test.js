// Shift lifecycle, breaks, corrections, reviews and progress updates against the real migrations (PGlite).
// RPCs use the database clock, so tests simulate "09:00" or "a 70-minute lunch" by moving the
// recorded timestamps / schedule as admin, never by trusting a client time.
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

const dir = join(import.meta.dirname, '..')
const MENTOR = '00000000-0000-0000-0000-00000000000a'
const MENTOR2 = '00000000-0000-0000-0000-00000000000b'
const ALICE = '00000000-0000-0000-0000-000000000001'
const BOB = '00000000-0000-0000-0000-000000000002'
const CARL = '00000000-0000-0000-0000-000000000003' // belongs to MENTOR2

let db
async function as(uid, sql, params) {
  await db.exec(`set role ${uid ? 'authenticated' : 'anon'}`)
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid ?? ''])
  try {
    return (await db.query(sql, params)).rows
  } finally {
    await db.exec('reset role')
  }
}
const admin = async (sql, params) => (await db.query(sql, params)).rows
const fails = (p, msg) => expect(p).rejects.toThrow(msg)
const shift = async (uid, date = 'sast_today()') =>
  (await admin(`select * from attendance_overview where candidate_id = $1 and attendance_date = ${date}`, [uid]))[0]
const checkIn = (uid) => as(uid, `select check_in('wfh', 'Home', null, -34.04, 18.62)`)

beforeAll(async () => {
  db = new PGlite()
  await db.exec(readFileSync(join(dir, 'tests/auth-stub.sql'), 'utf8'))
  for (const f of readdirSync(join(dir, 'migrations')).sort())
    await db.exec(readFileSync(join(dir, 'migrations', f), 'utf8'))
  await db.exec(`insert into auth.users (id, email, raw_user_meta_data) values
    ('${MENTOR}', 'mentor@example.test', '{"full_name":"Test Mentor"}'),
    ('${MENTOR2}', 'mentor2@example.test', '{"full_name":"Other Mentor"}'),
    ('${ALICE}', 'alice@example.test', '{"full_name":"Alice Test"}'),
    ('${BOB}', 'bob@example.test', '{"full_name":"Bob Test"}'),
    ('${CARL}', 'carl@example.test', '{"full_name":"Carl Test"}');
    update profiles set role = 'mentor' where id in ('${MENTOR}', '${MENTOR2}');
    update profiles set mentor_id = '${MENTOR}' where id in ('${ALICE}', '${BOB}');
    update profiles set mentor_id = '${MENTOR2}' where id = '${CARL}';`)
})

describe('schedule', () => {
  it('defaults to 09:00–16:00 with tea 10:30–10:45 and lunch 12:00–13:00', async () => {
    const [s] = await as(ALICE, `select workday_start, workday_end, tea_start, tea_end, lunch_start, lunch_end from shift_schedule`)
    expect(s).toEqual({ workday_start: '09:00:00', workday_end: '16:00:00', tea_start: '10:30:00', tea_end: '10:45:00', lunch_start: '12:00:00', lunch_end: '13:00:00' })
  })
  it('candidates cannot change it', async () => {
    await fails(as(ALICE, `update shift_schedule set workday_start = '10:00'`), 'permission denied')
  })
})

describe('clock in', () => {
  it('on time: snapshots the SAST schedule and is not late', async () => {
    await checkIn(ALICE)
    // Simulate a 09:00 clock-in: put the scheduled start on the recorded minute.
    await admin(`update attendance_records set check_in_at = now() - interval '4 hours' where candidate_id = $1`, [ALICE])
    await admin(`update attendance_records set scheduled_start = date_trunc('minute', check_in_at) where candidate_id = $1`, [ALICE])
    const s = await shift(ALICE)
    expect(s.late).toBe(false)
    expect(s.shift_status).toBe('working')
    expect(s.elapsed_minutes).toBeNull() // not final until clock-out
  })
  it('scheduled times are 09:00/16:00 SAST on the working date', async () => {
    const [r] = await admin(`select to_char(scheduled_start at time zone 'Africa/Johannesburg', 'HH24:MI') s,
      to_char(scheduled_end at time zone 'Africa/Johannesburg', 'HH24:MI') e from attendance_records where candidate_id = $1`, [ALICE])
    // ALICE's start was moved above; the end is still the snapshot.
    expect(r.e).toBe('16:00')
  })
  it('late: flagged in the view and the Tech Champion is notified for review', async () => {
    await admin(`update shift_schedule set workday_start = '00:00'`) // any clock-in today is now after the start
    await checkIn(BOB)
    await admin(`update shift_schedule set workday_start = '09:00'`)
    expect((await shift(BOB)).late).toBe(true)
    const titles = (await as(MENTOR, `select title from notifications`)).map((n) => n.title)
    expect(titles).toContain('Late clock-in flagged')
  })
  it('twice on the same day is rejected', async () => {
    await fails(checkIn(ALICE), 'already checked in')
  })
})

describe('breaks', () => {
  it('a break needs an active shift', async () => {
    await fails(as(CARL, `select start_break('tea')`), 'Clock in before starting a break')
  })
  it('tea starts and ends with server timestamps', async () => {
    const [b] = await as(ALICE, `select * from start_break('tea')`)
    expect(b.candidate_id).toBe(ALICE)
    expect(b.ended_at).toBeNull()
    expect((await shift(ALICE)).shift_status).toBe('on_break')
  })
  it('two breaks at once are rejected', async () => {
    await fails(as(ALICE, `select start_break('lunch')`), 'End your tea break first')
  })
  it('clock-out during an active break is rejected', async () => {
    await fails(as(ALICE, `select check_out()`), 'End your tea break before clocking out')
  })
  it('ending tea records the duration; it cannot be recorded twice', async () => {
    const [b] = await as(ALICE, `select * from end_break()`)
    expect(new Date(b.ended_at) >= new Date(b.started_at)).toBe(true)
    await fails(as(ALICE, `select end_break()`), 'no active break')
    await fails(as(ALICE, `select start_break('tea')`), 'already been recorded')
    const s = await shift(ALICE)
    expect(s.tea_minutes).toBe(0)
    expect(s.tea_excessive).toBe(false)
  })
  it('lunch over the 60-minute allowance is flagged and notified', async () => {
    await as(ALICE, `select start_break('lunch')`)
    await admin(`update shift_breaks set started_at = now() - interval '70 minutes' where candidate_id = $1 and break_type = 'lunch'`, [ALICE])
    await as(ALICE, `select end_break()`)
    const s = await shift(ALICE)
    expect(s.lunch_minutes).toBe(70)
    expect(s.lunch_excessive).toBe(true)
    expect((await as(MENTOR, `select title from notifications`)).map((n) => n.title)).toContain('Lunch break over allowance')
  })
  it('candidates cannot write breaks directly', async () => {
    await fails(as(ALICE, `update shift_breaks set ended_at = started_at + interval '1 minute'`), 'permission denied')
    await fails(as(ALICE, `delete from shift_breaks`), 'permission denied')
    await fails(as(ALICE, `insert into shift_breaks (attendance_id, candidate_id, break_type, started_at, scheduled_start, scheduled_end)
      select id, candidate_id, 'tea', now(), now(), now() from attendance_records limit 1`), 'permission denied')
  })
  it('mentors and anonymous users cannot record breaks', async () => {
    await fails(as(MENTOR, `select start_break('tea')`), 'Only active candidates')
    await fails(as(null, `select start_break('tea')`), 'permission denied')
  })
})

describe('clock out', () => {
  it('computes elapsed, break and net time from recorded events; early departure is flagged', async () => {
    await admin(`update attendance_records set scheduled_end = now() + interval '1 hour' where candidate_id = $1`, [ALICE])
    await as(ALICE, `select check_out()`)
    const s = await shift(ALICE)
    expect(s.shift_status).toBe('clocked_out')
    expect(s.elapsed_minutes).toBe(240)
    expect(s.break_minutes).toBe(70)
    expect(s.net_minutes).toBe(170)
    expect(s.early_departure).toBe(true)
    expect(s.tea_missed).toBe(false)
    expect((await as(MENTOR, `select title from notifications`)).map((n) => n.title)).toContain('Early clock-out flagged')
  })
  it('a shift closed without lunch reports lunch as missed', async () => {
    await as(BOB, `select check_out()`)
    const s = await shift(BOB)
    expect(s.lunch_missed).toBe(true)
    expect(s.tea_missed).toBe(true)
    expect(s.break_minutes).toBe(0)
  })
  it('no breaks can start after clock-out', async () => {
    await fails(as(BOB, `select start_break('tea')`), 'already clocked out')
  })
})

describe('forgotten clock-out and staff correction', () => {
  let shiftId
  beforeAll(async () => {
    // Yesterday CARL clocked in, started lunch, and never came back.
    ;[{ id: shiftId }] = await admin(`insert into attendance_records (candidate_id, attendance_date, work_mode, check_in_at)
      values ($1, sast_today() - 1, 'wfh', sast_at(sast_today() - 1, '09:02')) returning id`, [CARL])
    await admin(`insert into shift_breaks (attendance_id, candidate_id, break_type, started_at, scheduled_start, scheduled_end)
      values ($1, $2, 'lunch', sast_at(sast_today() - 1, '12:01'), sast_at(sast_today() - 1, '12:00'), sast_at(sast_today() - 1, '13:00'))`, [shiftId, CARL])
  })
  it('is flagged incomplete, with the open break flagged too', async () => {
    const s = await shift(CARL, 'sast_today() - 1')
    expect(s.shift_status).toBe('incomplete')
    expect(s.break_incomplete).toBe(true)
    expect(s.net_minutes).toBeNull()
  })
  it('the candidate cannot close yesterday\'s break today', async () => {
    await checkIn(CARL)
    await fails(as(CARL, `select end_break()`), 'earlier day is still open')
  })
  it('other mentors and candidates cannot correct it', async () => {
    await fails(as(MENTOR, `select correct_break($1, 'lunch', now() - interval '1 day', now() - interval '23 hours', 'Forgot to end lunch')`, [shiftId]), 'not assigned to you')
    await fails(as(CARL, `select correct_shift($1, sast_today() - 1, sast_at(sast_today() - 1, '09:02'), sast_at(sast_today() - 1, '16:00'), 'I left at four')`, [CARL]), 'not assigned to you')
    await fails(as(CARL, `update attendance_records set check_out_at = now()`), 'permission denied')
  })
  it('requires a reason, and the shift must contain its breaks', async () => {
    await fails(as(MENTOR2, `select correct_shift($1, sast_today() - 1, sast_at(sast_today() - 1, '09:02'), sast_at(sast_today() - 1, '16:00'), '')`, [CARL]), 'reason')
    await fails(as(MENTOR2, `select correct_shift($1, sast_today() - 1, sast_at(sast_today() - 1, '09:02'), sast_at(sast_today() - 1, '16:00'), 'Confirmed by phone')`, [CARL]), 'Breaks must fall within the shift')
    await fails(as(MENTOR2, `select correct_break($1, 'lunch', sast_at(sast_today() - 1, '12:01'), sast_at(sast_today() - 1, '11:00'), 'Confirmed by phone')`, [shiftId]), 'must end after it starts')
  })
  it('staff resolve the break and the shift; originals are kept and the candidate is told', async () => {
    await as(MENTOR2, `select correct_break($1, 'lunch', sast_at(sast_today() - 1, '12:01'), sast_at(sast_today() - 1, '13:00'), 'Confirmed by phone')`, [shiftId])
    await as(MENTOR2, `select correct_shift($1, sast_today() - 1, sast_at(sast_today() - 1, '09:02'), sast_at(sast_today() - 1, '16:00'), 'Confirmed by phone')`, [CARL])
    const s = await shift(CARL, 'sast_today() - 1')
    expect(s).toMatchObject({ shift_status: 'clocked_out', corrected: true, late: true, break_incomplete: false, lunch_minutes: 59, elapsed_minutes: 418, net_minutes: 359 })
    const corrections = await as(CARL, `select break_type, before, after, reason, corrected_by_name from correction_overview order by created_at`)
    expect(corrections).toHaveLength(2)
    expect(corrections[0].before.ended_at).toBeNull()
    expect(corrections[1].before.check_out_at).toBeNull()
    expect(corrections[1].after.check_out_at).not.toBeNull()
    expect(corrections[1].corrected_by_name).toBe('Other Mentor')
    expect((await as(CARL, `select title from notifications`)).map((n) => n.title)).toContain('Attendance corrected')
    const events = (await as(MENTOR2, `select action from audit_logs where details ->> 'candidate_id' = $1 order by id`, [CARL])).map((e) => e.action)
    expect(events).toEqual(expect.arrayContaining(['shift.corrected', 'break.corrected', 'shift.clock_in']))
    await fails(as(CARL, `delete from attendance_corrections`), 'permission denied')
  })
  it('staff can record a shift a candidate forgot to clock in for', async () => {
    await fails(as(MENTOR, `select correct_shift($1, sast_today() - 2, sast_at(sast_today() - 2, '09:00'), sast_at(sast_today() - 2, '16:00'), 'Was on site, phone flat')`, [ALICE]), 'work mode')
    const [r] = await as(MENTOR, `select * from correct_shift($1, sast_today() - 2, sast_at(sast_today() - 2, '09:00'), sast_at(sast_today() - 2, '16:00'), 'Was on site, phone flat', 'office')`, [ALICE])
    expect(r.notes).toBe('Recorded by Tech Champion')
    const [c] = await as(ALICE, `select before from attendance_corrections where attendance_id = $1`, [r.id])
    expect(c.before).toBeNull()
  })
  it('rejects future times and clock-ins on another date', async () => {
    await fails(as(MENTOR, `select correct_shift($1, sast_today(), now() - interval '1 hour', now() + interval '1 hour', 'Testing future')`, [ALICE]), 'future')
    await fails(as(MENTOR, `select correct_shift($1, sast_today() - 3, sast_at(sast_today() - 4, '09:00'), null, 'Wrong day', 'office')`, [ALICE]), 'selected working date')
  })
})

describe('visibility', () => {
  it('candidates only see their own shifts, breaks and corrections', async () => {
    expect((await as(ALICE, `select distinct candidate_id from shift_breaks`)).map((r) => r.candidate_id)).toEqual([ALICE])
    expect((await as(ALICE, `select distinct candidate_id from attendance_overview`)).map((r) => r.candidate_id)).toEqual([ALICE])
    expect(await as(ALICE, `select * from attendance_corrections where candidate_id <> $1`, [ALICE])).toHaveLength(0)
  })
  it('mentors only see their assigned candidates', async () => {
    const ids = new Set((await as(MENTOR, `select candidate_id from shift_breaks`)).map((r) => r.candidate_id))
    expect(ids.has(CARL)).toBe(false)
    expect(await as(MENTOR2, `select * from attendance_overview where candidate_id = $1`, [ALICE])).toHaveLength(0)
    expect(await as(MENTOR, `select * from audit_logs where details ->> 'candidate_id' = $1`, [CARL])).toHaveLength(0)
  })
})

describe('daily progress update', () => {
  it('requires a shift today and the tasks completed', async () => {
    await admin(`delete from attendance_records where candidate_id = $1 and attendance_date = sast_today()`, [CARL])
    await fails(as(CARL, `select submit_progress_report('Built the login page')`), 'Clock in before submitting')
    await fails(as(BOB, `select submit_progress_report('  ')`), 'Describe the tasks')
  })
  it('is saved per candidate and date, can be updated the same day, and shows on the shift', async () => {
    await as(BOB, `select submit_progress_report('Built the login page', 'React Router', 'PR #12', null, null, 'Tests')`)
    await as(BOB, `select submit_progress_report('Built the login and reset pages', 'React Router')`)
    const rows = await as(BOB, `select tasks_completed, deliverables from progress_reports`)
    expect(rows).toEqual([{ tasks_completed: 'Built the login and reset pages', deliverables: null }])
    expect((await shift(BOB)).report_submitted).toBe(true)
    expect(await as(MENTOR, `select * from progress_reports where candidate_id = $1`, [BOB])).toHaveLength(1)
    expect(await as(MENTOR2, `select * from progress_reports`)).toHaveLength(0)
    expect(await as(ALICE, `select * from progress_reports`)).toHaveLength(0)
    await fails(as(BOB, `update progress_reports set report_date = report_date - 1`), 'permission denied')
  })
})

describe('staff reviews', () => {
  it('assigned mentors add notes; outcome distinguishes a confirmed violation from a flag', async () => {
    await as(MENTOR, `insert into attendance_reviews (candidate_id, work_date, outcome, note, follow_up)
      values ($1, sast_today(), 'excused', 'Load-shedding at home', 'None')`, [BOB])
    await as(MENTOR, `insert into attendance_reviews (candidate_id, week_start, needs_support, note)
      values ($1, date_trunc('week', sast_today())::date, true, 'Struggling with React hooks')`, [ALICE])
    const rows = await as(MENTOR, `select reviewer_id, outcome from attendance_reviews order by created_at`)
    expect(rows.map((r) => r.reviewer_id)).toEqual([MENTOR, MENTOR])
  })
  it('cannot be written by other mentors or candidates, spoofed, or edited', async () => {
    await fails(as(MENTOR2, `insert into attendance_reviews (candidate_id, work_date, note) values ($1, sast_today(), 'Not mine')`, [BOB]), 'row-level security')
    await fails(as(BOB, `insert into attendance_reviews (candidate_id, work_date, note) values ($1, sast_today(), 'All good')`, [BOB]), 'row-level security')
    await fails(as(MENTOR, `insert into attendance_reviews (candidate_id, work_date, note, reviewer_id) values ($1, sast_today(), 'x x x', $2)`, [BOB, MENTOR2]), 'permission denied')
    await fails(as(MENTOR, `update attendance_reviews set outcome = 'confirmed_violation'`), 'permission denied')
    expect(await as(BOB, `select * from attendance_reviews`)).toHaveLength(0)
  })
})
