import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';

import { useAuth } from '@/features/auth';
import { supabase } from '@/services/supabase';
import type { AppNotification } from '@/types/models';

const PAGE = 30;
const FIELDS = 'id, user_id, workspace_id, ticket_id, actor_id, kind, title, body, data, read_at, created_at, actor:profiles!notifications_actor_id_fkey(id, full_name, email, avatar_url)';

/** Current workspace's notifications plus invitations (which belong to no workspace yet for the invitee). */
function scope(workspaceId: string | null) {
  return workspaceId ? `workspace_id.eq.${workspaceId},kind.eq.invitation` : 'kind.eq.invitation';
}

export function useNotifications(workspaceId: string | null) {
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: ['ws', 'notifications', user?.id, workspaceId, 'list'],
    enabled: !!user,
    initialPageParam: 0,
    getNextPageParam: (last: AppNotification[], all) => (last.length === PAGE ? all.length * PAGE : undefined),
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase
        .from('notifications')
        .select(FIELDS)
        .eq('user_id', user!.id)
        .or(scope(workspaceId))
        .order('created_at', { ascending: false })
        .range(pageParam, pageParam + PAGE - 1);
      if (error) throw error;
      return data as unknown as AppNotification[];
    },
  });
}

export function useUnreadCount(workspaceId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['ws', 'notifications', user?.id, workspaceId, 'unread'],
    enabled: !!user,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .is('read_at', null)
        .or(scope(workspaceId));
      if (error) throw error;
      return count ?? 0;
    },
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onMutate: (id) => {
      const now = new Date().toISOString();
      qc.setQueriesData<InfiniteData<AppNotification[]>>({ queryKey: ['ws', 'notifications'] }, (data) =>
        data && 'pages' in data
          ? { ...data, pages: data.pages.map((page) => page.map((n) => (n.id === id && !n.read_at ? { ...n, read_at: now } : n))) }
          : data,
      );
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['ws', 'notifications'] }),
  });
}

export function useMarkAllRead(workspaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('mark_all_notifications_read', { ws: workspaceId });
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['ws', 'notifications'] }),
  });
}
