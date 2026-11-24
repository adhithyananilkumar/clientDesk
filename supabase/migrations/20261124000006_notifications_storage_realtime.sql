-- ClientDesk · notifications, push, due-date jobs, storage, realtime

-- ---------------------------------------------------------------------------
-- In-app notifications. Created only by database triggers/jobs.
-- (user_id, dedupe_key) is unique so the same event never notifies twice.
-- ---------------------------------------------------------------------------
create table public.notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete cascade,
  ticket_id    uuid references public.tickets (id) on delete cascade,
  actor_id     uuid references public.profiles (id) on delete set null,
  kind         text not null check (kind in (
                 'ticket_created', 'ticket_assigned', 'ticket_reassigned', 'comment_added',
                 'status_changed', 'priority_changed', 'due_soon', 'overdue', 'invitation')),
  title        text not null,
  body         text not null default '',
  data         jsonb not null default '{}'::jsonb,
  dedupe_key   text not null,
  read_at      timestamptz,
  created_at   timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index notifications_user_unread_idx on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;

create policy "notifications: read own"
  on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy "notifications: mark own read"
  on public.notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "notifications: delete own"
  on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.notifications from anon, authenticated;
grant select, delete, update (read_at) on public.notifications to authenticated;

create function public.mark_all_notifications_read(ws uuid default null)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.notifications set read_at = now()
  where user_id = (select auth.uid()) and read_at is null
    and (ws is null or workspace_id = ws or workspace_id is null or kind = 'invitation');
$$;
revoke execute on function public.mark_all_notifications_read(uuid) from public, anon;
grant execute on function public.mark_all_notifications_read(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Device push tokens.
-- ---------------------------------------------------------------------------
create table public.push_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  token      text not null unique check (char_length(token) between 10 and 255),
  platform   text not null check (platform in ('ios', 'android', 'web')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id);

create trigger push_tokens_set_updated_at
  before update on public.push_tokens
  for each row execute function public.set_updated_at();

alter table public.push_tokens enable row level security;

create policy "push tokens: read own" on public.push_tokens for select to authenticated
  using (user_id = (select auth.uid()));
create policy "push tokens: delete own" on public.push_tokens for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.push_tokens from anon, authenticated;
grant select, delete on public.push_tokens to authenticated;

-- A device token moves to whoever is signed in on that device now.
create function public.register_push_token(device_token text, device_platform text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  insert into public.push_tokens (user_id, token, platform)
  values ((select auth.uid()), device_token, device_platform)
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end;
$$;
revoke execute on function public.register_push_token(text, text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Preferences: profiles.notification_prefs = { "<kind>": false, "push": false }.
-- Missing keys mean "on".
-- ---------------------------------------------------------------------------
create function public.pref_key(kind text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when kind = 'ticket_reassigned' then 'ticket_assigned' else kind end;
$$;

create function public.wants_notification(person uuid, kind text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select (p.notification_prefs ->> public.pref_key(kind))::boolean from public.profiles p where p.id = person), true);
$$;
revoke execute on function public.wants_notification(uuid, text) from public, anon, authenticated;

create function public.notify(
  person uuid, ws uuid, ticket uuid, kind text, title text, body text, dedupe text, extra jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if person is null then
    return;
  end if;
  -- Never notify people about their own actions.
  if person = (select auth.uid()) and kind <> 'invitation' then
    return;
  end if;
  if not public.wants_notification(person, kind) then
    return;
  end if;
  insert into public.notifications (user_id, workspace_id, ticket_id, actor_id, kind, title, body, data, dedupe_key)
  values (person, ws, ticket, (select auth.uid()), kind, left(title, 200), left(coalesce(body, ''), 500), extra, dedupe)
  on conflict (user_id, dedupe_key) do nothing;
end;
$$;
revoke execute on function public.notify(uuid, uuid, uuid, text, text, text, text, jsonb) from public, anon, authenticated;

create function public.ticket_key(t public.tickets)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select w.ticket_prefix from public.workspaces w where w.id = t.workspace_id), 'CD')
         || '-' || lpad(t.ticket_number::text, 5, '0');
$$;
revoke execute on function public.ticket_key(public.tickets) from public, anon, authenticated;

create function public.label_of(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select initcap(replace(value, '_', ' '));
$$;

create function public.actor_name()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select nullif(full_name, '') from public.profiles where id = (select auth.uid())), 'Someone');
$$;
revoke execute on function public.actor_name() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Ticket event notifications. Activity ids make each event's dedupe key.
-- ---------------------------------------------------------------------------
create function public.tickets_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  k text := public.ticket_key(new);
  who text := public.actor_name();
  admin_id uuid;
  event text := coalesce(txid_current()::text, '') || ':' || extract(epoch from clock_timestamp())::text;
begin
  if tg_op = 'INSERT' then
    for admin_id in
      select user_id from public.workspace_members where workspace_id = new.workspace_id and role in ('owner', 'admin')
    loop
      perform public.notify(admin_id, new.workspace_id, new.id, 'ticket_created',
        k || ' · ' || new.title, who || ' opened a new ' || new.priority::text || ' priority ticket',
        'created:' || new.id::text);
    end loop;
    if new.assigned_to is not null then
      perform public.notify(new.assigned_to, new.workspace_id, new.id, 'ticket_assigned',
        k || ' assigned to you', new.title, 'assigned:' || new.id::text || ':' || new.assigned_to::text || ':' || event);
    end if;
    return new;
  end if;

  if new.deleted_at is not null then
    return new;
  end if;

  if new.assigned_to is distinct from old.assigned_to and new.assigned_to is not null then
    perform public.notify(new.assigned_to, new.workspace_id, new.id,
      case when old.assigned_to is null then 'ticket_assigned' else 'ticket_reassigned' end,
      k || ' assigned to you', who || ' assigned you: ' || new.title,
      'assigned:' || new.id::text || ':' || new.assigned_to::text || ':' || event);
  end if;

  if new.status is distinct from old.status then
    perform public.notify(new.created_by, new.workspace_id, new.id, 'status_changed',
      k || ' is now ' || public.label_of(new.status::text), who || ' changed the status of ' || new.title,
      'status:' || new.id::text || ':' || event);
    if new.assigned_to is distinct from new.created_by then
      perform public.notify(new.assigned_to, new.workspace_id, new.id, 'status_changed',
        k || ' is now ' || public.label_of(new.status::text), who || ' changed the status of ' || new.title,
        'status:' || new.id::text || ':' || event);
    end if;
  end if;

  if new.priority is distinct from old.priority then
    perform public.notify(new.created_by, new.workspace_id, new.id, 'priority_changed',
      k || ' priority: ' || public.label_of(new.priority::text), who || ' changed the priority of ' || new.title,
      'priority:' || new.id::text || ':' || event);
    if new.assigned_to is distinct from new.created_by then
      perform public.notify(new.assigned_to, new.workspace_id, new.id, 'priority_changed',
        k || ' priority: ' || public.label_of(new.priority::text), who || ' changed the priority of ' || new.title,
        'priority:' || new.id::text || ':' || event);
    end if;
  end if;

  -- Due date moved: allow fresh reminders for the new date.
  return new;
end;
$$;

create trigger tickets_notify
  after insert or update on public.tickets
  for each row execute function public.tickets_notify();

-- Participants: creator, assignee, and everyone who has commented.
-- Internal notes only reach owners/admins.
create function public.comments_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.tickets;
  k text;
  who text := public.actor_name();
  person uuid;
begin
  select * into t from public.tickets where id = new.ticket_id;
  k := public.ticket_key(t);
  for person in
    select distinct p from (
      select t.created_by as p
      union select t.assigned_to
      union select c.author_id from public.ticket_comments c where c.ticket_id = new.ticket_id and c.deleted_at is null
    ) participants
    where p is not null
  loop
    if new.is_internal and not exists (
      select 1 from public.workspace_members m where m.workspace_id = t.workspace_id and m.user_id = person and m.role in ('owner', 'admin')
    ) then
      continue;
    end if;
    if not public.is_member_of(t.workspace_id, person) then
      continue;
    end if;
    perform public.notify(person, t.workspace_id, t.id, 'comment_added',
      who || case when new.is_internal then ' added an internal note on ' else ' commented on ' end || k,
      left(new.body, 140), 'comment:' || new.id::text, jsonb_build_object('comment_id', new.id));
  end loop;
  return new;
end;
$$;

create trigger ticket_comments_notify
  after insert on public.ticket_comments
  for each row execute function public.comments_notify();

-- Invitation: tell the invitee if they already have an account.
create function public.invitations_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitee uuid;
  ws_name text;
begin
  select id into invitee from public.profiles where lower(email) = lower(new.email) limit 1;
  if invitee is null then
    return new;
  end if;
  select name into ws_name from public.workspaces where id = new.workspace_id;
  perform public.notify(invitee, new.workspace_id, null, 'invitation',
    'You''re invited to ' || coalesce(ws_name, 'a workspace'),
    public.actor_name() || ' invited you to join as ' || public.label_of(new.role::text),
    'invitation:' || new.id::text, jsonb_build_object('invitation_id', new.id));
  return new;
end;
$$;

create trigger workspace_invitations_notify
  after insert on public.workspace_invitations
  for each row execute function public.invitations_notify();

-- ---------------------------------------------------------------------------
-- Due soon / overdue reminders (run by pg_cron every 15 minutes).
-- ---------------------------------------------------------------------------
create function public.notify_due_tickets()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.tickets;
  admin_id uuid;
  sent integer := 0;
  stamp text;
begin
  for t in
    select * from public.tickets
    where deleted_at is null and due_at is not null and status in ('open', 'in_progress')
      and due_at between now() and now() + interval '24 hours'
  loop
    stamp := extract(epoch from t.due_at)::bigint::text;
    perform public.notify(t.assigned_to, t.workspace_id, t.id, 'due_soon',
      public.ticket_key(t) || ' is due soon', t.title, 'due_soon:' || t.id::text || ':' || stamp);
    sent := sent + 1;
  end loop;

  for t in
    select * from public.tickets
    where deleted_at is null and due_at is not null and status in ('open', 'in_progress') and due_at < now()
  loop
    stamp := extract(epoch from t.due_at)::bigint::text;
    perform public.notify(t.assigned_to, t.workspace_id, t.id, 'overdue',
      public.ticket_key(t) || ' is overdue', t.title, 'overdue:' || t.id::text || ':' || stamp);
    for admin_id in
      select user_id from public.workspace_members where workspace_id = t.workspace_id and role in ('owner', 'admin')
    loop
      perform public.notify(admin_id, t.workspace_id, t.id, 'overdue',
        public.ticket_key(t) || ' is overdue', t.title, 'overdue:' || t.id::text || ':' || stamp);
    end loop;
    sent := sent + 1;
  end loop;
  return sent;
end;
$$;
revoke execute on function public.notify_due_tickets() from public, anon, authenticated;

do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('clientdesk-due-reminders', '*/15 * * * *', 'select public.notify_due_tickets()');
exception when others then
  raise notice 'pg_cron unavailable (%); enable it in Dashboard > Database > Extensions and re-run this block.', sqlerrm;
end;
$$;

-- ---------------------------------------------------------------------------
-- Push delivery through Expo's push service, straight from the database
-- (pg_net). Failures never block the notification itself.
-- ---------------------------------------------------------------------------
do $$
begin
  create extension if not exists pg_net;
exception when others then
  raise notice 'pg_net unavailable (%); push delivery will be skipped.', sqlerrm;
end;
$$;

create function public.notifications_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  messages jsonb;
begin
  if not public.wants_notification(new.user_id, 'push') then
    return new;
  end if;
  if not exists (select 1 from pg_catalog.pg_extension where extname = 'pg_net') then
    return new;
  end if;

  select jsonb_agg(jsonb_build_object(
           'to', token,
           'title', new.title,
           'body', new.body,
           'sound', 'default',
           'channelId', 'default',
           'data', jsonb_build_object(
             'notification_id', new.id,
             'ticket_id', new.ticket_id,
             'workspace_id', new.workspace_id,
             'url', case when new.ticket_id is not null then '/ticket/' || new.ticket_id::text
                         when new.kind = 'invitation' then '/invitations'
                         else '/notifications' end)))
  into messages
  from public.push_tokens where user_id = new.user_id;

  if messages is null then
    return new;
  end if;

  begin
    execute 'select net.http_post(url := $1, body := $2, headers := $3)'
      using 'https://exp.host/--/api/v2/push/send', messages,
            '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb;
  exception when others then
    raise notice 'push dispatch skipped: %', sqlerrm;
  end;
  return new;
end;
$$;

create trigger notifications_push
  after insert on public.notifications
  for each row execute function public.notifications_push();

-- ---------------------------------------------------------------------------
-- Storage. `attachments` is private (signed URLs only), `avatars` is public
-- read for profile pictures and workspace logos.
--   attachments/<workspace_id>/tickets/<ticket_id>/<attachment_id>.<ext>
--   avatars/users/<user_id>/<file>      avatars/workspaces/<workspace_id>/<file>
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('attachments', 'attachments', false, 10485760, array[
    'image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']),
  ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create function public.attachment_path_ticket(object_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
declare
  parts text[] := string_to_array(object_name, '/');
  ticket uuid;
begin
  if array_length(parts, 1) <> 4 or parts[2] <> 'tickets' then
    return null;
  end if;
  ticket := parts[3]::uuid;
  perform parts[1]::uuid;
  return ticket;
exception when others then
  return null;
end;
$$;

create function public.can_access_attachment_object(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select public.can_view_ticket(t.workspace_id, t.created_by, t.assigned_to)
    from public.tickets t
    where t.id = public.attachment_path_ticket(object_name)
      and t.deleted_at is null
      and t.workspace_id::text = split_part(object_name, '/', 1)
  ), false);
$$;
revoke execute on function public.can_access_attachment_object(text) from public, anon;
grant execute on function public.can_access_attachment_object(text) to authenticated;

create function public.can_delete_attachment_object(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.ticket_attachments a
    where a.storage_path = object_name
      and (a.uploaded_by = (select auth.uid()) or public.is_workspace_admin(a.workspace_id))
  );
$$;
revoke execute on function public.can_delete_attachment_object(text) from public, anon;
grant execute on function public.can_delete_attachment_object(text) to authenticated;

create policy "attachments bucket: read visible tickets"
  on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and public.can_access_attachment_object(name));

create policy "attachments bucket: upload to visible tickets"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and public.can_access_attachment_object(name));

create policy "attachments bucket: uploader or admin delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'attachments' and (owner_id = (select auth.uid())::text or public.can_delete_attachment_object(name)));

create function public.can_write_avatar_object(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case split_part(object_name, '/', 1)
    when 'users' then split_part(object_name, '/', 2) = (select auth.uid())::text
    when 'workspaces' then exists (
      select 1 from public.workspace_members m
      where m.workspace_id::text = split_part(object_name, '/', 2)
        and m.user_id = (select auth.uid()) and m.role in ('owner', 'admin'))
    else false
  end;
$$;
revoke execute on function public.can_write_avatar_object(text) from public, anon;
grant execute on function public.can_write_avatar_object(text) to authenticated;

create policy "avatars bucket: write own"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and public.can_write_avatar_object(name));
create policy "avatars bucket: update own"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and public.can_write_avatar_object(name))
  with check (bucket_id = 'avatars' and public.can_write_avatar_object(name));
create policy "avatars bucket: delete own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and public.can_write_avatar_object(name));

-- ---------------------------------------------------------------------------
-- Realtime: postgres_changes respects the RLS policies above.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['tickets', 'ticket_comments', 'ticket_attachments', 'ticket_activity',
                           'notifications', 'workspace_members', 'workspace_invitations', 'workspaces']
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
             when undefined_object then raise notice 'supabase_realtime publication missing';
    end;
  end loop;
end;
$$;
