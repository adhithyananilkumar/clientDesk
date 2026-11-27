-- ClientDesk RLS / permission smoke test.
-- Run against a database with the migrations applied (see tests/db/README.md).
-- Every check raises on failure; a clean run prints "ALL RLS CHECKS PASSED".
\set ON_ERROR_STOP 1
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@test.dev', '{"full_name":"Olive Owner"}'),
  ('00000000-0000-0000-0000-00000000000b', 'admin@test.dev', '{"full_name":"Adam Admin"}'),
  ('00000000-0000-0000-0000-00000000000c', 'member@test.dev', '{"full_name":"Mia Member"}'),
  ('00000000-0000-0000-0000-00000000000d', 'other@test.dev', '{"full_name":"Otto Outsider"}');

create function pg_temp.act(uid text, email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'email', email)::text, true);
end $$;

create temp table ctx (ws uuid);
create temp table tokens (who text, token text);
grant all on ctx, tokens to authenticated;

set local role authenticated;

-- Owner creates the workspace and invites two people.
select pg_temp.act('00000000-0000-0000-0000-00000000000a', 'owner@test.dev');
insert into ctx select (public.create_workspace('Acme Support', 'Main desk')).id;
insert into tokens select 'admin', token from ctx, public.create_invitation(ctx.ws, 'ADMIN@test.dev', 'admin');
insert into tokens select 'member', token from ctx, public.create_invitation(ctx.ws, 'member@test.dev', 'member');

do $$ begin
  begin perform public.create_invitation((select ws from ctx), 'x@test.dev', 'owner');
        raise exception 'FAIL: owner-role invitation allowed';
  exception when sqlstate '22023' then null; end;
end $$;

-- A different account cannot use someone else's link.
select pg_temp.act('00000000-0000-0000-0000-00000000000d', 'other@test.dev');
do $$ begin
  begin perform public.accept_invitation((select token from tokens where who = 'member'));
        raise exception 'FAIL: outsider accepted an invitation for another address';
  exception when sqlstate '42501' then null; end;
end $$;

select pg_temp.act('00000000-0000-0000-0000-00000000000b', 'admin@test.dev');
select public.accept_invitation((select token from tokens where who = 'admin'));
select pg_temp.act('00000000-0000-0000-0000-00000000000c', 'member@test.dev');
select public.accept_invitation((select token from tokens where who = 'member'));
do $$ begin
  begin perform public.accept_invitation((select token from tokens where who = 'member'));
        raise exception 'FAIL: invitation reused';
  exception when sqlstate '22023' then null; end;
end $$;

-- Member creates a ticket; cannot assign.
insert into public.tickets (workspace_id, title, description, priority)
  select ws, 'Login issue', 'Cannot log in on Android', 'high' from ctx;
do $$ begin
  begin
    insert into public.tickets (workspace_id, title, description, priority, assigned_to)
      select ws, 'Sneaky', 'assign myself', 'low', '00000000-0000-0000-0000-00000000000c' from ctx;
    raise exception 'FAIL: member assigned on create';
  exception when sqlstate '42501' then null; end;
end $$;

-- Admin creates one the member neither created nor is assigned to.
select pg_temp.act('00000000-0000-0000-0000-00000000000b', 'admin@test.dev');
insert into public.tickets (workspace_id, title, description, priority)
  select ws, 'Payment failure', 'Card declined', 'urgent' from ctx;
do $$ begin
  if (select count(*) from public.tickets) <> 2 then raise exception 'FAIL: admin should see 2 tickets'; end if;
  if (select string_agg(ticket_number::text, ',' order by ticket_number) from public.tickets) <> '1,2' then
    raise exception 'FAIL: ticket numbers not sequential';
  end if;
end $$;
insert into public.ticket_comments (ticket_id, body, is_internal)
  select id, 'Internal: suspect fraud', true from public.tickets where title = 'Login issue';
insert into public.ticket_comments (ticket_id, body, is_internal)
  select id, 'We are looking into it', false from public.tickets where title = 'Login issue';

-- Member visibility: own ticket only, no internal notes, no escalation.
select pg_temp.act('00000000-0000-0000-0000-00000000000c', 'member@test.dev');
do $$ begin
  if (select count(*) from public.tickets) <> 1 then raise exception 'FAIL: member sees tickets they should not'; end if;
  if (select count(*) from public.ticket_comments) <> 1 then raise exception 'FAIL: member sees internal note'; end if;
  if (select count(*) from public.workspace_invitations) <> 0 then raise exception 'FAIL: member reads invitations'; end if;
  begin perform public.change_member_role((select ws from ctx), '00000000-0000-0000-0000-00000000000c', 'admin');
        raise exception 'FAIL: member escalated own role';
  exception when sqlstate '42501' then null; end;
  begin
    insert into public.ticket_comments (ticket_id, body, is_internal)
      select id, 'fake note', true from public.tickets limit 1;
    raise exception 'FAIL: member wrote internal note';
  exception when sqlstate '42501' then null; end;
  begin perform public.delete_ticket((select id from public.tickets limit 1));
        raise exception 'FAIL: member deleted ticket';
  exception when sqlstate '42501' then null; end;
  begin
    update public.tickets set assigned_to = '00000000-0000-0000-0000-00000000000c';
    raise exception 'FAIL: member assigned ticket';
  exception when sqlstate '42501' then null; end;
end $$;
update public.tickets set status = 'in_progress', priority = 'medium' where title = 'Login issue';
-- Updating an invisible ticket silently affects nothing.
update public.tickets set status = 'closed' where title = 'Payment failure';
do $$ begin
  if (select status from public.tickets where title = 'Login issue') <> 'in_progress' then
    raise exception 'FAIL: member could not update own ticket';
  end if;
end $$;

-- Outsider sees nothing.
select pg_temp.act('00000000-0000-0000-0000-00000000000d', 'other@test.dev');
do $$ begin
  if (select count(*) from public.tickets) + (select count(*) from public.workspaces)
     + (select count(*) from public.ticket_comments) + (select count(*) from public.workspace_members)
     + (select count(*) from public.ticket_activity) + (select count(*) from public.ticket_categories) <> 0 then
    raise exception 'FAIL: outsider can read workspace data';
  end if;
  if (select count(*) from public.profiles) <> 1 then raise exception 'FAIL: outsider reads other profiles'; end if;
  begin
    insert into public.tickets (workspace_id, title, description, priority) select ws, 'x', 'y', 'low' from ctx;
    raise exception 'FAIL: outsider created ticket';
  exception when sqlstate '42501' then null; end;
end $$;

-- Admin: assign to member; cannot touch the owner or owner-only settings.
select pg_temp.act('00000000-0000-0000-0000-00000000000b', 'admin@test.dev');
update public.tickets set assigned_to = '00000000-0000-0000-0000-00000000000c' where title = 'Payment failure';
do $$ begin
  if (select status from public.tickets where title = 'Payment failure') <> 'open' then
    raise exception 'FAIL: member changed status of an invisible ticket';
  end if;
  begin perform public.change_member_role((select ws from ctx), '00000000-0000-0000-0000-00000000000a', 'member');
        raise exception 'FAIL: admin changed owner role';
  exception when sqlstate '42501' then null; end;
  begin perform public.remove_member((select ws from ctx), '00000000-0000-0000-0000-00000000000a');
        raise exception 'FAIL: admin removed owner';
  exception when sqlstate '42501' then null; end;
  begin update public.workspaces set ticket_prefix = 'ZZ';
        raise exception 'FAIL: admin changed owner-only setting';
  exception when sqlstate '42501' then null; end;
end $$;
update public.workspaces set description = 'Admins can edit this';

select pg_temp.act('00000000-0000-0000-0000-00000000000c', 'member@test.dev');
do $$ begin
  if (select count(*) from public.tickets) <> 2 then raise exception 'FAIL: assignee cannot see assigned ticket'; end if;
  if not exists (select 1 from public.notifications where kind = 'ticket_assigned') then
    raise exception 'FAIL: assignment notification missing';
  end if;
  if (select count(*) from public.notifications where kind = 'comment_added') <> 1 then
    raise exception 'FAIL: member should get exactly one (public) comment notification, got %',
      (select count(*) from public.notifications where kind = 'comment_added');
  end if;
  perform public.leave_workspace((select ws from ctx));
  if (select count(*) from public.tickets) <> 0 then raise exception 'FAIL: departed member still sees tickets'; end if;
end $$;

-- Owner: audit trail, stats, owner cannot leave, transfer.
select pg_temp.act('00000000-0000-0000-0000-00000000000a', 'owner@test.dev');
do $$ declare s jsonb; begin
  if (select count(*) from public.ticket_activity where kind = 'status_changed') <> 1 then
    raise exception 'FAIL: status change not audited';
  end if;
  if exists (select 1 from public.tickets where assigned_to is not null) then
    raise exception 'FAIL: assignments not released when member left';
  end if;
  if (select count(*) from public.notifications where kind = 'ticket_created') <> 2 then
    raise exception 'FAIL: owner should be told about both new tickets';
  end if;
  s := public.ticket_stats((select ws from ctx));
  if (s ->> 'total')::int <> 2 or (s ->> 'in_progress')::int <> 1 then raise exception 'FAIL: stats %', s; end if;
  begin perform public.leave_workspace((select ws from ctx));
        raise exception 'FAIL: owner left without transfer';
  exception when sqlstate '42501' then null; end;
  perform public.transfer_ownership((select ws from ctx), '00000000-0000-0000-0000-00000000000b');
  if public.workspace_role_of((select ws from ctx)) <> 'admin' then raise exception 'FAIL: transfer'; end if;
end $$;

-- Storage path authorization.
select pg_temp.act('00000000-0000-0000-0000-00000000000d', 'other@test.dev');
do $$ begin
  if public.can_access_attachment_object(
       (select ws::text from ctx) || '/tickets/' || (select id::text from public.tickets limit 1) || '/a.pdf') then
    raise exception 'FAIL: outsider storage access';
  end if;
end $$;

reset role;

-- Account deletion (run as the service role would, via the Edge Function).
do $$
declare
  c_tickets int;
begin
  -- b now owns a workspace that still has members: must transfer first.
  begin perform public.prepare_account_deletion('00000000-0000-0000-0000-00000000000b');
        raise exception 'FAIL: owner deleted account without transfer';
  exception when sqlstate 'P0001' then null; end;

  -- c (member, created tickets) can go; the tickets stay with no creator.
  select count(*) into c_tickets from public.tickets where created_by = '00000000-0000-0000-0000-00000000000c';
  perform public.prepare_account_deletion('00000000-0000-0000-0000-00000000000c');
  delete from auth.users where id = '00000000-0000-0000-0000-00000000000c';
  if exists (select 1 from public.profiles where id = '00000000-0000-0000-0000-00000000000c') then
    raise exception 'FAIL: profile kept after account deletion';
  end if;
  if (select count(*) from public.tickets where created_by is null) < c_tickets then
    raise exception 'FAIL: deleted user''s tickets were removed';
  end if;

  -- a created the workspace but no longer owns it: workspace survives, creator cleared.
  perform public.prepare_account_deletion('00000000-0000-0000-0000-00000000000a');
  delete from auth.users where id = '00000000-0000-0000-0000-00000000000a';
  if (select created_by from public.workspaces where id = (select ws from ctx)) is not null then
    raise exception 'FAIL: workspace creator not cleared';
  end if;

  -- d owns nothing shared: a solo workspace of theirs is deleted with them.
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', true);
  perform public.create_workspace('Solo', '');
  perform public.prepare_account_deletion('00000000-0000-0000-0000-00000000000d');
  if exists (select 1 from public.workspaces where name = 'Solo') then
    raise exception 'FAIL: solo workspace kept';
  end if;
end $$;

select 'ALL RLS CHECKS PASSED' as result;
rollback;
