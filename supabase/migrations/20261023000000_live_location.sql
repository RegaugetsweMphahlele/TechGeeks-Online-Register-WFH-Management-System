alter table public.attendance_records
  add column location_latitude double precision,
  add column location_longitude double precision,
  add column location_address text,
  add constraint attendance_location_pair check (
    (location_latitude is null and location_longitude is null) or
    (location_latitude is not null and location_longitude is not null and
     location_latitude between -90 and 90 and location_longitude between -180 and 180)
  ),
  add constraint attendance_location_address_length check (
    location_address is null or char_length(location_address) <= 500
  );

alter table public.wfh_requests
  add column location_latitude double precision,
  add column location_longitude double precision,
  add column location_address text,
  add constraint wfh_location_pair check (
    (location_latitude is null and location_longitude is null) or
    (location_latitude is not null and location_longitude is not null and
     location_latitude between -90 and 90 and location_longitude between -180 and 180)
  ),
  add constraint wfh_location_address_length check (
    location_address is null or char_length(location_address) <= 500
  );

create or replace view public.attendance_overview with (security_invoker = true) as
select a.id, a.candidate_id, a.attendance_date, a.work_mode, a.location_note, a.notes,
       a.check_in_at, a.check_out_at, a.created_at, a.updated_at,
       p.full_name, p.candidate_identifier, p.cohort, p.mentor_id,
       round(extract(epoch from (a.check_out_at - a.check_in_at)) / 3600.0, 2) as hours,
       exists (select 1 from wfh_requests w where w.candidate_id = a.candidate_id
                 and w.requested_date = a.attendance_date and w.status = 'approved') as wfh_approved,
       a.location_latitude, a.location_longitude, a.location_address
  from attendance_records a join profiles p on p.id = a.candidate_id;

create or replace view public.wfh_overview with (security_invoker = true) as
select w.id, w.candidate_id, w.requested_date, w.reason, w.details, w.status,
       w.submitted_at, w.reviewed_by, w.reviewed_at, w.decision_comment, w.created_at, w.updated_at,
       p.full_name, p.candidate_identifier, p.cohort, p.mentor_id, rv.full_name as reviewer_name,
       w.location_latitude, w.location_longitude, w.location_address
  from wfh_requests w
  join profiles p on p.id = w.candidate_id
  left join profiles rv on rv.id = w.reviewed_by;

drop function public.check_in(public.work_mode, text, text);
create function public.check_in(
  p_work_mode public.work_mode,
  p_location text default null,
  p_notes text default null,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_address text default null
) returns public.attendance_records
language plpgsql security definer set search_path = public as $$
declare rec attendance_records;
begin
  if not current_role_is('candidate') then raise exception 'Only active candidates can register attendance' using errcode = '42501'; end if;
  if p_latitude is null or p_longitude is null then
    raise exception 'Get your current location before checking in' using errcode = 'P0001';
  end if;
  if p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception 'Location coordinates are invalid' using errcode = 'P0001';
  end if;
  if char_length(coalesce(p_address, '')) > 500 then
    raise exception 'Location address is too long' using errcode = 'P0001';
  end if;
  begin
    insert into attendance_records (
      candidate_id, attendance_date, work_mode, location_note, notes,
      location_latitude, location_longitude, location_address, check_in_at
    ) values (
      auth.uid(), sast_today(), p_work_mode, nullif(trim(p_location), ''), nullif(trim(p_notes), ''),
      p_latitude, p_longitude, nullif(trim(p_address), ''), now()
    ) returning * into rec;
  exception when unique_violation then
    raise exception 'You have already checked in today' using errcode = 'P0001';
  end;
  return rec;
end $$;

drop function public.submit_wfh_request(date, text, text);
create function public.submit_wfh_request(
  p_date date,
  p_reason text,
  p_details text default null,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_address text default null
) returns public.wfh_requests
language plpgsql security definer set search_path = public as $$
declare rec wfh_requests; mentor uuid;
begin
  if not current_role_is('candidate') then raise exception 'Only active candidates can request WFH' using errcode = '42501'; end if;
  if p_date is null or p_date < sast_today() then raise exception 'Choose today or a future date' using errcode = 'P0001'; end if;
  if p_date > sast_today() + 90 then raise exception 'Requests can be made up to 90 days ahead' using errcode = 'P0001'; end if;
  if extract(isodow from p_date) > 5 then raise exception 'WFH requests are for weekdays only' using errcode = 'P0001'; end if;
  if (p_latitude is null) <> (p_longitude is null) then raise exception 'Both location coordinates are required' using errcode = 'P0001'; end if;
  if p_latitude is not null and (p_latitude not between -90 and 90 or p_longitude not between -180 and 180) then
    raise exception 'Location coordinates are invalid' using errcode = 'P0001';
  end if;
  if char_length(coalesce(p_address, '')) > 500 then raise exception 'Location address is too long' using errcode = 'P0001'; end if;
  begin
    insert into wfh_requests (
      candidate_id, requested_date, reason, details,
      location_latitude, location_longitude, location_address
    ) values (
      auth.uid(), p_date, p_reason, nullif(trim(p_details), ''),
      p_latitude, p_longitude, nullif(trim(p_address), '')
    ) returning * into rec;
  exception when unique_violation then
    raise exception 'You already have a pending or approved request for that date' using errcode = 'P0001';
  end;
  insert into audit_logs (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'wfh.submitted', 'wfh_requests', rec.id, jsonb_build_object('date', p_date, 'reason', p_reason));
  mentor := my_mentor_id();
  if mentor is not null then
    insert into notifications (user_id, title, body, link)
    select mentor, 'New WFH request', full_name || ' requested WFH for ' || to_char(p_date, 'Dy, DD Mon YYYY'), '/mentor/wfh'
      from profiles where id = auth.uid();
  end if;
  return rec;
end $$;

revoke execute on function public.check_in(public.work_mode, text, text, double precision, double precision, text),
  public.submit_wfh_request(date, text, text, double precision, double precision, text) from public, anon;
grant execute on function public.check_in(public.work_mode, text, text, double precision, double precision, text),
  public.submit_wfh_request(date, text, text, double precision, double precision, text) to authenticated;