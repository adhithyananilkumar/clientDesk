import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { File } from 'expo-file-system';
import { useMemo } from 'react';

import { useAuth } from '@/features/auth';
import { supabase } from '@/services/supabase';
import { useWorkspaceStore } from '@/stores/workspace-store';
import type {
  Category,
  Invitation,
  Member,
  Membership,
  MyInvitation,
  MyProfile,
  Role,
  Workspace,
} from '@/types/models';

const PROFILE_FIELDS = 'id, full_name, email, avatar_url';
const WORKSPACE_FIELDS =
  'id, name, description, logo_url, timezone, default_priority, ticket_prefix, enabled_priorities, member_visibility, default_assignee_id, created_by, created_at, updated_at';

export const keys = {
  memberships: (uid?: string) => ['ws', 'memberships', uid] as const,
  members: (ws?: string | null) => ['ws', ws, 'members'] as const,
  categories: (ws?: string | null) => ['ws', ws, 'categories'] as const,
  invitations: (ws?: string | null) => ['ws', ws, 'invitations'] as const,
  myInvitations: (uid?: string) => ['me', 'invitations', uid] as const,
  profile: (uid?: string) => ['ws', 'profile', uid] as const,
};

function must<T>(result: { data: T | null; error: unknown }): T {
  if (result.error) throw result.error;
  return result.data as T;
}

/* ------------------------------------------------------------ Workspaces */

export function useMemberships() {
  const { user } = useAuth();
  return useQuery({
    queryKey: keys.memberships(user?.id),
    enabled: !!user,
    queryFn: async () =>
      must(
        await supabase
          .from('workspace_members')
          .select(`role, created_at, workspace:workspaces!inner(${WORKSPACE_FIELDS})`)
          .eq('user_id', user!.id)
          .order('created_at', { ascending: true }),
      ) as unknown as Membership[],
  });
}

/** Current workspace + my role in it. Falls back to the first workspace. */
export function useWorkspace() {
  const memberships = useMemberships();
  const currentId = useWorkspaceStore((s) => s.currentId);
  const setCurrent = useWorkspaceStore((s) => s.setCurrent);

  const list = memberships.data;
  const active = useMemo(
    () => list?.find((m) => m.workspace.id === currentId) ?? list?.[0] ?? null,
    [list, currentId],
  );

  return {
    workspace: active?.workspace ?? null,
    workspaceId: active?.workspace.id ?? null,
    role: (active?.role ?? null) as Role | null,
    memberships: list ?? [],
    isLoading: memberships.isLoading,
    isError: memberships.isError,
    refetch: memberships.refetch,
    switchTo: setCurrent,
  };
}

export function useCreateWorkspace() {
  const qc = useQueryClient();
  const setCurrent = useWorkspaceStore((s) => s.setCurrent);
  return useMutation({
    mutationFn: async (input: { name: string; description?: string }) =>
      must(
        await supabase.rpc('create_workspace', {
          workspace_name: input.name,
          workspace_description: input.description ?? '',
        }),
      ) as Workspace,
    onSuccess: async (workspace) => {
      setCurrent(workspace.id);
      await qc.invalidateQueries({ queryKey: ['ws', 'memberships'] });
    },
  });
}

export type WorkspacePatch = Partial<
  Pick<
    Workspace,
    | 'name'
    | 'description'
    | 'logo_url'
    | 'timezone'
    | 'default_priority'
    | 'ticket_prefix'
    | 'enabled_priorities'
    | 'member_visibility'
    | 'default_assignee_id'
  >
>;

export function useUpdateWorkspace(workspaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: WorkspacePatch) =>
      must(await supabase.from('workspaces').update(patch).eq('id', workspaceId!).select(WORKSPACE_FIELDS).single()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ws', 'memberships'] }),
  });
}

export function useDeleteWorkspace() {
  const qc = useQueryClient();
  const setCurrent = useWorkspaceStore((s) => s.setCurrent);
  return useMutation({
    mutationFn: async (workspaceId: string) => {
      const { error } = await supabase.from('workspaces').delete().eq('id', workspaceId);
      if (error) throw error;
    },
    onSuccess: async () => {
      setCurrent(null);
      await qc.invalidateQueries({ queryKey: ['ws'] });
    },
  });
}

export function useLeaveWorkspace() {
  const qc = useQueryClient();
  const setCurrent = useWorkspaceStore((s) => s.setCurrent);
  return useMutation({
    mutationFn: async (workspaceId: string) =>
      must(await supabase.rpc('leave_workspace', { target_workspace: workspaceId })),
    onSuccess: async () => {
      setCurrent(null);
      await qc.invalidateQueries({ queryKey: ['ws'] });
    },
  });
}

export function useTransferOwnership(workspaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (newOwner: string) =>
      must(await supabase.rpc('transfer_ownership', { target_workspace: workspaceId, new_owner: newOwner })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ws'] }),
  });
}

/* --------------------------------------------------------------- Members */

export function useMembers(workspaceId: string | null) {
  return useQuery({
    queryKey: keys.members(workspaceId),
    enabled: !!workspaceId,
    queryFn: async () =>
      must(
        await supabase
          .from('workspace_members')
          .select(`workspace_id, user_id, role, created_at, profile:profiles(${PROFILE_FIELDS})`)
          .eq('workspace_id', workspaceId!)
          .order('created_at', { ascending: true }),
      ) as unknown as Member[],
  });
}

/** Members indexed by user id, for quick name lookups. */
export function useMemberMap(workspaceId: string | null) {
  const { data } = useMembers(workspaceId);
  return useMemo(() => new Map((data ?? []).map((m) => [m.user_id, m])), [data]);
}

export function useChangeRole(workspaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: Role }) =>
      must(await supabase.rpc('change_member_role', { target_workspace: workspaceId, target_user: userId, new_role: role })),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.members(workspaceId) }),
  });
}

export function useRemoveMember(workspaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) =>
      must(await supabase.rpc('remove_member', { target_workspace: workspaceId, target_user: userId })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ws', workspaceId] }),
  });
}

/* ----------------------------------------------------------- Invitations */

export function useInvitations(workspaceId: string | null, enabled = true) {
  return useQuery({
    queryKey: keys.invitations(workspaceId),
    enabled: !!workspaceId && enabled,
    queryFn: async () =>
      must(
        await supabase
          .from('workspace_invitations')
          .select('id, workspace_id, email, role, invited_by, expires_at, accepted_at, declined_at, revoked_at, created_at')
          .eq('workspace_id', workspaceId!)
          .is('accepted_at', null)
          .is('revoked_at', null)
          .is('declined_at', null)
          .order('created_at', { ascending: false }),
      ) as Invitation[],
  });
}

export function useCreateInvitation(workspaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ email, role }: { email: string; role: Role }) => {
      const rows = must(
        await supabase.rpc('create_invitation', { target_workspace: workspaceId, invitee_email: email, invitee_role: role }),
      ) as { invitation_id: string; token: string; expires_at: string }[];
      const invite = rows[0];
      // Email is best effort: the invitation also shows up in-app for existing accounts.
      let emailed = false;
      try {
        const { data } = await supabase.functions.invoke('send-invitation', {
          body: { invitation_id: invite.invitation_id, token: invite.token },
        });
        emailed = !!(data as { sent?: boolean } | null)?.sent;
      } catch {
        emailed = false;
      }
      return { ...invite, emailed };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.invitations(workspaceId) }),
  });
}

export function useRevokeInvitation(workspaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (invitationId: string) => must(await supabase.rpc('revoke_invitation', { invitation: invitationId })),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.invitations(workspaceId) }),
  });
}

export function useMyInvitations() {
  const { user } = useAuth();
  return useQuery({
    queryKey: keys.myInvitations(user?.id),
    enabled: !!user,
    queryFn: async () => must(await supabase.rpc('my_invitations')) as MyInvitation[],
  });
}

export function useRespondToInvitation() {
  const qc = useQueryClient();
  const setCurrent = useWorkspaceStore((s) => s.setCurrent);
  return useMutation({
    mutationFn: async ({ id, accept }: { id: string; accept: boolean }) => {
      if (accept) return must(await supabase.rpc('accept_invitation_by_id', { invitation: id })) as string;
      must(await supabase.rpc('decline_invitation', { invitation: id }));
      return null;
    },
    onSuccess: async (workspaceId) => {
      if (workspaceId) setCurrent(workspaceId);
      await qc.invalidateQueries({ queryKey: ['me', 'invitations'] });
      await qc.invalidateQueries({ queryKey: ['ws'] });
    },
  });
}

export function useAcceptInviteToken() {
  const qc = useQueryClient();
  const setCurrent = useWorkspaceStore((s) => s.setCurrent);
  return useMutation({
    mutationFn: async (token: string) => must(await supabase.rpc('accept_invitation', { invite_token: token })) as string,
    onSuccess: async (workspaceId) => {
      setCurrent(workspaceId);
      await qc.invalidateQueries({ queryKey: ['ws'] });
      await qc.invalidateQueries({ queryKey: ['me', 'invitations'] });
    },
  });
}

/* ------------------------------------------------------------ Categories */

export function useCategories(workspaceId: string | null) {
  return useQuery({
    queryKey: keys.categories(workspaceId),
    enabled: !!workspaceId,
    queryFn: async () =>
      must(
        await supabase
          .from('ticket_categories')
          .select('id, workspace_id, name, color')
          .eq('workspace_id', workspaceId!)
          .order('name'),
      ) as Category[],
  });
}

export function useSaveCategory(workspaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id?: string; name: string; color: string }) => {
      if (input.id) {
        must(await supabase.from('ticket_categories').update({ name: input.name.trim(), color: input.color }).eq('id', input.id));
      } else {
        must(
          await supabase
            .from('ticket_categories')
            .insert({ workspace_id: workspaceId, name: input.name.trim(), color: input.color }),
        );
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.categories(workspaceId) }),
  });
}

export function useDeleteCategory(workspaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => must(await supabase.from('ticket_categories').delete().eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.categories(workspaceId) }),
  });
}

/* -------------------------------------------------------------- Profile */

export function useMyProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: keys.profile(user?.id),
    enabled: !!user,
    queryFn: async () =>
      must(
        await supabase.from('profiles').select(`${PROFILE_FIELDS}, notification_prefs`).eq('id', user!.id).single(),
      ) as MyProfile,
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (patch: Partial<Pick<MyProfile, 'full_name' | 'avatar_url' | 'notification_prefs'>>) => {
      must(await supabase.from('profiles').update(patch).eq('id', user!.id));
      if (patch.full_name !== undefined) await supabase.auth.updateUser({ data: { full_name: patch.full_name } });
    },
    onMutate: async (patch) => {
      const key = keys.profile(user?.id);
      const previous = qc.getQueryData<MyProfile>(key);
      if (previous) qc.setQueryData(key, { ...previous, ...patch });
      return { previous };
    },
    onError: (_e, _p, context) => {
      if (context?.previous) qc.setQueryData(keys.profile(user?.id), context.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: keys.profile(user?.id) });
      qc.invalidateQueries({ queryKey: ['ws'] });
    },
  });
}

/** Upload an image to the public avatars bucket and return its URL. */
export async function uploadPublicImage(folder: string, uri: string, mimeType = 'image/jpeg') {
  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const path = `${folder}/${Date.now()}.${ext}`;
  const bytes = await new File(uri).arrayBuffer();
  const { error } = await supabase.storage.from('avatars').upload(path, bytes, { contentType: mimeType, upsert: false });
  if (error) throw error;
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}
