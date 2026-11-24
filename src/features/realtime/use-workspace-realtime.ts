import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { supabase } from '@/services/supabase';

type Row = { id?: string; ticket_id?: string; user_id?: string };

/**
 * One Realtime channel for the current workspace, plus the user's own
 * notifications. postgres_changes are filtered server-side by RLS, so a member
 * only receives rows they are allowed to read. Events simply invalidate the
 * matching queries; TanStack refetches what is on screen.
 */
export function useWorkspaceRealtime(workspaceId: string | null, userId: string | undefined) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!workspaceId || !userId) return;
    const ws = `workspace_id=eq.${workspaceId}`;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const pending = new Set<string>();

    // Coalesce bursts (e.g. a status change writes ticket + activity + notification).
    const invalidate = (...keys: (string | undefined)[][]) => {
      for (const key of keys) pending.add(JSON.stringify(key));
      clearTimeout(timer);
      timer = setTimeout(() => {
        for (const key of pending) qc.invalidateQueries({ queryKey: JSON.parse(key) });
        pending.clear();
      }, 250);
    };

    const channel = supabase
      .channel(`workspace:${workspaceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets', filter: ws }, (payload) => {
        const row = (payload.new ?? payload.old) as Row;
        invalidate(['ws', workspaceId, 'tickets'], ['ws', workspaceId, 'stats'], ['ws', workspaceId, 'ticket', row.id]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ticket_comments', filter: ws }, (payload) => {
        const row = (payload.new ?? payload.old) as Row;
        invalidate(['ws', workspaceId, 'comments', row.ticket_id]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ticket_attachments', filter: ws }, (payload) => {
        const row = (payload.new ?? payload.old) as Row;
        invalidate(['ws', workspaceId, 'attachments', row.ticket_id]);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ticket_activity', filter: ws }, (payload) => {
        const row = payload.new as Row;
        invalidate(['ws', workspaceId, 'activity', row.ticket_id], ['ws', workspaceId, 'activity-feed']);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workspace_members', filter: ws }, () => {
        invalidate(['ws', workspaceId, 'members'], ['ws', 'memberships'], ['ws', workspaceId, 'invitations']);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workspace_invitations', filter: ws }, () => {
        invalidate(['ws', workspaceId, 'invitations']);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'workspaces', filter: `id=eq.${workspaceId}` }, () => {
        invalidate(['ws', 'memberships']);
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => invalidate(['ws', 'notifications'], ['me', 'invitations']),
      )
      .subscribe();

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [workspaceId, userId, qc]);
}
