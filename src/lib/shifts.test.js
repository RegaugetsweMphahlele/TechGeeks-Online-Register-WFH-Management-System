import { describe, expect, it } from 'vitest'
import { expectedDays, formatMinutes, offScheduleWarning, scheduledMinutes, shiftActions, shiftFlags, shiftState, shiftTotals, timeline, weeklySummary } from './shifts.js'

const S = { workday_start: '09:00:00', workday_end: '16:00:00', tea_start: '10:30:00', tea_end: '10:45:00',
  lunch_start: '12:00:00', lunch_end: '13:00:00', break_window_minutes: 15 }
const open = { shift_status: 'working', check_in_at: '2026-10-20T07:00:00Z', scheduled_start: '2026-10-20T07:00:00Z', scheduled_end: '2026-10-20T14:00:00Z' }

describe('schedule', () => {
  it('standard day is 7h elapsed, 15m tea, 60m lunch, 5h45 net', () => {
    expect(scheduledMinutes(S)).toEqual({ elapsed: 420, tea: 15, lunch: 60, net: 345 })
    expect(formatMinutes(345)).toBe('5h 45m')
    expect(formatMinutes(9)).toBe('9m')
    expect(formatMinutes(null)).toBe('—')
  })
})

describe('shiftActions mirror the server rules', () => {
  it('clock in first; nothing after clocking out or on an incomplete shift', () => {
    expect(shiftActions(null, S).primary).toBe('clock_in')
    expect(shiftActions({ ...open, check_out_at: 'x' }, S).primary).toBeNull()
    expect(shiftActions({ ...open, shift_status: 'incomplete' }, S).primary).toBeNull()
  })
  it('only "end break" during a break — no lunch while tea is open, no clock-out', () => {
    expect(shiftActions({ ...open, open_break: 'tea', tea_started_at: 'x' }, S, '10:35')).toEqual({ primary: 'end_tea', others: [] })
  })
  it('suggests by schedule and never offers a break already taken', () => {
    expect(shiftActions(open, S, '09:30')).toEqual({ primary: 'start_tea', others: ['start_lunch', 'clock_out'] })
    expect(shiftActions(open, S, '12:05').primary).toBe('start_lunch') // skipped tea still possible
    const afterTea = { ...open, tea_started_at: 'x', tea_ended_at: 'y' }
    expect(shiftActions(afterTea, S, '11:00')).toEqual({ primary: 'start_lunch', others: ['clock_out'] })
    expect(shiftActions({ ...afterTea, lunch_started_at: 'x', lunch_ended_at: 'y' }, S, '15:00')).toEqual({ primary: 'clock_out', others: [] })
    expect(shiftActions(afterTea, S, '16:00').primary).toBe('clock_out')
  })
})

describe('off-schedule warnings', () => {
  it('break inside its window (or a little early) is fine', () => {
    expect(offScheduleWarning('start_tea', S, '10:30')).toBeNull()
    expect(offScheduleWarning('start_tea', S, '10:15')).toBeNull()
    expect(offScheduleWarning('start_lunch', S, '13:00')).toBeNull()
  })
  it('too early, too late and early clock-out are explained', () => {
    expect(offScheduleWarning('start_tea', S, '09:30')).toMatch(/10:30–10:45.*this early/)
    expect(offScheduleWarning('start_lunch', S, '13:20')).toMatch(/after the window/)
    expect(offScheduleWarning('clock_out', S, '15:00')).toMatch(/early departure/)
    expect(offScheduleWarning('clock_out', S, '16:00')).toBeNull()
  })
})

describe('state, flags and totals', () => {
  it('no clock-in is never treated as present', () => {
    expect(shiftState(null, { date: '2026-10-19', today: '2026-10-20' }).label).toBe('Absent')
    expect(shiftState(null, { date: '2026-10-20', today: '2026-10-20', nowTime: '09:10', schedule: S }).label).toBe('Not clocked in')
    expect(shiftState(null, { date: '2026-10-20', today: '2026-10-20', nowTime: '08:00', schedule: S }).label).toBe('Not started')
    expect(shiftState(null, { date: '2026-10-24', today: '2026-10-26' }).label).toBe('No shift') // Saturday
    expect(shiftState({ ...open, shift_status: 'on_break', open_break: 'lunch' }).label).toBe('On lunch break')
  })
  it('lists detected exceptions', () => {
    expect(shiftFlags({ ...open, late: true, lunch_excessive: true, check_out_at: 'x', report_submitted: false }, '2026-10-20'))
      .toEqual(['Late arrival', 'Long lunch', 'No progress update'])
  })
  it('open shift totals are live; closed ones use the server values', () => {
    const t = shiftTotals({ ...open, tea_started_at: '2026-10-20T08:30:00Z', tea_ended_at: '2026-10-20T08:47:00Z',
      lunch_started_at: '2026-10-20T10:00:00Z' }, new Date('2026-10-20T10:30:00Z'))
    expect(t).toEqual({ elapsed: 210, breaks: 47, net: 163, final: false })
    expect(shiftTotals({ ...open, check_out_at: 'x', elapsed_minutes: 420, break_minutes: 75, net_minutes: 345 }))
      .toEqual({ elapsed: 420, breaks: 75, net: 345, final: true })
  })
  it('timeline shows actual times only where recorded', () => {
    const t = timeline({ ...open, tea_started_at: '2026-10-20T08:31:00Z' }, S)
    expect(t.find((e) => e.key === 'tea-start')).toMatchObject({ scheduled: '10:30', actual: '2026-10-20T08:31:00Z' })
    expect(t.find((e) => e.key === 'tea-end').actual).toBeUndefined()
    expect(t.find((e) => e.key === 's2').scheduled).toBe('10:45–12:00')
  })
})

describe('weekly summary', () => {
  it('expected days skip weekends, the future, and today before the start', () => {
    expect(expectedDays('2026-10-19', '2026-10-25', { today: '2026-10-22', nowTime: '08:00', schedule: S }))
      .toEqual(['2026-10-19', '2026-10-20', '2026-10-21'])
    expect(expectedDays('2026-10-19', '2026-10-25', { today: '2026-10-26', schedule: S })).toHaveLength(5)
  })
  it('counts only recorded events; missing days are missing', () => {
    const rows = [
      { attendance_date: '2026-10-19', shift_status: 'clocked_out', net_minutes: 345, tea_minutes: 15, lunch_minutes: 60, report_submitted: true },
      { attendance_date: '2026-10-20', shift_status: 'clocked_out', late: true, early_departure: true, net_minutes: 300, tea_minutes: 20, lunch_minutes: 60, tea_excessive: true, report_submitted: false },
      { attendance_date: '2026-10-21', shift_status: 'incomplete', net_minutes: null, tea_minutes: null, lunch_minutes: null, lunch_missed: true, report_submitted: false },
    ]
    const days = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23']
    expect(weeklySummary(rows, days)).toEqual({ scheduledDays: 5, attended: 3, completed: 2, late: 1, early: 1, missing: 2, incomplete: 1,
      netMinutes: 645, teaMinutes: 35, lunchMinutes: 120, breakIssues: 2, reports: 1, reportRate: 33 })
    expect(weeklySummary([], days)).toMatchObject({ attended: 0, missing: 5, netMinutes: 0, reportRate: null })
  })
})
