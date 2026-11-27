import {
  onlineManager,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';

import { UPLOAD } from '@/constants/tickets';
import { useAuth } from '@/features/auth';
import { supabase } from '@/services/supabase';
import { enqueue, flushOutbox, patchPendingTicket, pendingTicket } from '@/sync/outbox';
import type {
  Activity,
  Attachment,
  Category,
  Comment,
  Member,
  Profile,
  Ticket,
  TicketPriority,
  TicketStats,
  TicketStatus,
} from '@/types/models';

const PROFILE = 'id, full_name, email, avatar_url';
export const TICKET_FIELDS = `id, workspace_id, ticket_number, title, description, status, priority, category_id, created_by, assigned_to, due_at, created_at, updated_at, resolved_at,
  creator:profiles!tickets_created_by_fkey(${PROFILE}),
  assignee:profiles!tickets_assigned_to_fkey(${PROFILE}),
  category:ticket_categories(id, name, color)`;

const PAGE = 25;

export const ticketKeys = {
  lists: (ws: string | null) => ['ws', ws, 'tickets'] as const,
  list: (ws: string | null, filters: TicketFilters) => ['ws', ws, 'tickets', filters] as const,
  detail: (ws: string | null, id: string) => ['ws', ws, 'ticket', id] as const,
  comments: (ws: string | null, id: string) => ['ws', ws, 'comments', id] as const,
  attachments: (ws: string | null, id: string) => ['ws', ws, 'attachments', id] as const,
  activity: (ws: string | null, id: string) => ['ws', ws, 'activity', id] as const,
  feed: (ws: string | null) => ['ws', ws, 'activity-feed'] as const,
  stats: (ws: string | null) => ['ws', ws, 'stats'] as const,
};

/* ------------------------------------------------------------- Filters */

export type TicketScope = 'all' | 'assigned' | 'created' | 'unassigned';
export type TicketSort = 'updated' | 'created' | 'oldest' | 'priority' | 'due';
export type CreatedRange = 'any' | '7d' | '30d' | '90d';
export type DueFilter = 'any' | 'overdue' | 'today' | 'week' | 'none';

export type TicketFilters = {
  scope: TicketScope;
  q: string;
  status: TicketStatus[];
  priority: TicketPriority[];
  /** Member ids; 'none' means unassigned. */
  assignee: string[];
  creator: string[];
  category: string[];
  created: CreatedRange;
  due: DueFilter;
  sort: TicketSort;
};

export const DEFAULT_FILTERS: TicketFilters = {
  scope: 'all',
  q: '',
  status: ['open', 'in_progress'],
  priority: [],
  assignee: [],
  creator: [],
  category: [],
  created: 'any',
  due: 'any',
  sort: 'updated',
};

/** How many refinements beyond scope/search/sort are active. */
export function activeFilterCount(f: TicketFilters) {
  return (
    (f.status.length ? 1 : 0) +
    (f.priority.length ? 1 : 0) +
    (f.assignee.length ? 1 : 0) +
    (f.creator.length ? 1 : 0) +
    (f.category.length ? 1 : 0) +
    (f.created !== 'any' ? 1 : 0) +
    (f.due !== 'any' ? 1 : 0)
  );
}

function clean(text: string) {
  return text.replace(/[,()*%\\"']/g, ' ').trim();
}

/** "CD-00012", "#12", "12" → 12 */
function parseTicketNumber(q: string) {
  const match = q.trim().match(/^#?(?:[a-z]{2,5}-)?0*(\d{1,9})$/i);
  return match ? Number(match[1]) : null;
}

function membersMatching(members: Member[], q: string) {
  const needle = q.toLowerCase();
  return members
    .filter((m) => (m.profile?.full_name ?? '').toLowerCase().includes(needle) || (m.profile?.email ?? '').toLowerCase().includes(needle))
    .map((m) => m.user_id);
}

function buildListQuery(ws: string, uid: string, f: TicketFilters, members: Member[]) {
  let query = supabase.from('tickets').select(TICKET_FIELDS).eq('workspace_id', ws);

  if (f.scope === 'assigned') query = query.eq('assigned_to', uid);
  if (f.scope === 'created') query = query.eq('created_by', uid);
  if (f.scope === 'unassigned') query = query.is('assigned_to', null);

  if (f.status.length) query = query.in('status', f.status);
  if (f.priority.length) query = query.in('priority', f.priority);
  if (f.category.length) query = query.in('category_id', f.category);
  if (f.creator.length) query = query.in('created_by', f.creator);
  if (f.assignee.length) {
    const ids = f.assignee.filter((a) => a !== 'none');
    const parts = [...(f.assignee.includes('none') ? ['assigned_to.is.null'] : []), ...(ids.length ? [`assigned_to.in.(${ids.join(',')})`] : [])];
    query = query.or(parts.join(','));
  }

  if (f.created !== 'any') {
    const days = { '7d': 7, '30d': 30, '90d': 90 }[f.created];
    query = query.gte('created_at', new Date(Date.now() - days * 86_400_000).toISOString());
  }

  const now = new Date();
  if (f.due === 'overdue') query = query.lt('due_at', now.toISOString()).in('status', ['open', 'in_progress']);
  if (f.due === 'today') {
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    query = query.gte('due_at', start.toISOString()).lte('due_at', end.toISOString());
  }
  if (f.due === 'week') query = query.gte('due_at', now.toISOString()).lte('due_at', new Date(now.getTime() + 7 * 86_400_000).toISOString());
  if (f.due === 'none') query = query.is('due_at', null);

  const q = clean(f.q);
  if (q) {
    const number = parseTicketNumber(q);
    if (number != null) {
      query = query.eq('ticket_number', number);
    } else {
      const people = membersMatching(members, q);
      const parts = [`title.ilike.*${q}*`, `description.ilike.*${q}*`];
      if (people.length) parts.push(`created_by.in.(${people.join(',')})`, `assigned_to.in.(${people.join(',')})`);
      query = query.or(parts.join(','));
    }
  }

  switch (f.sort) {
    case 'created':
      query = query.order('created_at', { ascending: false });
      break;
    case 'oldest':
      query = query.order('created_at', { ascending: true });
      break;
    case 'priority':
      query = query.order('priority', { ascending: false }).order('updated_at', { ascending: false });
      break;
    case 'due':
      query = query.order('due_at', { ascending: true, nullsFirst: false }).order('updated_at', { ascending: false });
      break;
    default:
      query = query.order('updated_at', { ascending: false });
  }
  return query;
}

export function useTickets(workspaceId: string | null, filters: TicketFilters, members: Member[]) {
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: ticketKeys.list(workspaceId, filters),
    enabled: !!workspaceId && !!user,
    initialPageParam: 0,
    getNextPageParam: (last: Ticket[], all) => (last.length === PAGE ? all.length * PAGE : undefined),
    queryFn: async ({ pageParam }) => {
      const { data, error } = await buildListQuery(workspaceId!, user!.id, filters, members).range(pageParam, pageParam + PAGE - 1);
      if (error) throw error;
      return data as unknown as Ticket[];
    },
    placeholderData: (previous) => previous,
  });
}

/** Small lists for the dashboard. */
export function useRecentTickets(workspaceId: string | null, order: 'updated_at' | 'created_at', limit = 5) {
  return useQuery({
    queryKey: ['ws', workspaceId, 'tickets', 'recent', order, limit],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select(TICKET_FIELDS)
        .eq('workspace_id', workspaceId!)
        .order(order, { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data as unknown as Ticket[];
    },
  });
}

export function useTicketStats(workspaceId: string | null) {
  return useQuery({
    queryKey: ticketKeys.stats(workspaceId),
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('ticket_stats', { ws: workspaceId });
      if (error) throw error;
      return data as TicketStats;
    },
  });
}

export function useActivityFeed(workspaceId: string | null, limit = 12) {
  return useQuery({
    queryKey: ticketKeys.feed(workspaceId),
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ticket_activity')
        .select(`id, ticket_id, actor_id, kind, from_value, to_value, created_at, actor:profiles(${PROFILE}), ticket:tickets(id, ticket_number, title)`)
        .eq('workspace_id', workspaceId!)
        .neq('kind', 'description_changed')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data as unknown as Activity[];
    },
  });
}

/* --------------------------------------------------------------- Detail */

export function useTicket(workspaceId: string | null, id: string) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ticketKeys.detail(workspaceId, id),
    enabled: !!workspaceId && !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('tickets').select(TICKET_FIELDS).eq('id', id).maybeSingle();
      if (error) throw error;
      // Created offline and not synced yet: keep showing the local copy.
      return (data as unknown as Ticket | null) ?? pendingTicket(id) ?? null;
    },
    // Opening from a list shows the row instantly while the detail loads.
    placeholderData: () => findInLists(qc, workspaceId, id) ?? pendingTicket(id),
  });
}

/** Write a ticket into every cached list/detail that holds it. */
function patchCachedTicket(qc: ReturnType<typeof useQueryClient>, ws: string | null, id: string, patch: Partial<Ticket>) {
  qc.setQueryData<Ticket | null>(ticketKeys.detail(ws, id), (t) => (t ? { ...t, ...patch } : t));
  qc.setQueriesData<InfiniteData<Ticket[]> | Ticket[]>({ queryKey: ticketKeys.lists(ws) }, (data) => {
    if (!data) return data;
    const apply = (rows: Ticket[]) => rows.map((t) => (t.id === id ? { ...t, ...patch } : t));
    return 'pages' in data ? { ...data, pages: data.pages.map(apply) } : Array.isArray(data) ? apply(data) : data;
  });
}

function findInLists(qc: ReturnType<typeof useQueryClient>, ws: string | null, id: string) {
  for (const [, data] of qc.getQueriesData<InfiniteData<Ticket[]> | Ticket[]>({ queryKey: ticketKeys.lists(ws) })) {
    const rows = data && 'pages' in data ? data.pages.flat() : Array.isArray(data) ? data : [];
    const hit = rows.find((t) => t.id === id);
    if (hit) return hit;
  }
  return undefined;
}

export function useComments(workspaceId: string | null, ticketId: string) {
  return useQuery({
    queryKey: ticketKeys.comments(workspaceId, ticketId),
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ticket_comments')
        .select(`id, ticket_id, workspace_id, author_id, body, is_internal, created_at, updated_at, edited_at, author:profiles(${PROFILE})`)
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as unknown as Comment[];
    },
  });
}

export function useAttachments(workspaceId: string | null, ticketId: string) {
  return useQuery({
    queryKey: ticketKeys.attachments(workspaceId, ticketId),
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ticket_attachments')
        .select('id, ticket_id, comment_id, uploaded_by, storage_path, file_name, mime_type, size_bytes, created_at')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as Attachment[];
    },
  });
}

export function useActivity(workspaceId: string | null, ticketId: string) {
  return useQuery({
    queryKey: ticketKeys.activity(workspaceId, ticketId),
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ticket_activity')
        .select(`id, ticket_id, actor_id, kind, from_value, to_value, created_at, actor:profiles(${PROFILE})`)
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as unknown as Activity[];
    },
  });
}

/** Short-lived signed URL for a private attachment (cached just under its lifetime). */
export function useSignedUrl(path: string | null) {
  return useQuery({
    queryKey: ['signed-url', path],
    enabled: !!path,
    staleTime: 9 * 60_000,
    gcTime: 9 * 60_000,
    meta: { persist: false },
    queryFn: async () => {
      const { data, error } = await supabase.storage.from('attachments').createSignedUrl(path!, 600);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

/* ------------------------------------------------------------ Uploads */

export type PickedFile = { uri: string; name: string; mimeType: string; size: number };

/** Client-side check; the bucket and table enforce the same rules. */
export function validateFile(file: PickedFile): string | null {
  if (!UPLOAD.mimeTypes[file.mimeType]) return `${file.name}: this file type isn’t supported`;
  if (file.size > UPLOAD.maxBytes) return `${file.name} is larger than 10 MB`;
  if (file.size <= 0) return `${file.name} is empty`;
  return null;
}

export async function uploadAttachments(workspaceId: string, ticketId: string, files: PickedFile[], commentId?: string) {
  const failures: string[] = [];
  for (const file of files.slice(0, UPLOAD.maxPerBatch)) {
    const problem = validateFile(file);
    if (problem) {
      failures.push(problem);
      continue;
    }
    const id = Crypto.randomUUID();
    const path = `${workspaceId}/tickets/${ticketId}/${id}.${UPLOAD.mimeTypes[file.mimeType]}`;
    try {
      const bytes = await new File(file.uri).arrayBuffer();
      const upload = await supabase.storage.from('attachments').upload(path, bytes, { contentType: file.mimeType });
      if (upload.error) throw upload.error;
      const { error } = await supabase.from('ticket_attachments').insert({
        id,
        ticket_id: ticketId,
        comment_id: commentId ?? null,
        storage_path: path,
        file_name: file.name.slice(0, 200),
        mime_type: file.mimeType,
        size_bytes: file.size,
      });
      if (error) {
        await supabase.storage.from('attachments').remove([path]);
        throw error;
      }
    } catch (error) {
      failures.push(`${file.name}: ${(error as { message?: string }).message ?? 'upload failed'}`);
    }
  }
  return failures;
}

/* ----------------------------------------------------------- Mutations */

export type TicketInput = {
  title: string;
  description: string;
  priority: TicketPriority;
  category_id: string | null;
  assigned_to: string | null;
  due_at: string | null;
};

/** Profiles/category for the optimistic row shown while a ticket waits to sync. */
export type TicketDisplay = { assignee?: Profile | null; category?: Pick<Category, 'id' | 'name' | 'color'> | null };

/** Online: insert now. Offline: queue it, show it immediately, sync later (no attachments). */
export function useCreateTicket(workspaceId: string | null) {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    networkMode: 'always',
    mutationFn: async ({ values, files, display = {} }: { values: TicketInput; files: PickedFile[]; display?: TicketDisplay }) => {
      const id = Crypto.randomUUID();
      if (!onlineManager.isOnline()) {
        if (files.length) throw new Error('Attachments need a connection. Remove them or try again online.');
        const now = new Date().toISOString();
        const optimistic: Ticket = {
          id,
          workspace_id: workspaceId!,
          ticket_number: 0,
          ...values,
          status: 'open',
          created_by: user!.id,
          created_at: now,
          updated_at: now,
          resolved_at: null,
          creator: { id: user!.id, full_name: (user!.user_metadata?.full_name as string) ?? '', email: user!.email ?? '', avatar_url: null },
          assignee: display.assignee ?? null,
          category: display.category ?? null,
          pending: true,
        };
        enqueue(id, { kind: 'ticket.create', workspaceId: workspaceId!, payload: { values: { id, workspace_id: workspaceId!, ...values }, optimistic } });
        qc.setQueryData(ticketKeys.detail(workspaceId, id), optimistic);
        return { ticket: optimistic, failures: [] as string[], queued: true };
      }
      const { data, error } = await supabase
        .from('tickets')
        .insert({ id, workspace_id: workspaceId, ...values })
        .select(TICKET_FIELDS)
        .single();
      if (error) throw error;
      const failures = files.length ? await uploadAttachments(workspaceId!, id, files) : [];
      return { ticket: data as unknown as Ticket, failures, queued: false };
    },
    onSuccess: (result) => {
      if (!result.queued) qc.invalidateQueries({ queryKey: ['ws', workspaceId] });
    },
  });
}

export type TicketPatch = Partial<Pick<Ticket, 'title' | 'description' | 'status' | 'priority' | 'category_id' | 'assigned_to' | 'due_at'>>;

/** Optimistic; queued for later when offline. */
export function useUpdateTicket(workspaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    networkMode: 'always',
    mutationFn: async ({ ticket, patch, display = {} }: { ticket: Ticket; patch: TicketPatch; display?: TicketDisplay }) => {
      // Still waiting to be created: fold the edit into the queued insert.
      if (patchPendingTicket(ticket.id, patch, display)) {
        flushOutbox();
        return { queued: true };
      }
      if (!onlineManager.isOnline()) {
        enqueue(Crypto.randomUUID(), {
          kind: 'ticket.update',
          workspaceId: workspaceId!,
          payload: { id: ticket.id, base_updated_at: ticket.updated_at, patch },
        });
        return { queued: true };
      }
      const { error } = await supabase.from('tickets').update(patch).eq('id', ticket.id);
      if (error) throw error;
      return { queued: false };
    },
    onMutate: async ({ ticket, patch, display = {} }) => {
      const key = ticketKeys.detail(workspaceId, ticket.id);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Ticket | null>(key) ?? ticket;
      if (!qc.getQueryData(key)) qc.setQueryData(key, ticket);
      // Detail and every list update at once, online or off.
      patchCachedTicket(qc, workspaceId, ticket.id, { ...patch, ...display });
      return { previous };
    },
    onError: (_e, { ticket }, context) => {
      if (context?.previous) patchCachedTicket(qc, workspaceId, ticket.id, context.previous);
    },
    onSettled: (result, _e, { ticket }) => {
      if (result?.queued) return;
      qc.invalidateQueries({ queryKey: ticketKeys.detail(workspaceId, ticket.id) });
      qc.invalidateQueries({ queryKey: ticketKeys.lists(workspaceId) });
      qc.invalidateQueries({ queryKey: ticketKeys.stats(workspaceId) });
      qc.invalidateQueries({ queryKey: ticketKeys.activity(workspaceId, ticket.id) });
    },
  });
}

export function useDeleteTicket(workspaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ticketId: string) => {
      const { error } = await supabase.rpc('delete_ticket', { ticket: ticketId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ws', workspaceId] }),
  });
}

export function useAddComment(workspaceId: string | null, ticketId: string) {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    networkMode: 'always',
    mutationFn: async ({ body, isInternal, files }: { body: string; isInternal: boolean; files: PickedFile[] }) => {
      const id = Crypto.randomUUID();
      const payload = { id, ticket_id: ticketId, body, is_internal: isInternal };
      // Offline, or the ticket itself hasn't synced yet: queue behind it.
      if (!onlineManager.isOnline() || pendingTicket(ticketId)) {
        if (files.length) throw new Error('Attachments can be added once this ticket has synced.');
        enqueue(id, { kind: 'comment.create', workspaceId: workspaceId!, payload });
        if (onlineManager.isOnline()) flushOutbox();
        // Optimistic, marked pending until the outbox replays it.
        qc.setQueryData<Comment[]>(ticketKeys.comments(workspaceId, ticketId), (list) => [
          ...(list ?? []),
          {
            ...payload,
            workspace_id: workspaceId!,
            author_id: user!.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            edited_at: null,
            author: { id: user!.id, full_name: (user!.user_metadata?.full_name as string) ?? '', email: user!.email ?? '', avatar_url: null },
            pending: true,
          },
        ]);
        return { queued: true, failures: [] as string[] };
      }
      const { error } = await supabase.from('ticket_comments').insert(payload);
      if (error) throw error;
      const failures = files.length ? await uploadAttachments(workspaceId!, ticketId, files, id) : [];
      return { queued: false, failures };
    },
    onSuccess: (result) => {
      if (result.queued) return;
      qc.invalidateQueries({ queryKey: ticketKeys.comments(workspaceId, ticketId) });
      qc.invalidateQueries({ queryKey: ticketKeys.attachments(workspaceId, ticketId) });
    },
  });
}

export function useEditComment(workspaceId: string | null, ticketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: string }) => {
      const { error } = await supabase.from('ticket_comments').update({ body }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ticketKeys.comments(workspaceId, ticketId) }),
  });
}

export function useDeleteComment(workspaceId: string | null, ticketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('delete_comment', { comment: id });
      if (error) throw error;
    },
    onMutate: (id) => {
      qc.setQueryData<Comment[]>(ticketKeys.comments(workspaceId, ticketId), (list) => list?.filter((c) => c.id !== id));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ticketKeys.comments(workspaceId, ticketId) }),
  });
}

export function useUploadAttachments(workspaceId: string | null, ticketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (files: PickedFile[]) => uploadAttachments(workspaceId!, ticketId, files),
    onSettled: () => qc.invalidateQueries({ queryKey: ticketKeys.attachments(workspaceId, ticketId) }),
  });
}

export function useDeleteAttachment(workspaceId: string | null, ticketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: path, error } = await supabase.rpc('delete_attachment', { attachment: id });
      if (error) throw error;
      if (path) await supabase.storage.from('attachments').remove([path as string]);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ticketKeys.attachments(workspaceId, ticketId) }),
  });
}
