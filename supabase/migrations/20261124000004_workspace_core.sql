-- ClientDesk · workspace core (MVP scope)
-- Evolves the first three migrations to the frozen MVP model:
--   roles  owner / admin / member
--   profiles readable by teammates, with email + notification preferences
--   workspace settings, invitations, ticket categories
-- Everything privileged goes through SECURITY DEFINER functions that check
-- the caller's role themselves. Clients get no direct insert/update on
-- membership or invitations.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Roles: 'agent' becomes 'member'.
-- ---------------------------------------------------------------------------
alter type public.workspace_role rename value 'agent' to 'member';

-- Ticket vocabulary: 'pending' becomes 'in_progress', 'normal' becomes 'medium'.
alter type public.ticket_status rename value 'pending' to 'in_progress';
alter type public.ticket_priority rename value 'normal' to 'medium';
alter table public.workspace_members alter column role set default 'member';

-- One owner per workspace, always.
create unique index if not exists workspace_members_one_owner
  on public.workspace_members (workspace_id) where role = 'owner';

alter table public.workspace_members add column if not exists updated_at timestamptz not null default now();
create trigger workspace_members_set_updated_at
  before update on public.workspace_members
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Profiles: email copy (so teammates can see it) and notification preferences.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists email text not null default '',
  add column if not exists notification_prefs jsonb not null default '{}'::jsonb;

alter table public.profiles
  add constraint profiles_prefs_is_object check (jsonb_typeof(notification_prefs) = 'object');

update public.profiles p set email = coalesce(u.email, '') from auth.users u where u.id = p.id;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''), coalesce(new.email, ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = coalesce(new.email, '') where id = new.id;
  return new;
end;
$$;

revoke execute on function public.handle_user_email_change() from public, anon, authenticated;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- ---------------------------------------------------------------------------
-- Workspaces: settings.
-- ---------------------------------------------------------------------------
create type public.member_ticket_visibility as enum ('own', 'all');

alter table public.workspaces
  add column if not exists description text not null default '' check (char_length(description) <= 280),
  add column if not exists logo_url text,
  add column if not exists timezone text not null default 'UTC' check (char_length(timezone) between 1 and 64),
  add column if not exists default_priority public.ticket_priority not null default 'medium',
  add column if not exists ticket_prefix text not null default 'CD' check (ticket_prefix ~ '^[A-Z]{2,5}$'),
  add column if not exists enabled_priorities public.ticket_priority[] not null
    default array['low','medium','high','urgent']::public.ticket_priority[],
  add column if not exists member_visibility public.member_ticket_visibility not null default 'own',
  add column if not exists default_assignee_id uuid;

alter table public.workspaces
  add constraint workspaces_priorities_not_empty check (cardinality(enabled_priorities) >= 1),
  add constraint workspaces_default_priority_enabled check (default_priority = any (enabled_priorities));

-- Point user references at profiles so PostgREST can embed names and avatars.
-- (profiles.id itself cascades from auth.users, so integrity is unchanged.)
alter table public.workspace_members drop constraint if exists workspace_members_user_id_fkey;
alter table public.workspace_members
  add constraint workspace_members_user_id_fkey foreign key (user_id) references public.profiles (id) on delete cascade;

alter table public.workspaces
  add constraint workspaces_default_assignee_fkey foreign key (default_assignee_id) references public.profiles (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Role helpers.
-- ---------------------------------------------------------------------------
create function public.workspace_role_of(target uuid)
returns public.workspace_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.workspace_members
  where workspace_id = target and user_id = (select auth.uid());
$$;

create function public.is_workspace_admin(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.workspace_role_of(target) in ('owner', 'admin'), false);
$$;

create function public.is_member_of(target uuid, person uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.workspace_members where workspace_id = target and user_id = person);
$$;

-- Do the signed-in user and `other` share any workspace?
create function public.shares_workspace(other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members mine
    join public.workspace_members theirs on theirs.workspace_id = mine.workspace_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = other
  );
$$;

revoke execute on function public.workspace_role_of(uuid) from public, anon;
revoke execute on function public.is_workspace_admin(uuid) from public, anon;
revoke execute on function public.is_member_of(uuid, uuid) from public, anon;
revoke execute on function public.shares_workspace(uuid) from public, anon;
grant execute on function public.workspace_role_of(uuid) to authenticated;
grant execute on function public.is_workspace_admin(uuid) to authenticated;
grant execute on function public.is_member_of(uuid, uuid) to authenticated;
grant execute on function public.shares_workspace(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Profiles RLS: yourself, plus anyone you share a workspace with.
-- ---------------------------------------------------------------------------
drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read self and teammates"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id or public.shares_workspace(id));

revoke update on public.profiles from authenticated;
grant update (full_name, avatar_url, notification_prefs) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Workspace settings guard: admins have "limited" settings access.
-- Owner-only: ticket prefix, enabled priorities, member visibility,
-- default assignee.
-- ---------------------------------------------------------------------------
create function public.guard_workspace_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.created_by := old.created_by;
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

create trigger workspaces_guard_update
  before update on public.workspaces
  for each row execute function public.guard_workspace_update();

revoke update on public.workspaces from authenticated;
grant update (name, description, logo_url, timezone, default_priority, ticket_prefix,
              enabled_priorities, member_visibility, default_assignee_id)
  on public.workspaces to authenticated;

-- Membership changes only through the functions below.
drop policy if exists "members: owners and admins manage" on public.workspace_members;
drop policy if exists "members: leave or be removed" on public.workspace_members;
revoke update, delete on public.workspace_members from authenticated;

-- ---------------------------------------------------------------------------
-- Ticket categories.
-- ---------------------------------------------------------------------------
create table public.ticket_categories (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name         text not null check (char_length(trim(name)) between 1 and 40),
  color        text not null default '#59636E' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index ticket_categories_name_unique on public.ticket_categories (workspace_id, lower(name));

create trigger ticket_categories_set_updated_at
  before update on public.ticket_categories
  for each row execute function public.set_updated_at();

alter table public.ticket_categories enable row level security;

create policy "categories: members read"
  on public.ticket_categories for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy "categories: admins create"
  on public.ticket_categories for insert to authenticated
  with check (public.is_workspace_admin(workspace_id));
create policy "categories: admins update"
  on public.ticket_categories for update to authenticated
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));
create policy "categories: admins delete"
  on public.ticket_categories for delete to authenticated
  using (public.is_workspace_admin(workspace_id));

grant select, insert (workspace_id, name, color), update (name, color), delete on public.ticket_categories to authenticated;

-- ---------------------------------------------------------------------------
-- Ticket number sequences (one counter row per workspace, no client access).
-- ---------------------------------------------------------------------------
create table public.ticket_sequences (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  next_value   bigint not null default 1 check (next_value >= 1)
);
alter table public.ticket_sequences enable row level security;
revoke all on public.ticket_sequences from anon, authenticated;

insert into public.ticket_sequences (workspace_id) select id from public.workspaces on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Creating a workspace: owner membership, counter and starter categories.
-- ---------------------------------------------------------------------------
drop function if exists public.create_workspace(text);

create function public.create_workspace(workspace_name text, workspace_description text default '')
returns public.workspaces
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  created public.workspaces;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  if char_length(trim(coalesce(workspace_name, ''))) < 2 then
    raise exception 'Workspace name must be at least 2 characters' using errcode = '23514';
  end if;

  insert into public.workspaces (name, description, created_by)
  values (trim(workspace_name), trim(coalesce(workspace_description, '')), uid)
  returning * into created;

  insert into public.workspace_members (workspace_id, user_id, role) values (created.id, uid, 'owner');
  insert into public.ticket_sequences (workspace_id) values (created.id);
  insert into public.ticket_categories (workspace_id, name, color) values
    (created.id, 'Bug', '#CF222E'),
    (created.id, 'Billing', '#9A6700'),
    (created.id, 'Account', '#0969DA'),
    (created.id, 'Feature request', '#8250DF'),
    (created.id, 'Question', '#1F883D');

  return created;
end;
$$;

revoke execute on function public.create_workspace(text, text) from public, anon;
grant execute on function public.create_workspace(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Member management.
-- ---------------------------------------------------------------------------
create function public.change_member_role(target_workspace uuid, target_user uuid, new_role public.workspace_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_role public.workspace_role;
begin
  if not public.is_workspace_admin(target_workspace) then
    raise exception 'Only owners and admins can change roles' using errcode = '42501';
  end if;
  if new_role = 'owner' then
    raise exception 'Use transfer ownership to make someone the owner' using errcode = '42501';
  end if;

  select role into target_role from public.workspace_members
  where workspace_id = target_workspace and user_id = target_user for update;

  if target_role is null then
    raise exception 'That person is not a member of this workspace' using errcode = 'P0002';
  end if;
  if target_role = 'owner' then
    raise exception 'The owner''s role cannot be changed' using errcode = '42501';
  end if;

  update public.workspace_members set role = new_role
  where workspace_id = target_workspace and user_id = target_user;
end;
$$;

-- Tickets assigned to someone who leaves go back to the queue.
create function public.release_assignments(target_workspace uuid, target_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- System change: skip the "only admins assign" guard for this statement.
  perform set_config('clientdesk.system_change', 'on', true);
  update public.tickets set assigned_to = null
  where workspace_id = target_workspace and assigned_to = target_user;
  perform set_config('clientdesk.system_change', 'off', true);
  update public.workspaces set default_assignee_id = null
  where id = target_workspace and default_assignee_id = target_user;
end;
$$;
revoke execute on function public.release_assignments(uuid, uuid) from public, anon, authenticated;

create function public.remove_member(target_workspace uuid, target_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role public.workspace_role := public.workspace_role_of(target_workspace);
  target_role public.workspace_role;
begin
  if caller_role is null or caller_role not in ('owner', 'admin') then
    raise exception 'Only owners and admins can remove members' using errcode = '42501';
  end if;
  if target_user = (select auth.uid()) then
    raise exception 'Use leave workspace to remove yourself' using errcode = '42501';
  end if;

  select role into target_role from public.workspace_members
  where workspace_id = target_workspace and user_id = target_user for update;

  if target_role is null then
    raise exception 'That person is not a member of this workspace' using errcode = 'P0002';
  end if;
  if target_role = 'owner' then
    raise exception 'Transfer ownership before removing the owner' using errcode = '42501';
  end if;
  if target_role = 'admin' and caller_role <> 'owner' then
    raise exception 'Only the owner can remove an admin' using errcode = '42501';
  end if;

  perform public.release_assignments(target_workspace, target_user);
  delete from public.workspace_members where workspace_id = target_workspace and user_id = target_user;
end;
$$;

create function public.leave_workspace(target_workspace uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  my_role public.workspace_role := public.workspace_role_of(target_workspace);
begin
  if my_role is null then
    raise exception 'You are not a member of this workspace' using errcode = 'P0002';
  end if;
  if my_role = 'owner' then
    raise exception 'Transfer ownership before leaving the workspace' using errcode = '42501';
  end if;
  perform public.release_assignments(target_workspace, uid);
  delete from public.workspace_members where workspace_id = target_workspace and user_id = uid;
end;
$$;

create function public.transfer_ownership(target_workspace uuid, new_owner uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if public.workspace_role_of(target_workspace) is distinct from 'owner' then
    raise exception 'Only the owner can transfer ownership' using errcode = '42501';
  end if;
  if new_owner = uid then
    raise exception 'You already own this workspace' using errcode = '22023';
  end if;
  if not public.is_member_of(target_workspace, new_owner) then
    raise exception 'The new owner must be a member of this workspace' using errcode = 'P0002';
  end if;

  update public.workspace_members set role = 'admin' where workspace_id = target_workspace and user_id = uid;
  update public.workspace_members set role = 'owner' where workspace_id = target_workspace and user_id = new_owner;
end;
$$;

revoke execute on function public.change_member_role(uuid, uuid, public.workspace_role) from public, anon;
revoke execute on function public.remove_member(uuid, uuid) from public, anon;
revoke execute on function public.leave_workspace(uuid) from public, anon;
revoke execute on function public.transfer_ownership(uuid, uuid) from public, anon;
grant execute on function public.change_member_role(uuid, uuid, public.workspace_role) to authenticated;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
grant execute on function public.leave_workspace(uuid) to authenticated;
grant execute on function public.transfer_ownership(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Invitations. The raw token is returned once to the inviter (for the email
-- link) and only its SHA-256 hash is stored. Single use, 7-day expiry, and
-- the accepting account's email must match the invited address.
-- ---------------------------------------------------------------------------
create table public.workspace_invitations (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email        text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  role         public.workspace_role not null default 'member' check (role in ('admin', 'member')),
  token_hash   text not null unique,
  invited_by   uuid not null references public.profiles (id) on delete cascade,
  expires_at   timestamptz not null default now() + interval '7 days',
  accepted_at  timestamptz,
  accepted_by  uuid references public.profiles (id) on delete set null,
  declined_at  timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index workspace_invitations_workspace_idx on public.workspace_invitations (workspace_id, created_at desc);
create index workspace_invitations_email_idx on public.workspace_invitations (lower(email));
-- At most one live invitation per address per workspace.
create unique index workspace_invitations_one_pending
  on public.workspace_invitations (workspace_id, lower(email))
  where accepted_at is null and declined_at is null and revoked_at is null;

create trigger workspace_invitations_set_updated_at
  before update on public.workspace_invitations
  for each row execute function public.set_updated_at();

alter table public.workspace_invitations enable row level security;

create policy "invitations: admins read"
  on public.workspace_invitations for select to authenticated
  using (public.is_workspace_admin(workspace_id));

-- Token hash never leaves the database.
revoke all on public.workspace_invitations from anon, authenticated;
grant select (id, workspace_id, email, role, invited_by, expires_at, accepted_at, accepted_by,
              declined_at, revoked_at, created_at, updated_at)
  on public.workspace_invitations to authenticated;

create function public.current_email()
returns text
language sql
stable
set search_path = ''
as $$
  select lower(coalesce((select auth.jwt()) ->> 'email', ''));
$$;

create function public.create_invitation(target_workspace uuid, invitee_email text, invitee_role public.workspace_role default 'member')
returns table (invitation_id uuid, token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_email text := lower(trim(coalesce(invitee_email, '')));
  raw_token text := encode(extensions.gen_random_bytes(32), 'hex');
  created public.workspace_invitations;
begin
  if not public.is_workspace_admin(target_workspace) then
    raise exception 'Only owners and admins can invite members' using errcode = '42501';
  end if;
  if invitee_role not in ('admin', 'member') then
    raise exception 'Invitations can be for Admin or Member only' using errcode = '22023';
  end if;
  if clean_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter a valid email address' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.workspace_members m join public.profiles p on p.id = m.user_id
    where m.workspace_id = target_workspace and lower(p.email) = clean_email
  ) then
    raise exception 'That person is already a member' using errcode = '23505';
  end if;

  -- Re-inviting replaces the previous link.
  update public.workspace_invitations set revoked_at = now()
  where workspace_id = target_workspace and lower(email) = clean_email
    and accepted_at is null and declined_at is null and revoked_at is null;

  insert into public.workspace_invitations (workspace_id, email, role, token_hash, invited_by)
  values (target_workspace, clean_email, invitee_role,
          encode(extensions.digest(raw_token, 'sha256'), 'hex'), (select auth.uid()))
  returning * into created;

  return query select created.id, raw_token, created.expires_at;
end;
$$;

create function public.revoke_invitation(invitation uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.workspace_invitations;
begin
  select * into target from public.workspace_invitations where id = invitation for update;
  if target.id is null or not public.is_workspace_admin(target.workspace_id) then
    raise exception 'Invitation not found' using errcode = 'P0002';
  end if;
  if target.accepted_at is not null then
    raise exception 'That invitation was already accepted' using errcode = '22023';
  end if;
  update public.workspace_invitations set revoked_at = now() where id = invitation;
end;
$$;

-- Shared acceptance logic. Returns the joined workspace id.
create function public.join_from_invitation(target public.workspace_invitations)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  if target.id is null then
    raise exception 'This invitation link is not valid' using errcode = 'P0002';
  end if;
  if target.revoked_at is not null or target.declined_at is not null or target.accepted_at is not null then
    raise exception 'This invitation has already been used' using errcode = '22023';
  end if;
  if target.expires_at <= now() then
    raise exception 'This invitation has expired. Ask for a new one.' using errcode = '22023';
  end if;
  if lower(target.email) <> public.current_email() then
    raise exception 'This invitation was sent to a different email address' using errcode = '42501';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (target.workspace_id, uid, target.role)
  on conflict (workspace_id, user_id) do nothing;

  update public.workspace_invitations set accepted_at = now(), accepted_by = uid where id = target.id;
  return target.workspace_id;
end;
$$;
revoke execute on function public.join_from_invitation(public.workspace_invitations) from public, anon, authenticated;

create function public.accept_invitation(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.workspace_invitations;
begin
  select * into target from public.workspace_invitations
  where token_hash = encode(extensions.digest(coalesce(invite_token, ''), 'sha256'), 'hex')
  for update;
  return public.join_from_invitation(target);
end;
$$;

create function public.accept_invitation_by_id(invitation uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.workspace_invitations;
begin
  select * into target from public.workspace_invitations where id = invitation for update;
  return public.join_from_invitation(target);
end;
$$;

create function public.decline_invitation(invitation uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.workspace_invitations set declined_at = now()
  where id = invitation and lower(email) = public.current_email()
    and accepted_at is null and declined_at is null and revoked_at is null;
  if not found then
    raise exception 'Invitation not found' using errcode = 'P0002';
  end if;
end;
$$;

-- Invitations addressed to me, with the workspace and inviter names.
create function public.my_invitations()
returns table (
  id uuid, workspace_id uuid, workspace_name text, workspace_logo_url text,
  role public.workspace_role, invited_by_name text, expires_at timestamptz, created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, i.workspace_id, w.name, w.logo_url, i.role, coalesce(nullif(p.full_name, ''), p.email), i.expires_at, i.created_at
  from public.workspace_invitations i
  join public.workspaces w on w.id = i.workspace_id
  join public.profiles p on p.id = i.invited_by
  where lower(i.email) = public.current_email()
    and i.accepted_at is null and i.declined_at is null and i.revoked_at is null
    and i.expires_at > now()
  order by i.created_at desc;
$$;

revoke execute on function public.create_invitation(uuid, text, public.workspace_role) from public, anon;
revoke execute on function public.revoke_invitation(uuid) from public, anon;
revoke execute on function public.accept_invitation(text) from public, anon;
revoke execute on function public.accept_invitation_by_id(uuid) from public, anon;
revoke execute on function public.decline_invitation(uuid) from public, anon;
revoke execute on function public.my_invitations() from public, anon;
grant execute on function public.create_invitation(uuid, text, public.workspace_role) to authenticated;
grant execute on function public.revoke_invitation(uuid) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
grant execute on function public.accept_invitation_by_id(uuid) to authenticated;
grant execute on function public.decline_invitation(uuid) to authenticated;
grant execute on function public.my_invitations() to authenticated;
