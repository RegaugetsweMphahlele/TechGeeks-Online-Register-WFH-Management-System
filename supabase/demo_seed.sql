-- Demo data for live location + shifts. Run in the Supabase SQL editor AFTER the migrations.
-- Uses the existing candidate/mentor profiles; safe to re-run (never overwrites real values).
-- Covers the last 10 weekdays before today, per active candidate:
--   • attendance (shifts) with GPS location — office or WFH, some late / early / absent days
--   • tea + lunch breaks, some overrunning
--   • approved WFH requests (with location) for WFH days, plus one pending request ahead
--   • daily progress reports, and a few Tech Champion reviews

begin;

-- Seeded rows are not real clock events: keep them out of the audit trail / notifications.
alter table public.attendance_records disable trigger attendance_audit;
alter table public.attendance_records disable trigger attendance_late_flag;
alter table public.shift_breaks       disable trigger shift_breaks_audit;

-- Candidate × day grid with a deterministic 0–99 "roll" so re-runs give the same data.
create temp table demo_days on commit drop as
select c.id as candidate_id, c.mentor_id, d::date as day,
       abs(hashtext(c.id::text || d::text)) % 100 as r,
       row_number() over (partition by d order by c.id) as n
  from public.profiles c
 cross join generate_series(public.sast_today() - 14, public.sast_today() - 1, interval '1 day') d
 where c.role = 'candidate' and c.status = 'active'
   and extract(isodow from d) <= 5;

-- Places: one office + a handful of WFH homes around Cape Town / Joburg.
create temp table demo_places (i int, lat float8, lng float8, address text) on commit drop;
insert into demo_places values
  (0, -33.92750, 18.44970, 'Office (demo), Woodstock, Cape Town, 7925'),
  (1, -33.98420, 18.57110, 'Athlone, Cape Town, 7764'),
  (2, -34.03930, 18.67250, 'Mitchells Plain, Cape Town, 7785'),
  (3, -33.89310, 18.51270, 'Goodwood, Cape Town, 7460'),
  (4, -26.26780, 27.85850, 'Soweto, Johannesburg, 1804'),
  (5, -26.10760, 28.05670, 'Sandton, Johannesburg, 2196');

-- 1) Old demo shifts with no location: give them one.
update public.attendance_records a
   set location_latitude  = p.lat + (abs(hashtext(a.id::text)) % 50) / 100000.0,
       location_longitude = p.lng + (abs(hashtext(a.id::text)) % 50) / 100000.0,
       location_address   = p.address
  from demo_places p
 where a.location_latitude is null
   and p.i = case when a.work_mode = 'office' then 0 else 1 + abs(hashtext(a.candidate_id::text)) % 5 end;

-- 2) New shifts for days that don't have one (r >= 95 → absent).
insert into public.attendance_records
  (candidate_id, attendance_date, work_mode, location_note, notes,
   check_in_at, check_out_at, location_latitude, location_longitude, location_address)
select g.candidate_id, g.day, g.mode,
       case when g.mode = 'office' then 'Office' else 'Home' end,
       case when g.r % 20 > 10 then 'Taxi delays this morning' end,
       public.sast_at(g.day, '08:50') + make_interval(mins => g.r % 20),                -- r%20 > 10 → late
       public.sast_at(g.day, case when g.r < 8 then time '15:35' else time '16:00' end)
         + make_interval(mins => g.r % 15),                                              -- r < 8 → early out
       p.lat + (g.r % 50) / 100000.0, p.lng + (g.r % 50) / 100000.0, p.address
  from (select d.*, case when d.r between 70 and 84 then 'wfh' else 'office' end::public.work_mode as mode
          from demo_days d where d.r < 95) g
  join demo_places p
    on p.i = case when g.mode = 'office' then 0 else 1 + abs(hashtext(g.candidate_id::text)) % 5 end
on conflict (candidate_id, attendance_date) do nothing;

-- 3) Tea + lunch for every closed shift in range that spans the break windows.
insert into public.shift_breaks
  (attendance_id, candidate_id, break_type, started_at, ended_at, scheduled_start, scheduled_end)
select a.id, a.candidate_id, b.t,
       public.sast_at(a.attendance_date, b.ws) + make_interval(mins => d.r % 6),
       public.sast_at(a.attendance_date, b.ws) + make_interval(mins => d.r % 6)
         + (b.we - b.ws) + make_interval(mins => case when d.r % 7 = 0 then 12 else 0 end), -- some overrun
       public.sast_at(a.attendance_date, b.ws), public.sast_at(a.attendance_date, b.we)
  from public.attendance_records a
  join demo_days d on d.candidate_id = a.candidate_id and d.day = a.attendance_date
  cross join public.shift_schedule s
  cross join lateral (values ('tea'::public.break_type, s.tea_start, s.tea_end),
                             ('lunch'::public.break_type, s.lunch_start, s.lunch_end)) b(t, ws, we)
 where a.check_out_at is not null
   and a.check_in_at  < public.sast_at(a.attendance_date, s.tea_start)
   and a.check_out_at > public.sast_at(a.attendance_date, s.lunch_end) + interval '15 minutes'
on conflict (attendance_id, break_type) do nothing;

-- 4) WFH requests behind each WFH shift (approved when the candidate has a Tech Champion).
insert into public.wfh_requests
  (candidate_id, requested_date, reason, details, status, submitted_at, reviewed_by, reviewed_at,
   location_latitude, location_longitude, location_address)
select a.candidate_id, a.attendance_date,
       (array['Transport disruption', 'Medical appointment', 'Family responsibility'])[1 + d.r % 3], null,
       case when d.mentor_id is null then 'pending' else 'approved' end::public.wfh_status,
       public.sast_at(a.attendance_date - 1, '17:30'),
       d.mentor_id,
       case when d.mentor_id is not null then public.sast_at(a.attendance_date - 1, '18:15') end,
       a.location_latitude, a.location_longitude, a.location_address
  from public.attendance_records a
  join demo_days d on d.candidate_id = a.candidate_id and d.day = a.attendance_date
 where a.work_mode = 'wfh'
on conflict do nothing;

-- One pending request ahead for the first candidate, for the mentor's inbox.
insert into public.wfh_requests (candidate_id, requested_date, reason, details,
                                 location_latitude, location_longitude, location_address)
select d.candidate_id,
       public.sast_today() + case extract(isodow from public.sast_today())::int when 5 then 3 when 6 then 2 else 1 end,
       'Home internet installation', 'Technician booked between 10:00 and 12:00',
       p.lat, p.lng, p.address
  from demo_days d join demo_places p on p.i = 3
 where d.n = 1 and d.day = (select max(day) from demo_days)
on conflict do nothing;

-- 5) Daily progress updates for each worked day.
insert into public.progress_reports
  (candidate_id, report_date, tasks_completed, learning, deliverables, challenges, support_needed, next_day_plan, submitted_at)
select a.candidate_id, a.attendance_date,
       (array['Finished the React components module and its exercises',
              'Built the login form and wired it to the API',
              'Worked through SQL joins and practised on the sample database',
              'Paired on fixing failing unit tests in the group project',
              'Completed the Git branching and pull request lab'])[1 + d.r % 5],
       (array['useEffect cleanup', 'Row level security', 'LEFT vs INNER joins', 'Mocking in Jest', 'Rebasing'])[1 + d.r % 5],
       case when d.r % 2 = 0 then 'Pushed work to the team repo' end,
       case when d.r % 4 = 0 then 'Slow internet in the afternoon' end,
       case when d.r % 9 = 0 then 'Would like a walkthrough of the deployment steps' end,
       'Continue with the next module and review feedback',
       coalesce(a.check_out_at, public.sast_at(a.attendance_date, '16:00')) - interval '5 minutes'
  from public.attendance_records a
  join demo_days d on d.candidate_id = a.candidate_id and d.day = a.attendance_date
on conflict (candidate_id, report_date) do nothing;

-- 6) A few Tech Champion reviews on late days (only for candidates with a Tech Champion).
insert into public.attendance_reviews (candidate_id, work_date, outcome, needs_support, note, reviewer_id, created_at)
select d.candidate_id, d.day,
       (array['noted', 'excused', 'follow_up']::public.review_outcome[])[1 + d.r % 3],
       d.r % 3 = 2,
       'Late clock-in discussed with candidate — transport issue',
       d.mentor_id, public.sast_at(d.day, '16:30')
  from demo_days d
 where d.mentor_id is not null and d.r < 95 and d.r % 20 > 15
   and not exists (select 1 from public.attendance_reviews x where x.candidate_id = d.candidate_id and x.work_date = d.day);

alter table public.attendance_records enable trigger attendance_audit;
alter table public.attendance_records enable trigger attendance_late_flag;
alter table public.shift_breaks       enable trigger shift_breaks_audit;

commit;

-- Quick check:
-- select full_name, attendance_date, work_mode, location_address, check_in_at, check_out_at
--   from public.attendance_overview order by attendance_date desc, full_name limit 30;

