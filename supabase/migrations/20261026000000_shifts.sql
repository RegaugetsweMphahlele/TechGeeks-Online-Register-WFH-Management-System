-- Shifts: daily schedule, tea/lunch breaks, corrections, reviews and daily progress updates.
-- A shift IS the existing attendance record (clock in = check_in(), clock out = check_out());
-- this migration extends it rather than adding a second attendance system.
-- Same security model as the init migration: candidates never write rows directly; every
-- transition goes through SECURITY DEFINER functions that use auth.uid() and the database clock.
-- Nothing here fabricates attendance: flags are derived from recorded timestamps, and only
-- assigned Tech Champions can correct records, always with a reason and the original values kept.

-- ─────────────────────────────────────────────────────────────── schedule (single row)
-- No admin role exists in the app yet: change these in the Supabase SQL editor (see provisioning.sql).
create table public.shift_schedule (
  id                   boolean primary key default true check (id),
  workday_start        time not null default '09:00',
  workday_end          time not null default '16:00',
  tea_start            time not null default '10:30',
  tea_end              time not null default '10:45',
  lunch_start          time not null default '12:00',
  lunch_end            time not null default '13:00',
  late_grace_minutes   int  not null default 0  check (late_grace_minutes between 0 and 120),
  break_grace_minutes  int  not null default 0  check (break_grace_minutes between 0 and 60),
  -- A break started more than this many minutes before its window, or after the window ends, is flagged.
  break_window_minutes int  not null default 15 check (break_window_minutes between 0 and 240),
  updated_at           timestamptz not null default now(),
  constraint schedule_order check (workday_start <= tea_start and tea_start < tea_end and tea_end <= lunch_start
                                   and lunch_start < lunch_end and lunch_end <= workday_end and workday_start < workday_end)
);
insert into public.shift_schedule default values;
create trigger shift_schedule_updated before update on public.shift_schedule
  for each row execute function public.set_updated_at();

/** A SAST wall-clock time on a date, as an absolute timestamp. */
create or replace function public.sast_at(d date, t time) returns timestamptz
language sql immutable as $$ select (d + t) at time zone 'Africa/Johannesburg' $$;

-- ─────────────────────────────────────────────────────────────── shifts = attendance_records
alter table public.attendance_records
  add column scheduled_start timestamptz,
  add column scheduled_end   timestamptz;

-- Backfill the schedule (policy, not attendance) for existing rows without touching updated_at.
alter table public.attendance_records disable trigger attendance_updated;
update public.attendance_records a
   set scheduled_start = sast_at(a.attendance_date, s.workday_start),
       scheduled_end   = sast_at(a.attendance_date, s.workday_end)
  from public.shift_schedule s;
alter table public.attendance_records enable trigger attendance_updated;

alter table public.attendance_records
  alter column scheduled_start set not null,
  alter column scheduled_end set not null,
  add constraint scheduled_order check (scheduled_end > scheduled_start);

-- Snapshot the schedule when a shift is created, so later schedule edits don't rewrite history.
create or replace function public.snapshot_shift_schedule() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select sast_at(new.attendance_date, s.workday_start), sast_at(new.attendance_date, s.workday_end)
    into new.scheduled_start, new.scheduled_end from shift_schedule s;
  return new;
end $$;
create trigger attendance_schedule before insert on public.attendance_records
  for each row execute function public.snapshot_shift_schedule();

-- ─────────────────────────────────────────────────────────────── breaks
create type public.break_type as enum ('tea', 'lunch');

create table public.shift_breaks (
  id              uuid primary key default gen_random_uuid(),
  attendance_id   uuid not null references public.attendance_records (id) on delete cascade,
  candidate_id    uuid not null references public.profiles (id) on delete cascade,
  break_type      public.break_type not null,
  started_at      timestamptz not null,
  ended_at        timestamptz,
  scheduled_start timestamptz not null,  -- snapshot of the window, e.g. 10:30
  scheduled_end   timestamptz not null,  -- e.g. 10:45 → allowance = end − start
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (attendance_id, break_type),    -- one tea and one lunch per shift
  constraint break_end_after_start check (ended_at is null or ended_at > started_at),
  constraint break_window_order check (scheduled_end > scheduled_start)
);
create unique index shift_breaks_one_open on public.shift_breaks (attendance_id) where ended_at is null;
create index shift_breaks_candidate_idx on public.shift_breaks (candidate_id);
create trigger shift_breaks_updated before update on public.shift_breaks
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────── corrections (append-only)
create table public.attendance_corrections (
  id            uuid primary key default gen_random_uuid(),
  attendance_id uuid not null references public.attendance_records (id) on delete cascade,
  candidate_id  uuid not null references public.profiles (id) on delete cascade,
  break_type    public.break_type,       -- null = the shift's own clock-in/out
  before        jsonb,                   -- null = record created by the correction
  after         jsonb not null,
  reason        text not null check (char_length(trim(reason)) between 5 and 1000),
  corrected_by  uuid not null references public.profiles (id),
  created_at    timestamptz not null default now()
);
create index corrections_attendance_idx on public.attendance_corrections (attendance_id);

-- ─────────────────────────────────────────────────────────────── staff reviews (append-only)
-- An automatically detected exception is just a flag; only a review with outcome
-- 'confirmed_violation' records a Tech Champion's decision. Nothing issues warnings automatically.
create type public.review_outcome as enum ('noted', 'excused', 'follow_up', 'confirmed_violation');

create table public.attendance_reviews (
  id            uuid primary key default gen_random_uuid(),
  candidate_id  uuid not null references public.profiles (id) on delete cascade,
  work_date     date,                    -- daily exception review …
  week_start    date,                    -- … or weekly review (Monday)
  outcome       public.review_outcome not null default 'noted',
  needs_support boolean not null default false,
  note          text not null check (char_length(trim(note)) between 3 and 2000),
  follow_up     text check (char_length(follow_up) <= 1000),
  reviewer_id   uuid not null default auth.uid() references public.profiles (id),
  created_at    timestamptz not null default now(),
  constraint review_one_scope check ((work_date is null) <> (week_start is null)),
  constraint review_week_monday check (week_start is null or extract(isodow from week_start) = 1)
);
create index reviews_candidate_idx on public.attendance_reviews (candidate_id, created_at desc);

-- ─────────────────────────────────────────────────────────────── daily progress updates
create table public.progress_reports (
  id              uuid primary key default gen_random_uuid(),
  candidate_id    uuid not null references public.profiles (id) on delete cascade,
  report_date     date not null,
  tasks_completed text not null check (char_length(tasks_completed) between 3 and 2000),
  learning        text check (char_length(learning) <= 2000),
  deliverables    text check (char_length(deliverables) <= 2000),
  challenges      text check (char_length(challenges) <= 2000),
  support_needed  text check (char_length(support_needed) <= 2000),
  next_day_plan   text check (char_length(next_day_plan) <= 2000),
  submitted_at    timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (candidate_id, report_date)
);
create index progress_date_idx on public.progress_reports (report_date desc);
create trigger progress_updated before update on public.progress_reports
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────── event history
-- Every insert/update/delete of shift or break times lands in audit_logs, whatever the path
-- (RPC, correction, or an admin in the SQL editor), so nothing is overwritten silently.
create or replace function public.audit_shift_event() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  row_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  row_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  cand uuid := coalesce(row_new, row_old) ->> 'candidate_id';
  is_shift boolean := tg_table_name = 'attendance_records';
  start_col text := case when is_shift then 'check_in_at' else 'started_at' end;
  end_col text := case when is_shift then 'check_out_at' else 'ended_at' end;
  by_self boolean := auth.uid() is not distinct from cand;
  action text;
begin
  if tg_op = 'UPDATE' and (row_new ->> start_col, row_new ->> end_col) is not distinct from (row_old ->> start_col, row_old ->> end_col) then
    return null; -- not a time change
  end if;
  action := case
    when not by_self then case tg_op when 'DELETE' then 'deleted' else 'corrected' end
    when tg_op = 'INSERT' then case when is_shift then 'clock_in' else 'start' end
    when row_old ->> end_col is null and row_new ->> end_col is not null then case when is_shift then 'clock_out' else 'end' end
    else 'changed' end;
  insert into audit_logs (actor_id, action, entity, entity_id, details)
  values (auth.uid(), (case when is_shift then 'shift.' else 'break.' end) || action, tg_table_name,
          (coalesce(row_new, row_old) ->> 'id')::uuid,
          jsonb_build_object('candidate_id', cand, 'break_type', coalesce(row_new, row_old) ->> 'break_type',
            'before', case when row_old is not null then jsonb_build_object('start', row_old -> start_col, 'end', row_old -> end_col) end,
            'after',  case when row_new is not null then jsonb_build_object('start', row_new -> start_col, 'end', row_new -> end_col) end));
  return null;
end $$;
create trigger attendance_audit after insert or update or delete on public.attendance_records
  for each row execute function public.audit_shift_event();
create trigger shift_breaks_audit after insert or update or delete on public.shift_breaks
  for each row execute function public.audit_shift_event();

-- ─────────────────────────────────────────────────────────────── in-app alerts
create or replace function public.notify_mentor(p_candidate uuid, p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = public as $$
  insert into notifications (user_id, title, body, link)
  select mentor_id, p_title, full_name || ' ' || p_body, p_link from profiles where id = p_candidate and mentor_id is not null
$$;

create or replace function public.shift_link(p_candidate uuid, p_date date) returns text
language sql immutable as $$ select '/mentor/shifts/' || p_candidate || '?date=' || p_date $$;

-- Late clock-in → flag for review (not a warning). Only for the candidate's own clock-in.
create or replace function public.flag_late_clock_in() returns trigger
language plpgsql security definer set search_path = public as $$
declare grace int;
begin
  select late_grace_minutes into grace from shift_schedule;
  if auth.uid() = new.candidate_id and date_trunc('minute', new.check_in_at) > new.scheduled_start + make_interval(mins => grace) then
    perform notify_mentor(new.candidate_id, 'Late clock-in flagged',
      format('clocked in at %s (scheduled %s). Flagged for your review.',
             to_char(new.check_in_at at time zone 'Africa/Johannesburg', 'HH24:MI'),
             to_char(new.scheduled_start at time zone 'Africa/Johannesburg', 'HH24:MI')),
      shift_link(new.candidate_id, new.attendance_date));
  end if;
  return null;
end $$;
create trigger attendance_late_flag after insert on public.attendance_records
  for each row execute function public.flag_late_clock_in();

-- ─────────────────────────────────────────────────────────────── RPCs
-- Clock out = check_out(), now refusing while a break is open and flagging early departures.
create or replace function public.check_out() returns public.attendance_records
language plpgsql security definer set search_path = public as $$
declare rec attendance_records; open_type break_type;
begin
  if not current_role_is('candidate') then raise exception 'Only active candidates can register attendance' using errcode = '42501'; end if;
  -- Lock today's shift first so a break can't start between the check below and the update.
  select * into rec from attendance_records where candidate_id = auth.uid() and attendance_date = sast_today() for update;
  if not found then raise exception 'Check in before checking out' using errcode = 'P0001'; end if;
  if rec.check_out_at is not null then raise exception 'You have already checked out today' using errcode = 'P0001'; end if;
  select break_type into open_type from shift_breaks where attendance_id = rec.id and ended_at is null;
  if found then raise exception 'End your % break before clocking out', open_type using errcode = 'P0001'; end if;
  update attendance_records set check_out_at = now() where id = rec.id returning * into rec;
  if rec.check_out_at < rec.scheduled_end then
    perform notify_mentor(rec.candidate_id, 'Early clock-out flagged',
      format('clocked out at %s (scheduled %s). Flagged for your review.',
             to_char(rec.check_out_at at time zone 'Africa/Johannesburg', 'HH24:MI'),
             to_char(rec.scheduled_end at time zone 'Africa/Johannesburg', 'HH24:MI')),
      shift_link(rec.candidate_id, rec.attendance_date));
  end if;
  return rec;
end $$;

-- Breaks may start outside their window (meetings happen); the view flags them as off-schedule.
create or replace function public.start_break(p_type public.break_type) returns public.shift_breaks
language plpgsql security definer set search_path = public as $$
declare shift attendance_records; rec shift_breaks; s shift_schedule; open_type break_type;
begin
  if not current_role_is('candidate') then raise exception 'Only active candidates can record breaks' using errcode = '42501'; end if;
  if p_type is null then raise exception 'Choose a break type' using errcode = 'P0001'; end if;
  select * into shift from attendance_records where candidate_id = auth.uid() and attendance_date = sast_today() for update;
  if not found then raise exception 'Clock in before starting a break' using errcode = 'P0001'; end if;
  if shift.check_out_at is not null then raise exception 'You have already clocked out today' using errcode = 'P0001'; end if;
  select break_type into open_type from shift_breaks where attendance_id = shift.id and ended_at is null;
  if found then raise exception 'End your % break first', open_type using errcode = 'P0001'; end if;
  if exists (select 1 from shift_breaks where attendance_id = shift.id and break_type = p_type) then
    raise exception 'Your % break has already been recorded today', p_type using errcode = 'P0001';
  end if;
  select * into s from shift_schedule;
  insert into shift_breaks (attendance_id, candidate_id, break_type, started_at, scheduled_start, scheduled_end)
  values (shift.id, auth.uid(), p_type, now(),
          sast_at(shift.attendance_date, case p_type when 'tea' then s.tea_start else s.lunch_start end),
          sast_at(shift.attendance_date, case p_type when 'tea' then s.tea_end else s.lunch_end end))
  returning * into rec;
  return rec;
end $$;

create or replace function public.end_break() returns public.shift_breaks
language plpgsql security definer set search_path = public as $$
declare rec shift_breaks; grace int;
begin
  if not current_role_is('candidate') then raise exception 'Only active candidates can record breaks' using errcode = '42501'; end if;
  update shift_breaks b set ended_at = now()
    from attendance_records a
   where a.id = b.attendance_id and a.candidate_id = auth.uid() and a.attendance_date = sast_today() and b.ended_at is null
  returning b.* into rec;
  if rec.id is null then
    if exists (select 1 from shift_breaks where candidate_id = auth.uid() and ended_at is null) then
      raise exception 'A break from an earlier day is still open. Ask your Tech Champion to resolve it.' using errcode = 'P0001';
    end if;
    raise exception 'You have no active break to end' using errcode = 'P0001';
  end if;
  select break_grace_minutes into grace from shift_schedule;
  if rec.ended_at - rec.started_at > rec.scheduled_end - rec.scheduled_start + make_interval(mins => grace) then
    perform notify_mentor(rec.candidate_id, initcap(rec.break_type::text) || ' break over allowance',
      format('took a %s-minute %s break (allowed %s). Flagged for your review.',
             round(extract(epoch from rec.ended_at - rec.started_at) / 60), rec.break_type,
             round(extract(epoch from rec.scheduled_end - rec.scheduled_start) / 60)),
      (select shift_link(rec.candidate_id, attendance_date) from attendance_records where id = rec.attendance_id));
  end if;
  return rec;
end $$;

create or replace function public.submit_progress_report(
  p_tasks text, p_learning text default null, p_deliverables text default null,
  p_challenges text default null, p_support text default null, p_next_plan text default null
) returns public.progress_reports
language plpgsql security definer set search_path = public as $$
declare rec progress_reports;
begin
  if not current_role_is('candidate') then raise exception 'Only active candidates can submit progress updates' using errcode = '42501'; end if;
  if not exists (select 1 from attendance_records where candidate_id = auth.uid() and attendance_date = sast_today()) then
    raise exception 'Clock in before submitting your daily progress update' using errcode = 'P0001';
  end if;
  if char_length(trim(coalesce(p_tasks, ''))) < 3 then raise exception 'Describe the tasks you completed' using errcode = 'P0001'; end if;
  insert into progress_reports (candidate_id, report_date, tasks_completed, learning, deliverables, challenges, support_needed, next_day_plan)
  values (auth.uid(), sast_today(), trim(p_tasks), nullif(trim(p_learning), ''), nullif(trim(p_deliverables), ''),
          nullif(trim(p_challenges), ''), nullif(trim(p_support), ''), nullif(trim(p_next_plan), ''))
  on conflict (candidate_id, report_date) do update set
    tasks_completed = excluded.tasks_completed, learning = excluded.learning, deliverables = excluded.deliverables,
    challenges = excluded.challenges, support_needed = excluded.support_needed, next_day_plan = excluded.next_day_plan
  returning * into rec;
  return rec;
end $$;

create or replace function public.check_correction_reason(p_reason text) returns text
language plpgsql immutable as $$
begin
  if char_length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'Give a reason for the correction (5+ characters)' using errcode = 'P0001'; end if;
  if char_length(trim(p_reason)) > 1000 then raise exception 'Keep the reason under 1000 characters' using errcode = 'P0001'; end if;
  return trim(p_reason);
end $$;

-- Tech Champion correction of a shift's clock-in/out, or recording a shift the candidate forgot to clock in for.
create or replace function public.correct_shift(
  p_candidate uuid, p_date date, p_check_in_at timestamptz, p_check_out_at timestamptz,
  p_reason text, p_work_mode public.work_mode default null
) returns public.attendance_records
language plpgsql security definer set search_path = public as $$
declare prev attendance_records; rec attendance_records; why text;
begin
  if not is_my_candidate(p_candidate) then raise exception 'Candidate not found or not assigned to you' using errcode = '42501'; end if;
  why := check_correction_reason(p_reason);
  if p_date is null or p_date > sast_today() then raise exception 'Choose today or an earlier date' using errcode = 'P0001'; end if;
  if p_check_in_at is null then raise exception 'Clock-in time is required' using errcode = 'P0001'; end if;
  if (p_check_in_at at time zone 'Africa/Johannesburg')::date <> p_date then
    raise exception 'Clock-in must be on the selected working date' using errcode = 'P0001';
  end if;
  if greatest(p_check_in_at, p_check_out_at) > now() then raise exception 'Times cannot be in the future' using errcode = 'P0001'; end if;
  if p_check_out_at <= p_check_in_at then raise exception 'Clock-out must be after clock-in' using errcode = 'P0001'; end if;
  if p_check_out_at > p_check_in_at + interval '24 hours' then raise exception 'A shift cannot be longer than 24 hours' using errcode = 'P0001'; end if;

  select * into prev from attendance_records where candidate_id = p_candidate and attendance_date = p_date for update;
  if found then
    if exists (select 1 from shift_breaks where attendance_id = prev.id
                 and (started_at < p_check_in_at or coalesce(ended_at, 'infinity') > coalesce(p_check_out_at, 'infinity'))) then
      raise exception 'Breaks must fall within the shift. Resolve open or conflicting breaks first' using errcode = 'P0001';
    end if;
    update attendance_records set check_in_at = p_check_in_at, check_out_at = p_check_out_at,
           work_mode = coalesce(p_work_mode, work_mode)
     where id = prev.id returning * into rec;
  else
    if p_work_mode is null then raise exception 'Choose a work mode for the new shift' using errcode = 'P0001'; end if;
    insert into attendance_records (candidate_id, attendance_date, work_mode, check_in_at, check_out_at, notes)
    values (p_candidate, p_date, p_work_mode, p_check_in_at, p_check_out_at, 'Recorded by Tech Champion')
    returning * into rec;
  end if;

  insert into attendance_corrections (attendance_id, candidate_id, before, after, reason, corrected_by)
  values (rec.id, p_candidate,
          case when prev.id is not null then jsonb_build_object('check_in_at', prev.check_in_at, 'check_out_at', prev.check_out_at, 'work_mode', prev.work_mode) end,
          jsonb_build_object('check_in_at', rec.check_in_at, 'check_out_at', rec.check_out_at, 'work_mode', rec.work_mode),
          why, auth.uid());
  insert into notifications (user_id, title, body, link)
  values (p_candidate, 'Attendance corrected',
          'Your shift for ' || to_char(p_date, 'Dy, DD Mon YYYY') || ' was corrected by your Tech Champion: ' || why, '/candidate/shifts');
  return rec;
end $$;

-- Tech Champion resolution of a break: close an open one, fix its times, or record one that wasn't logged.
create or replace function public.correct_break(
  p_attendance_id uuid, p_type public.break_type, p_started_at timestamptz, p_ended_at timestamptz, p_reason text
) returns public.shift_breaks
language plpgsql security definer set search_path = public as $$
declare shift attendance_records; prev shift_breaks; rec shift_breaks; s shift_schedule; why text;
begin
  select * into shift from attendance_records where id = p_attendance_id for update;
  if not found or not is_my_candidate(shift.candidate_id) then raise exception 'Shift not found or not assigned to you' using errcode = '42501'; end if;
  why := check_correction_reason(p_reason);
  if p_type is null then raise exception 'Choose a break type' using errcode = 'P0001'; end if;
  if p_started_at is null or p_ended_at is null then raise exception 'Break start and end times are required' using errcode = 'P0001'; end if;
  if p_ended_at <= p_started_at then raise exception 'A break must end after it starts' using errcode = 'P0001'; end if;
  if p_ended_at > now() then raise exception 'Times cannot be in the future' using errcode = 'P0001'; end if;
  if p_started_at < shift.check_in_at or p_ended_at > coalesce(shift.check_out_at, 'infinity') then
    raise exception 'The break must fall within the shift''s clock-in and clock-out times' using errcode = 'P0001';
  end if;
  if exists (select 1 from shift_breaks where attendance_id = shift.id and break_type <> p_type
               and tstzrange(started_at, coalesce(ended_at, 'infinity')) && tstzrange(p_started_at, p_ended_at)) then
    raise exception 'The break overlaps the other break' using errcode = 'P0001';
  end if;

  select * into prev from shift_breaks where attendance_id = shift.id and break_type = p_type for update;
  if found then
    update shift_breaks set started_at = p_started_at, ended_at = p_ended_at where id = prev.id returning * into rec;
  else
    select * into s from shift_schedule;
    insert into shift_breaks (attendance_id, candidate_id, break_type, started_at, ended_at, scheduled_start, scheduled_end)
    values (shift.id, shift.candidate_id, p_type, p_started_at, p_ended_at,
            sast_at(shift.attendance_date, case p_type when 'tea' then s.tea_start else s.lunch_start end),
            sast_at(shift.attendance_date, case p_type when 'tea' then s.tea_end else s.lunch_end end))
    returning * into rec;
  end if;

  insert into attendance_corrections (attendance_id, candidate_id, break_type, before, after, reason, corrected_by)
  values (shift.id, shift.candidate_id, p_type,
          case when prev.id is not null then jsonb_build_object('started_at', prev.started_at, 'ended_at', prev.ended_at) end,
          jsonb_build_object('started_at', rec.started_at, 'ended_at', rec.ended_at), why, auth.uid());
  insert into notifications (user_id, title, body, link)
  values (shift.candidate_id, 'Attendance corrected',
          'Your ' || p_type || ' break on ' || to_char(shift.attendance_date, 'Dy, DD Mon YYYY') ||
          ' was corrected by your Tech Champion: ' || why, '/candidate/shifts');
  return rec;
end $$;

-- ─────────────────────────────────────────────────────────────── overview (appends shift columns)
-- All durations/flags are derived from recorded timestamps here, never stored or sent by the browser.
-- Open shifts/breaks have null durations: an unfinished value is never presented as final.
create or replace view public.attendance_overview with (security_invoker = true) as
select a.id, a.candidate_id, a.attendance_date, a.work_mode, a.location_note, a.notes,
       a.check_in_at, a.check_out_at, a.created_at, a.updated_at,
       p.full_name, p.candidate_identifier, p.cohort, p.mentor_id,
       round(extract(epoch from (a.check_out_at - a.check_in_at)) / 3600.0, 2) as hours,
       exists (select 1 from wfh_requests w where w.candidate_id = a.candidate_id
                 and w.requested_date = a.attendance_date and w.status = 'approved') as wfh_approved,
       a.location_latitude, a.location_longitude, a.location_address,
       -- shifts
       a.scheduled_start, a.scheduled_end,
       case when a.check_out_at is not null then 'clocked_out'
            when a.attendance_date < sast_today() then 'incomplete'
            when b.open_break is not null then 'on_break'
            else 'working' end as shift_status,
       date_trunc('minute', a.check_in_at) > a.scheduled_start + make_interval(mins => s.late_grace_minutes) as late,
       a.check_out_at < a.scheduled_end as early_departure,
       round(extract(epoch from a.check_out_at - a.check_in_at) / 60)::int as elapsed_minutes,
       round(coalesce(b.break_seconds, 0) / 60)::int as break_minutes,
       round((extract(epoch from a.check_out_at - a.check_in_at) - coalesce(b.break_seconds, 0)) / 60)::int as net_minutes,
       b.open_break,
       b.open_break is not null and a.attendance_date < sast_today() as break_incomplete,
       b.tea_started_at, b.tea_ended_at, round(b.tea_seconds / 60)::int as tea_minutes, coalesce(b.tea_excessive, false) as tea_excessive,
       b.lunch_started_at, b.lunch_ended_at, round(b.lunch_seconds / 60)::int as lunch_minutes, coalesce(b.lunch_excessive, false) as lunch_excessive,
       b.tea_started_at is null and (a.check_out_at is not null or a.attendance_date < sast_today()) as tea_missed,
       b.lunch_started_at is null and (a.check_out_at is not null or a.attendance_date < sast_today()) as lunch_missed,
       coalesce(b.off_schedule, false) as break_off_schedule,
       exists (select 1 from attendance_corrections c where c.attendance_id = a.id) as corrected,
       exists (select 1 from progress_reports r where r.candidate_id = a.candidate_id and r.report_date = a.attendance_date) as report_submitted
  from attendance_records a
  join profiles p on p.id = a.candidate_id
  cross join shift_schedule s
  left join lateral (
    select max(x.started_at) filter (where x.break_type = 'tea') as tea_started_at,
           max(x.ended_at)   filter (where x.break_type = 'tea') as tea_ended_at,
           max(extract(epoch from x.ended_at - x.started_at)) filter (where x.break_type = 'tea') as tea_seconds,
           bool_or(x.ended_at - x.started_at > x.scheduled_end - x.scheduled_start + make_interval(mins => s.break_grace_minutes))
             filter (where x.break_type = 'tea') as tea_excessive,
           max(x.started_at) filter (where x.break_type = 'lunch') as lunch_started_at,
           max(x.ended_at)   filter (where x.break_type = 'lunch') as lunch_ended_at,
           max(extract(epoch from x.ended_at - x.started_at)) filter (where x.break_type = 'lunch') as lunch_seconds,
           bool_or(x.ended_at - x.started_at > x.scheduled_end - x.scheduled_start + make_interval(mins => s.break_grace_minutes))
             filter (where x.break_type = 'lunch') as lunch_excessive,
           sum(extract(epoch from x.ended_at - x.started_at)) as break_seconds, -- completed breaks only (open → null)
           max(x.break_type::text) filter (where x.ended_at is null) as open_break,
           bool_or(x.started_at < x.scheduled_start - make_interval(mins => s.break_window_minutes) or x.started_at > x.scheduled_end) as off_schedule
      from shift_breaks x where x.attendance_id = a.id
  ) b on true;

create view public.correction_overview with (security_invoker = true) as
select c.*, a.attendance_date, p.full_name as corrected_by_name
  from attendance_corrections c
  join attendance_records a on a.id = c.attendance_id
  left join profiles p on p.id = c.corrected_by;

-- ─────────────────────────────────────────────────────────────── RLS
alter table public.shift_schedule         enable row level security;
alter table public.shift_breaks           enable row level security;
alter table public.attendance_corrections enable row level security;
alter table public.attendance_reviews     enable row level security;
alter table public.progress_reports       enable row level security;

create policy "schedule: everyone signed in" on public.shift_schedule for select to authenticated using (true);
create policy "breaks: own or my candidates" on public.shift_breaks for select to authenticated
  using (candidate_id = auth.uid() or is_my_candidate(candidate_id));
create policy "corrections: own or my candidates" on public.attendance_corrections for select to authenticated
  using (candidate_id = auth.uid() or is_my_candidate(candidate_id));
create policy "progress: own or my candidates" on public.progress_reports for select to authenticated
  using (candidate_id = auth.uid() or is_my_candidate(candidate_id));
-- Staff notes stay with staff.
create policy "reviews: my candidates" on public.attendance_reviews for select to authenticated
  using (is_my_candidate(candidate_id));
create policy "reviews: add for my candidates" on public.attendance_reviews for insert to authenticated
  with check (reviewer_id = auth.uid() and is_my_candidate(candidate_id));
create policy "audit: mentors read their candidates' shift events" on public.audit_logs for select to authenticated
  using (entity in ('attendance_records', 'shift_breaks') and is_my_candidate((details ->> 'candidate_id')::uuid));

-- ─────────────────────────────────────────────────────────────── grants
revoke all on public.shift_schedule, public.shift_breaks, public.attendance_corrections,
              public.attendance_reviews, public.progress_reports, public.correction_overview from anon, authenticated;
grant select on public.shift_schedule, public.shift_breaks, public.attendance_corrections,
                public.attendance_reviews, public.progress_reports, public.correction_overview to authenticated;
grant insert (candidate_id, work_date, week_start, outcome, needs_support, note, follow_up)
  on public.attendance_reviews to authenticated;

revoke execute on function public.snapshot_shift_schedule(), public.audit_shift_event(),
  public.notify_mentor(uuid, text, text, text), public.shift_link(uuid, date), public.flag_late_clock_in(),
  public.check_correction_reason(text), public.check_out(), public.start_break(public.break_type), public.end_break(),
  public.submit_progress_report(text, text, text, text, text, text),
  public.correct_shift(uuid, date, timestamptz, timestamptz, text, public.work_mode),
  public.correct_break(uuid, public.break_type, timestamptz, timestamptz, text) from public, anon;
revoke execute on function public.notify_mentor(uuid, text, text, text) from authenticated;
grant execute on function public.sast_at(date, time), public.check_out(), public.start_break(public.break_type), public.end_break(),
  public.submit_progress_report(text, text, text, text, text, text),
  public.correct_shift(uuid, date, timestamptz, timestamptz, text, public.work_mode),
  public.correct_break(uuid, public.break_type, timestamptz, timestamptz, text) to authenticated;
