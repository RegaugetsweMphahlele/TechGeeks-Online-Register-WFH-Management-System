alter table public.profiles add column stream text;

create or replace function public.audit_profile_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.role, new.mentor_id, new.status, new.cohort, new.stream, new.candidate_identifier)
     is distinct from (old.role, old.mentor_id, old.status, old.cohort, old.stream, old.candidate_identifier) then
    insert into audit_logs (actor_id, action, entity, entity_id, details)
    values (auth.uid(), 'profile.sensitive_update', 'profiles', new.id, jsonb_build_object(
      'before', jsonb_build_object('role', old.role, 'mentor_id', old.mentor_id, 'status', old.status,
                                   'cohort', old.cohort, 'stream', old.stream, 'candidate_identifier', old.candidate_identifier),
      'after',  jsonb_build_object('role', new.role, 'mentor_id', new.mentor_id, 'status', new.status,
                                   'cohort', new.cohort, 'stream', new.stream, 'candidate_identifier', new.candidate_identifier)));
  end if;
  return new;
end $$;
