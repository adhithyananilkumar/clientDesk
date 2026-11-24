-- ClientDesk · tickets and comments
-- Ids are uuids the app can generate offline; updated_at / deleted_at drive sync.

create type public.ticket_status   as enum ('open', 'pending', 'resolved', 'closed');
create type public.ticket_priority as enum ('low', 'normal', 'high', 'urgent');

create table public.tickets (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces (id) on delete cascade,
  title          text not null check (char_length(title) between 1 and 200),
  description    text not null default '',
  status         public.ticket_status   not null default 'open',
  priority       public.ticket_priority not null default 'normal',
  customer_name  text not null default '',
  customer_email text not null default '',
  assignee_id    uuid references auth.users (id) on delete set null,
  created_by     uuid not null default auth.uid() references auth.users (id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

create table public.ticket_comments (
  id            uuid primary key default gen_random_uuid(),
  ticket_id     uuid not null references public.tickets (id) on delete cascade,
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  author_id     uuid not null default auth.uid() references auth.users (id),
  body          text not null check (char_length(body) between 1 and 5000),
  is_internal   boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create index tickets_workspace_updated_idx on public.tickets (workspace_id, updated_at desc);
create index tickets_assignee_idx          on public.tickets (assignee_id) where assignee_id is not null;
create index comments_ticket_created_idx   on public.ticket_comments (ticket_id, created_at);

create trigger tickets_set_updated_at
  before update on public.tickets
  for each row execute function public.set_updated_at();
create trigger ticket_comments_set_updated_at
  before update on public.ticket_comments
  for each row execute function public.set_updated_at();

-- A comment's workspace always follows its ticket, whatever the client sends.
create function public.sync_comment_workspace()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select workspace_id into new.workspace_id from public.tickets where id = new.ticket_id;
  if new.workspace_id is null then
    raise exception 'Ticket not found' using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger ticket_comments_sync_workspace
  before insert on public.ticket_comments
  for each row execute function public.sync_comment_workspace();

-- Row Level Security: everything is scoped to workspaces the user belongs to.
alter table public.tickets enable row level security;
alter table public.ticket_comments enable row level security;

create policy "tickets: members read"
  on public.tickets for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "tickets: members create"
  on public.tickets for insert to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    and created_by = (select auth.uid())
  );

create policy "tickets: members update"
  on public.tickets for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "tickets: owners and admins delete"
  on public.tickets for delete to authenticated
  using (public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]));

create policy "comments: members read"
  on public.ticket_comments for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "comments: members create as themselves"
  on public.ticket_comments for insert to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    and author_id = (select auth.uid())
  );

create policy "comments: authors edit own"
  on public.ticket_comments for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

create policy "comments: authors and admins delete"
  on public.ticket_comments for delete to authenticated
  using (
    author_id = (select auth.uid())
    or public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[])
  );

grant select, insert, update, delete on public.tickets to authenticated;
grant select, insert, update, delete on public.ticket_comments to authenticated;
