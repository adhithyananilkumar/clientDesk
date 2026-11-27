import { onlineManager } from '@tanstack/react-query';
import { create } from 'zustand';

import { outboxStore } from '@/services/local-db';
import { queryClient } from '@/services/query-client';
import { supabase } from '@/services/supabase';
import { toast } from '@/stores/toast-store';
import type { Ticket } from '@/types/models';

/**
 * Writes made while offline, replayed in order when the connection returns.
 *
 *  ticket.create   idempotent: the ticket id is generated on the device. Edits made
 *                  before it syncs are folded into the queued insert, and the
 *                  `optimistic` row is what lists and the detail screen show meanwhile.
 *  comment.create  idempotent: the comment id is generated on the device, so a
 *                  replay after a lost response is a no-op.
 *  ticket.update   conflict-checked: applied only if the ticket hasn't changed
 *                  on the server since the user edited it (updated_at match).
 */
export type OutboxOp =
  | {
      kind: 'ticket.create';
      workspaceId: string;
      payload: { values: Record<string, unknown> & { id: string; workspace_id: string }; optimistic: Ticket };
    }
  | {
      kind: 'comment.create';
      workspaceId: string;
      payload: { id: string; ticket_id: string; body: string; is_internal: boolean };
    }
  | {
      kind: 'ticket.update';
      workspaceId: string;
      payload: { id: string; base_updated_at: string; patch: Record<string, unknown> };
    };

type SyncState = { pending: number; syncing: boolean; refresh: () => void };

export const useSyncStore = create<SyncState>((set) => ({
  pending: outboxStore.all().length,
  syncing: false,
  refresh: () => set({ pending: outboxStore.all().length }),
}));

export function enqueue(id: string, op: OutboxOp) {
  outboxStore.add(id, op.kind, op);
  useSyncStore.getState().refresh();
}

export function pendingComments(ticketId: string) {
  return outboxStore
    .all()
    .filter((row) => row.kind === 'comment.create')
    .map((row) => JSON.parse(row.payload) as Extract<OutboxOp, { kind: 'comment.create' }>)
    .filter((op) => op.payload.ticket_id === ticketId);
}

type CreateOp = Extract<OutboxOp, { kind: 'ticket.create' }>;

function queuedCreates() {
  return outboxStore
    .all()
    .filter((row) => row.kind === 'ticket.create')
    .map((row) => ({ rowId: row.id, op: JSON.parse(row.payload) as CreateOp }));
}

/** Tickets created offline that haven't reached the server yet (newest first). */
export function pendingTickets(workspaceId: string | null): Ticket[] {
  return queuedCreates()
    .filter(({ op }) => op.workspaceId === workspaceId)
    .map(({ op }) => op.payload.optimistic)
    .reverse();
}

export function pendingTicket(id: string): Ticket | undefined {
  return queuedCreates().find(({ op }) => op.payload.values.id === id)?.op.payload.optimistic;
}

/**
 * If the ticket is still waiting to be created, apply the edit to the queued insert
 * (a separate update would hit a row that doesn't exist yet). Returns false otherwise.
 */
export function patchPendingTicket(id: string, patch: Record<string, unknown>, optimisticExtras: Partial<Ticket> = {}) {
  const hit = queuedCreates().find(({ op }) => op.payload.values.id === id);
  if (!hit) return false;
  const { op } = hit;
  op.payload.values = { ...op.payload.values, ...patch };
  op.payload.optimistic = { ...op.payload.optimistic, ...patch, ...optimisticExtras, updated_at: new Date().toISOString() } as Ticket;
  outboxStore.update(hit.rowId, op);
  useSyncStore.getState().refresh();
  return true;
}

function isNetworkError(error: unknown) {
  const message = String((error as { message?: string })?.message ?? error).toLowerCase();
  return message.includes('network') || message.includes('fetch') || message.includes('timeout');
}

let running = false;

/** Replay everything queued. Stops at the first network failure and retries later. */
export async function flushOutbox() {
  if (running || !onlineManager.isOnline()) return;
  const rows = outboxStore.all();
  if (!rows.length) return;
  running = true;
  useSyncStore.setState({ syncing: true });

  try {
    for (const row of rows) {
      const op = JSON.parse(row.payload) as OutboxOp;
      try {
        if (op.kind === 'ticket.create') {
          const { error } = await supabase
            .from('tickets')
            .upsert(op.payload.values, { onConflict: 'id', ignoreDuplicates: true });
          if (error) throw error;
          queryClient.invalidateQueries({ queryKey: ['ws', op.workspaceId] });
        } else if (op.kind === 'comment.create') {
          const { error } = await supabase
            .from('ticket_comments')
            .upsert(op.payload, { onConflict: 'id', ignoreDuplicates: true });
          if (error) throw error;
          queryClient.invalidateQueries({ queryKey: ['ws', op.workspaceId, 'comments', op.payload.ticket_id] });
        } else if (op.kind === 'ticket.update') {
          const { data, error } = await supabase
            .from('tickets')
            .update(op.payload.patch)
            .eq('id', op.payload.id)
            .eq('updated_at', op.payload.base_updated_at)
            .select('id');
          if (error) throw error;
          if (!data?.length) toast.error('A change you made offline was skipped because the ticket was updated by someone else.');
          queryClient.invalidateQueries({ queryKey: ['ws', op.workspaceId] });
        }
        outboxStore.remove(row.id);
      } catch (error) {
        if (isNetworkError(error)) break;
        // Rejected by the server (e.g. permission revoked): drop it so it can't block the queue.
        outboxStore.remove(row.id);
        toast.error('One offline change could not be saved: ' + ((error as { message?: string }).message ?? 'unknown error'));
      }
    }
  } finally {
    running = false;
    useSyncStore.setState({ syncing: false });
    useSyncStore.getState().refresh();
  }
}

/** Flush now, whenever we come back online, and every 30 s while items wait. */
export function startOutboxSync() {
  flushOutbox();
  const unsubscribe = onlineManager.subscribe((online) => {
    if (online) flushOutbox();
  });
  const interval = setInterval(() => {
    if (outboxStore.all().length) flushOutbox();
  }, 30_000);
  return () => {
    unsubscribe();
    clearInterval(interval);
  };
}
