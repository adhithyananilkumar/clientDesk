-- ClientDesk · tickets, comments, internal notes, attachments, activity
--
-- Visibility rule (enforced here, not in the app):
--   owners/admins see every ticket in the workspace;
--   members see tickets they created or are assigned to, or every ticket when
--   the workspace's member_visibility is 'all'.
-- Internal notes are visible to owners/admins only.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Tickets: reshape to the MVP fields.
-- ---------------------------------------------------------------------------
alter table public.tickets rename column assignee_id to assigned_to;
alter table public.tickets drop column if exists customer_name, drop column if exists customer_email;
alter table public.tickets
  add column ticket_number bigint,
  add column category_id uuid references public.ticket_categories (id) on delete set null,
  add column due_at timestamptz,
  add column resolved_at timestamptz;

alter table public.tickets alter column priority set default 'medium';

-- Number existing tickets per workspace, then keep counters in step.
with numbered as (
  select id, row_number() over (partition by workspace_id order by created_at, id) as n from public.tickets
)
update public.tickets t set ticket_number = numbered.n from numbered where numbered.id = t.id;

update public.ticket_sequences s
set next_value = coalesce((select max(ticket_number) + 1 from public.tickets t where t.workspace_id = s.workspace_id), 1);

alter table public.tickets alter column ticket_number set not null;
alter table public.tickets add constraint tickets_workspace_number_unique unique (workspace_id, ticket_number);
alter table public.tickets add constraint tickets_description_length check (char_length(description) <= 10000);
-- New tickets must describe the problem; older rows are left as they are.
alter table public.tickets add constraint tickets_description_required check (char_length(trim(description)) >= 1) not valid;
alter table public.tickets add constraint tickets_title_not_blank check (char_length(trim(title)) >= 1);

-- User references go through profiles (embeddable names/avatars).
alter table public.tickets drop constraint if exists tickets_assignee_id_fkey;
alter table public.tickets drop constraint if exists tickets_created_by_fkey;
alter table public.tickets
  add constraint tickets_created_by_fkey foreign key (created_by) references public.profiles (id),
  add constraint tickets_assigned_to_fkey foreign key (assigned_to) references public.profiles (id) on delete set null;

drop index if exists public.tickets_assignee_idx;
create index tickets_assigned_idx      on public.tickets (workspace_id, assigned_to) where deleted_at is null;
create index tickets_creator_idx       on public.tickets (workspace_id, created_by) where deleted_at is null;
create index tickets_status_idx        on public.tickets (workspace_id, status, updated_at desc) where deleted_at is null;
create index tickets_created_idx       on public.tickets (workspace_id, created_at desc) where deleted_at is null;
create index tickets_due_idx           on public.tickets (due_at) where deleted_at is null and due_at is not null and status in ('open', 'in_progress');
create index tickets_category_idx      on public.tickets (category_id) where category_id is not null;
create index tickets_title_trgm_idx    on public.tickets using gin (title extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Visibility helpers.
-- ---------------------------------------------------------------------------
create function public.can_view_ticket(ws uuid, creator uuid, assignee uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members m
    join public.workspaces w on w.id = m.workspace_id
    where m.workspace_id = ws
      and m.user_id = (select auth.uid())
      and (
        m.role in ('owner', 'admin')
        or creator = (select auth.uid())
        or assignee = (select auth.uid())
        or w.member_visibility = 'all'
      )
  );
$$;

create function public.can_view_ticket_id(ticket uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select public.can_view_ticket(t.workspace_id, t.created_by, t.assigned_to)
    from public.tickets t where t.id = ticket and t.deleted_at is null
  ), false);
$$;

-- Owners/admins: any ticket. Members: their own (created or assigned).
create function public.can_manage_ticket_id(ticket uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select public.is_workspace_admin(t.workspace_id)
        or (public.is_workspace_member(t.workspace_id)
            and (t.created_by = (select auth.uid()) or t.assigned_to = (select auth.uid())))
    from public.tickets t where t.id = ticket and t.deleted_at is null
  ), false);
$$;

revoke execute on function public.can_view_ticket(uuid, uuid, uuid) from public, anon;
revoke execute on function public.can_view_ticket_id(uuid) from public, anon;
revoke execute on function public.can_manage_ticket_id(uuid) from public, anon;
grant execute on function public.can_view_ticket(uuid, uuid, uuid) to authenticated;
grant execute on function public.can_view_ticket_id(uuid) to authenticated;
grant execute on function public.can_manage_ticket_id(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Ticket integrity triggers.
-- ---------------------------------------------------------------------------
create function public.tickets_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  ws public.workspaces;
begin
  select * into ws from public.workspaces where id = new.workspace_id;
  if ws.id is null then
    raise exception 'Workspace not found' using errcode = '23503';
  end if;

  -- Safe, gap-tolerant numbering: the counter row is locked for the update.
  update public.ticket_sequences set next_value = next_value + 1
  where workspace_id = new.workspace_id
  returning next_value - 1 into new.ticket_number;
  if new.ticket_number is null then
    insert into public.ticket_sequences (workspace_id, next_value) values (new.workspace_id, 2)
    on conflict (workspace_id) do update set next_value = public.ticket_sequences.next_value + 1
    returning next_value - 1 into new.ticket_number;
  end if;

  if uid is not null then
    new.created_by := uid;
    if new.assigned_to is not null and not public.is_workspace_admin(new.workspace_id) then
      raise exception 'Only owners and admins can assign tickets' using errcode = '42501';
    end if;
  end if;

  if new.assigned_to is null and ws.default_assignee_id is not null then
    new.assigned_to := ws.default_assignee_id;
  end if;

  new.title := trim(new.title);
  new.description := trim(new.description);
  new.status := 'open';
  new.resolved_at := null;
  new.deleted_at := null;
  new.created_at := now();
  new.updated_at := now();

  if not (new.priority = any (ws.enabled_priorities)) then
    raise exception 'That priority is not enabled in this workspace' using errcode = '23514';
  end if;
  if new.assigned_to is not null and not public.is_member_of(new.workspace_id, new.assigned_to) then
    raise exception 'Assignee must be a workspace member' using errcode = '23514';
  end if;
  if new.category_id is not null and not exists (
    select 1 from public.ticket_categories c where c.id = new.category_id and c.workspace_id = new.workspace_id
  ) then
    raise exception 'Category does not belong to this workspace' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger tickets_before_insert
  before insert on public.tickets
  for each row execute function public.tickets_before_insert();

create function public.tickets_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if new.workspace_id <> old.workspace_id or new.ticket_number <> old.ticket_number
     or new.created_by <> old.created_by or new.created_at <> old.created_at then
    raise exception 'Ticket number, workspace and creator cannot be changed' using errcode = '42501';
  end if;

  -- 'clientdesk.system_change' is only set inside trusted functions
  -- (pg_catalog.set_config is not reachable through the Data API).
  if uid is not null and not public.is_workspace_admin(new.workspace_id)
     and coalesce(current_setting('clientdesk.system_change', true), 'off') <> 'on' then
    if new.assigned_to is distinct from old.assigned_to then
      raise exception 'Only owners and admins can assign tickets' using errcode = '42501';
    end if;
    if new.deleted_at is distinct from old.deleted_at then
      raise exception 'Only owners and admins can delete tickets' using errcode = '42501';
    end if;
  end if;

  new.title := trim(new.title);
  new.description := trim(new.description);

  if new.status is distinct from old.status then
    if new.status in ('resolved', 'closed') then
      new.resolved_at := coalesce(old.resolved_at, now());
    else
      new.resolved_at := null;
    end if;
  end if;

  if new.priority is distinct from old.priority and not exists (
    select 1 from public.workspaces w where w.id = new.workspace_id and new.priority = any (w.enabled_priorities)
  ) then
    raise exception 'That priority is not enabled in this workspace' using errcode = '23514';
  end if;
  if new.assigned_to is distinct from old.assigned_to and new.assigned_to is not null
     and not public.is_member_of(new.workspace_id, new.assigned_to) then
    raise exception 'Assignee must be a workspace member' using errcode = '23514';
  end if;
  if new.category_id is distinct from old.category_id and new.category_id is not null and not exists (
    select 1 from public.ticket_categories c where c.id = new.category_id and c.workspace_id = new.workspace_id
  ) then
    raise exception 'Category does not belong to this workspace' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger tickets_before_update
  before update on public.tickets
  for each row execute function public.tickets_before_update();

-- ---------------------------------------------------------------------------
-- Ticket RLS (each command separately).
-- ---------------------------------------------------------------------------
drop policy if exists "tickets: members read" on public.tickets;
drop policy if exists "tickets: members create" on public.tickets;
drop policy if exists "tickets: members update" on public.tickets;
drop policy if exists "tickets: owners and admins delete" on public.tickets;

create policy "tickets: read visible"
  on public.tickets for select to authenticated
  using (deleted_at is null and public.can_view_ticket(workspace_id, created_by, assigned_to));

create policy "tickets: members create as themselves"
  on public.tickets for insert to authenticated
  with check (public.is_workspace_member(workspace_id) and created_by = (select auth.uid()));

create policy "tickets: admins or own update"
  on public.tickets for update to authenticated
  using (
    deleted_at is null and (
      public.is_workspace_admin(workspace_id)
      or (public.is_workspace_member(workspace_id)
          and (created_by = (select auth.uid()) or assigned_to = (select auth.uid())))
    )
  )
  with check (public.is_workspace_member(workspace_id));

create policy "tickets: admins delete"
  on public.tickets for delete to authenticated
  using (public.is_workspace_admin(workspace_id));

revoke insert, update on public.tickets from authenticated;
grant insert (id, workspace_id, title, description, priority, category_id, assigned_to, due_at) on public.tickets to authenticated;
grant update (title, description, status, priority, category_id, assigned_to, due_at) on public.tickets to authenticated;

-- Soft delete keeps history (activity, comments) intact.
create function public.delete_ticket(ticket uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws uuid;
begin
  select workspace_id into ws from public.tickets where id = ticket and deleted_at is null for update;
  if ws is null or not public.is_workspace_admin(ws) then
    raise exception 'Only owners and admins can delete tickets' using errcode = '42501';
  end if;
  update public.tickets set deleted_at = now() where id = ticket;
end;
$$;
revoke execute on function public.delete_ticket(uuid) from public, anon;
grant execute on function public.delete_ticket(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Comments & internal notes (same table, explicit is_internal, enforced by RLS).
-- ---------------------------------------------------------------------------
alter table public.ticket_comments drop constraint if exists ticket_comments_author_id_fkey;
alter table public.ticket_comments
  add constraint ticket_comments_author_id_fkey foreign key (author_id) references public.profiles (id) on delete cascade;
alter table public.ticket_comments add column if not exists edited_at timestamptz;

create or replace function public.sync_comment_workspace()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select workspace_id into new.workspace_id from public.tickets where id = new.ticket_id and deleted_at is null;
  if new.workspace_id is null then
    raise exception 'Ticket not found' using errcode = '23503';
  end if;
  if (select auth.uid()) is not null then
    new.author_id := (select auth.uid());
  end if;
  new.body := trim(new.body);
  new.deleted_at := null;
  new.edited_at := null;
  return new;
end;
$$;

create function public.guard_comment_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.ticket_id <> old.ticket_id or new.workspace_id <> old.workspace_id
     or new.author_id <> old.author_id or new.is_internal <> old.is_internal then
    raise exception 'Only the comment text can be edited' using errcode = '42501';
  end if;
  new.body := trim(new.body);
  if new.body is distinct from old.body then
    new.edited_at := now();
  end if;
  return new;
end;
$$;

create trigger ticket_comments_guard_update
  before update on public.ticket_comments
  for each row execute function public.guard_comment_update();

drop policy if exists "comments: members read" on public.ticket_comments;
drop policy if exists "comments: members create as themselves" on public.ticket_comments;
drop policy if exists "comments: authors edit own" on public.ticket_comments;
drop policy if exists "comments: authors and admins delete" on public.ticket_comments;

create policy "comments: read visible"
  on public.ticket_comments for select to authenticated
  using (
    deleted_at is null
    and public.can_view_ticket_id(ticket_id)
    and (not is_internal or public.is_workspace_admin(workspace_id))
  );

create policy "comments: create on visible tickets"
  on public.ticket_comments for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and public.can_view_ticket_id(ticket_id)
    and (not is_internal or public.is_workspace_admin(workspace_id))
  );

create policy "comments: authors edit own"
  on public.ticket_comments for update to authenticated
  using (author_id = (select auth.uid()) and deleted_at is null)
  with check (author_id = (select auth.uid()));

create policy "comments: authors delete own"
  on public.ticket_comments for delete to authenticated
  using (author_id = (select auth.uid()));

revoke insert, update on public.ticket_comments from authenticated;
grant insert (id, ticket_id, body, is_internal) on public.ticket_comments to authenticated;
grant update (body) on public.ticket_comments to authenticated;

create function public.delete_comment(comment uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.ticket_comments set deleted_at = now()
  where id = comment and author_id = (select auth.uid()) and deleted_at is null;
  if not found then
    raise exception 'You can only delete your own comments' using errcode = '42501';
  end if;
end;
$$;
revoke execute on function public.delete_comment(uuid) from public, anon;
grant execute on function public.delete_comment(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Attachments (metadata; files live in the private `attachments` bucket at
--   <workspace_id>/tickets/<ticket_id>/<attachment_id>.<ext>).
-- ---------------------------------------------------------------------------
create table public.ticket_attachments (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  ticket_id     uuid not null references public.tickets (id) on delete cascade,
  comment_id    uuid references public.ticket_comments (id) on delete cascade,
  uploaded_by   uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  storage_path  text not null unique,
  file_name     text not null check (char_length(file_name) between 1 and 200),
  mime_type     text not null check (mime_type in (
                  'image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain',
                  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')),
  size_bytes    bigint not null check (size_bytes between 1 and 10485760),
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create index ticket_attachments_ticket_idx on public.ticket_attachments (ticket_id, created_at) where deleted_at is null;
create index ticket_attachments_comment_idx on public.ticket_attachments (comment_id) where comment_id is not null;

create function public.attachments_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  comment_ticket uuid;
begin
  select workspace_id into new.workspace_id from public.tickets where id = new.ticket_id and deleted_at is null;
  if new.workspace_id is null then
    raise exception 'Ticket not found' using errcode = '23503';
  end if;
  if (select auth.uid()) is not null then
    new.uploaded_by := (select auth.uid());
  end if;
  if new.comment_id is not null then
    select ticket_id into comment_ticket from public.ticket_comments where id = new.comment_id;
    if comment_ticket is distinct from new.ticket_id then
      raise exception 'Comment belongs to a different ticket' using errcode = '23514';
    end if;
  end if;
  if new.storage_path not like new.workspace_id::text || '/tickets/' || new.ticket_id::text || '/%' then
    raise exception 'Invalid storage path' using errcode = '23514';
  end if;
  -- At most 5 files per upload batch is enforced in the app; 50 per ticket here.
  if (select count(*) from public.ticket_attachments a where a.ticket_id = new.ticket_id and a.deleted_at is null) >= 50 then
    raise exception 'This ticket has reached its attachment limit' using errcode = '23514';
  end if;
  new.deleted_at := null;
  new.created_at := now();
  return new;
end;
$$;

create trigger ticket_attachments_before_insert
  before insert on public.ticket_attachments
  for each row execute function public.attachments_before_insert();

create function public.can_view_comment_id(comment uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select public.can_view_ticket_id(c.ticket_id) and (not c.is_internal or public.is_workspace_admin(c.workspace_id))
    from public.ticket_comments c where c.id = comment and c.deleted_at is null
  ), false);
$$;
revoke execute on function public.can_view_comment_id(uuid) from public, anon;
grant execute on function public.can_view_comment_id(uuid) to authenticated;

alter table public.ticket_attachments enable row level security;

create policy "attachments: read visible"
  on public.ticket_attachments for select to authenticated
  using (
    deleted_at is null
    and public.can_view_ticket_id(ticket_id)
    and (comment_id is null or public.can_view_comment_id(comment_id))
  );

create policy "attachments: upload to visible tickets"
  on public.ticket_attachments for insert to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and public.can_view_ticket_id(ticket_id)
    and (comment_id is null or public.can_view_comment_id(comment_id))
  );

create policy "attachments: uploader or admin delete"
  on public.ticket_attachments for delete to authenticated
  using (uploaded_by = (select auth.uid()) or public.is_workspace_admin(workspace_id));

revoke all on public.ticket_attachments from anon, authenticated;
grant select, delete on public.ticket_attachments to authenticated;
grant insert (id, ticket_id, comment_id, storage_path, file_name, mime_type, size_bytes) on public.ticket_attachments to authenticated;

create function public.delete_attachment(attachment uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.ticket_attachments;
begin
  select * into target from public.ticket_attachments where id = attachment and deleted_at is null for update;
  if target.id is null or not (target.uploaded_by = (select auth.uid()) or public.is_workspace_admin(target.workspace_id)) then
    raise exception 'You cannot delete this attachment' using errcode = '42501';
  end if;
  update public.ticket_attachments set deleted_at = now() where id = attachment;
  return target.storage_path;
end;
$$;
revoke execute on function public.delete_attachment(uuid) from public, anon;
grant execute on function public.delete_attachment(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Activity timeline / audit trail. Written only by triggers.
-- ---------------------------------------------------------------------------
create table public.ticket_activity (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  ticket_id    uuid not null references public.tickets (id) on delete cascade,
  actor_id     uuid references public.profiles (id) on delete set null,
  kind         text not null check (kind in (
                 'created', 'title_changed', 'description_changed', 'status_changed', 'priority_changed',
                 'assigned', 'unassigned', 'category_changed', 'due_changed', 'deleted',
                 'comment_added', 'attachment_added')),
  from_value   text,
  to_value     text,
  created_at   timestamptz not null default now()
);

create index ticket_activity_ticket_idx on public.ticket_activity (ticket_id, created_at);
create index ticket_activity_workspace_idx on public.ticket_activity (workspace_id, created_at desc);

alter table public.ticket_activity enable row level security;

create policy "activity: read visible tickets"
  on public.ticket_activity for select to authenticated
  using (public.can_view_ticket_id(ticket_id));

revoke all on public.ticket_activity from anon, authenticated;
grant select on public.ticket_activity to authenticated;

create function public.log_ticket_activity(t public.tickets, k text, f text, v text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  created uuid;
begin
  insert into public.ticket_activity (workspace_id, ticket_id, actor_id, kind, from_value, to_value)
  values (t.workspace_id, t.id, (select auth.uid()), k, f, v)
  returning id into created;
  return created;
end;
$$;
revoke execute on function public.log_ticket_activity(public.tickets, text, text, text) from public, anon, authenticated;

create function public.tickets_after_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_ticket_activity(new, 'created', null, new.status::text);
    if new.assigned_to is not null then
      perform public.log_ticket_activity(new, 'assigned', null, new.assigned_to::text);
    end if;
    return new;
  end if;

  if new.deleted_at is not null and old.deleted_at is null then
    perform public.log_ticket_activity(new, 'deleted', null, null);
    return new;
  end if;
  if new.title is distinct from old.title then
    perform public.log_ticket_activity(new, 'title_changed', old.title, new.title);
  end if;
  if new.description is distinct from old.description then
    perform public.log_ticket_activity(new, 'description_changed', null, null);
  end if;
  if new.status is distinct from old.status then
    perform public.log_ticket_activity(new, 'status_changed', old.status::text, new.status::text);
  end if;
  if new.priority is distinct from old.priority then
    perform public.log_ticket_activity(new, 'priority_changed', old.priority::text, new.priority::text);
  end if;
  if new.assigned_to is distinct from old.assigned_to then
    if new.assigned_to is null then
      perform public.log_ticket_activity(new, 'unassigned', old.assigned_to::text, null);
    else
      perform public.log_ticket_activity(new, 'assigned', old.assigned_to::text, new.assigned_to::text);
    end if;
  end if;
  if new.category_id is distinct from old.category_id then
    perform public.log_ticket_activity(new, 'category_changed', old.category_id::text, new.category_id::text);
  end if;
  if new.due_at is distinct from old.due_at then
    perform public.log_ticket_activity(new, 'due_changed', old.due_at::text, new.due_at::text);
  end if;
  return new;
end;
$$;

create trigger tickets_after_write
  after insert or update on public.tickets
  for each row execute function public.tickets_after_write();

-- Comment/attachment activity bumps the ticket's updated_at so lists re-sort.
create function public.touch_ticket(ticket uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.tickets set updated_at = now() where id = ticket;
$$;
revoke execute on function public.touch_ticket(uuid) from public, anon, authenticated;

create function public.comments_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.tickets;
begin
  select * into t from public.tickets where id = new.ticket_id;
  -- Internal notes are not written to the shared timeline.
  if not new.is_internal then
    perform public.log_ticket_activity(t, 'comment_added', null, new.id::text);
  end if;
  perform public.touch_ticket(new.ticket_id);
  return new;
end;
$$;

create trigger ticket_comments_after_insert
  after insert on public.ticket_comments
  for each row execute function public.comments_after_insert();

create function public.attachments_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.tickets;
  internal boolean := false;
begin
  if new.comment_id is not null then
    select is_internal into internal from public.ticket_comments where id = new.comment_id;
  end if;
  if not coalesce(internal, false) then
    select * into t from public.tickets where id = new.ticket_id;
    perform public.log_ticket_activity(t, 'attachment_added', null, new.file_name);
  end if;
  perform public.touch_ticket(new.ticket_id);
  return new;
end;
$$;

create trigger ticket_attachments_after_insert
  after insert on public.ticket_attachments
  for each row execute function public.attachments_after_insert();

-- ---------------------------------------------------------------------------
-- Dashboard numbers. SECURITY INVOKER: RLS decides what is counted.
-- ---------------------------------------------------------------------------
create function public.ticket_stats(ws uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'total',          count(*),
    'open',           count(*) filter (where status = 'open'),
    'in_progress',    count(*) filter (where status = 'in_progress'),
    'resolved',       count(*) filter (where status = 'resolved'),
    'closed',         count(*) filter (where status = 'closed'),
    'overdue',        count(*) filter (where due_at < now() and status in ('open', 'in_progress')),
    'assigned_to_me', count(*) filter (where assigned_to = (select auth.uid()) and status in ('open', 'in_progress')),
    'created_by_me',  count(*) filter (where created_by = (select auth.uid())),
    'unassigned',     count(*) filter (where assigned_to is null and status in ('open', 'in_progress'))
  )
  from public.tickets
  where workspace_id = ws and deleted_at is null;
$$;
revoke execute on function public.ticket_stats(uuid) from public, anon;
grant execute on function public.ticket_stats(uuid) to authenticated;
