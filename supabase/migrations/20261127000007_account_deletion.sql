-- ---------------------------------------------------------------------------
-- Account deletion (App Store guideline 5.1.1(v)).
--
-- The `delete-account` Edge Function calls prepare_account_deletion() with the
-- service role, removes the returned storage files, then deletes the auth user.
-- Deleting the auth user cascades to the profile and, from there, to
-- memberships, comments, attachments rows, notifications and push tokens.
--
-- Tickets and workspaces the person created stay with the team: their creator
-- becomes NULL ("Deleted user") instead of blocking the delete.
-- ---------------------------------------------------------------------------

-- Tickets: keep them, forget who created them.
alter table public.tickets alter column created_by drop not null;
alter table public.tickets drop constraint if exists tickets_created_by_fkey;
alter table public.tickets
  add constraint tickets_created_by_fkey foreign key (created_by) references public.profiles (id) on delete set null;

-- Workspaces: same.
alter table public.workspaces alter column created_by drop not null;
alter table public.workspaces drop constraint if exists workspaces_created_by_fkey;
alter table public.workspaces
  add constraint workspaces_created_by_fkey foreign key (created_by) references auth.users (id) on delete set null;

-- The settings guard pins created_by; let the FK's SET NULL through
-- (authenticated users have no UPDATE grant on created_by, so only the FK can do it).
create or replace function public.guard_workspace_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by is not null then
    new.created_by := old.created_by;
  end if;
  new.created_at := old.created_at;
  new.name := trim(new.name);
  new.description := trim(new.description);

  if (select auth.uid()) is not null and public.workspace_role_of(new.id) is distinct from 'owner' then
    if new.ticket_prefix is distinct from old.ticket_prefix
      or new.enabled_priorities is distinct from old.enabled_priorities
      or new.member_visibility is distinct from old.member_visibility
      or new.default_assignee_id is distinct from old.default_assignee_id then
      raise exception 'Only the workspace owner can change ticket configuration' using errcode = '42501';
    end if;
  end if;

  if new.default_assignee_id is not null and not public.is_member_of(new.id, new.default_assignee_id) then
    raise exception 'Default assignee must be a workspace member' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- Checks the person can leave, deletes workspaces only they belong to, and
-- returns the storage paths of files that will lose their rows.
-- Raises (P0001) when they own a workspace that still has other members:
-- ownership must be transferred first so the team isn't left without an owner.
create function public.prepare_account_deletion(target uuid)
returns setof text
language plpgsql
security definer
set search_path = ''
as $$
declare
  blocked text;
begin
  select string_agg(w.name, ', ' order by w.name) into blocked
  from public.workspace_members m
  join public.workspaces w on w.id = m.workspace_id
  where m.user_id = target and m.role = 'owner'
    and exists (select 1 from public.workspace_members o where o.workspace_id = m.workspace_id and o.user_id <> target);
  if blocked is not null then
    raise exception 'Transfer ownership of % before deleting your account', blocked using errcode = 'P0001';
  end if;

  create temp table if not exists _solo_workspaces (id uuid) on commit drop;
  delete from _solo_workspaces;
  insert into _solo_workspaces
  select m.workspace_id from public.workspace_members m where m.user_id = target and m.role = 'owner';

  -- Files whose rows are about to disappear: uploaded by this person, or in a workspace being deleted.
  return query
    select a.storage_path from public.ticket_attachments a
    where a.uploaded_by = target or a.workspace_id in (select id from _solo_workspaces);

  delete from public.workspaces where id in (select id from _solo_workspaces);
end;
$$;

revoke execute on function public.prepare_account_deletion(uuid) from public, anon, authenticated;
grant execute on function public.prepare_account_deletion(uuid) to service_role;
