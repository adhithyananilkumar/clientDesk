-- ClientDesk · workspaces and membership
-- A workspace is a support team. Every ticket belongs to exactly one.

create type public.workspace_role as enum ('owner', 'admin', 'agent');

create table public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 2 and 60),
  created_by  uuid not null default auth.uid() references auth.users (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         public.workspace_role not null default 'agent',
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index workspace_members_user_idx on public.workspace_members (user_id);

create trigger workspaces_set_updated_at
  before update on public.workspaces
  for each row execute function public.set_updated_at();

-- Membership helpers. SECURITY DEFINER so policies can ask "is this user in
-- this workspace?" without recursing into the members table's own policies.
create function public.is_workspace_member(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = target and user_id = (select auth.uid())
  );
$$;

create function public.has_workspace_role(target uuid, allowed public.workspace_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = target
      and user_id = (select auth.uid())
      and role = any (allowed)
  );
$$;

revoke execute on function public.is_workspace_member(uuid) from public, anon;
revoke execute on function public.has_workspace_role(uuid, public.workspace_role[]) from public, anon;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.has_workspace_role(uuid, public.workspace_role[]) to authenticated;

-- Creating a workspace and becoming its owner must happen together.
create function public.create_workspace(workspace_name text)
returns public.workspaces
language plpgsql
security definer
set search_path = ''
as $$
declare
  created public.workspaces;
begin
  if (select auth.uid()) is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  insert into public.workspaces (name) values (trim(workspace_name))
  returning * into created;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (created.id, (select auth.uid()), 'owner');

  return created;
end;
$$;

revoke execute on function public.create_workspace(text) from public, anon;
grant execute on function public.create_workspace(text) to authenticated;

-- Row Level Security
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

create policy "workspaces: members read"
  on public.workspaces for select to authenticated
  using (public.is_workspace_member(id));

create policy "workspaces: owners and admins update"
  on public.workspaces for update to authenticated
  using (public.has_workspace_role(id, array['owner','admin']::public.workspace_role[]))
  with check (public.has_workspace_role(id, array['owner','admin']::public.workspace_role[]));

create policy "workspaces: owners delete"
  on public.workspaces for delete to authenticated
  using (public.has_workspace_role(id, array['owner']::public.workspace_role[]));

create policy "members: read teammates"
  on public.workspace_members for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "members: owners and admins manage"
  on public.workspace_members for update to authenticated
  using (public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]))
  with check (public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]));

create policy "members: leave or be removed"
  on public.workspace_members for delete to authenticated
  using (
    user_id = (select auth.uid())
    or public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[])
  );

-- Inserts into workspaces/members only happen through create_workspace()
-- (and a future invite function), so no insert grant is given.
grant select, update (name), delete on public.workspaces to authenticated;
grant select, update (role), delete on public.workspace_members to authenticated;
