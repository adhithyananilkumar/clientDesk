/** Row shapes as the app reads them (mirrors supabase/migrations). */

export type Role = 'owner' | 'admin' | 'member';
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type MemberVisibility = 'own' | 'all';

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
};

export type MyProfile = Profile & { notification_prefs: NotificationPrefs };

export type NotificationKind =
  | 'ticket_created'
  | 'ticket_assigned'
  | 'ticket_reassigned'
  | 'comment_added'
  | 'status_changed'
  | 'priority_changed'
  | 'due_soon'
  | 'overdue'
  | 'invitation';

export type NotificationPrefs = Partial<Record<Exclude<NotificationKind, 'ticket_reassigned'> | 'push', boolean>>;

export type Workspace = {
  id: string;
  name: string;
  description: string;
  logo_url: string | null;
  timezone: string;
  default_priority: TicketPriority;
  ticket_prefix: string;
  enabled_priorities: TicketPriority[];
  member_visibility: MemberVisibility;
  default_assignee_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type Membership = { role: Role; created_at: string; workspace: Workspace };

export type Member = {
  workspace_id: string;
  user_id: string;
  role: Role;
  created_at: string;
  profile: Profile | null;
};

export type Invitation = {
  id: string;
  workspace_id: string;
  email: string;
  role: Role;
  invited_by: string;
  expires_at: string;
  accepted_at: string | null;
  declined_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

export type MyInvitation = {
  id: string;
  workspace_id: string;
  workspace_name: string;
  workspace_logo_url: string | null;
  role: Role;
  invited_by_name: string;
  expires_at: string;
  created_at: string;
};

export type Category = { id: string; workspace_id: string; name: string; color: string };

export type Ticket = {
  id: string;
  workspace_id: string;
  ticket_number: number;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category_id: string | null;
  created_by: string;
  assigned_to: string | null;
  due_at: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  creator: Profile | null;
  assignee: Profile | null;
  category: Pick<Category, 'id' | 'name' | 'color'> | null;
};

export type Comment = {
  id: string;
  ticket_id: string;
  workspace_id: string;
  author_id: string;
  body: string;
  is_internal: boolean;
  created_at: string;
  updated_at: string;
  edited_at: string | null;
  author: Profile | null;
  /** Local-only: queued while offline. */
  pending?: boolean;
};

export type Attachment = {
  id: string;
  ticket_id: string;
  comment_id: string | null;
  uploaded_by: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
};

export type ActivityKind =
  | 'created'
  | 'title_changed'
  | 'description_changed'
  | 'status_changed'
  | 'priority_changed'
  | 'assigned'
  | 'unassigned'
  | 'category_changed'
  | 'due_changed'
  | 'deleted'
  | 'comment_added'
  | 'attachment_added';

export type Activity = {
  id: string;
  ticket_id: string;
  actor_id: string | null;
  kind: ActivityKind;
  from_value: string | null;
  to_value: string | null;
  created_at: string;
  actor: Profile | null;
  ticket?: Pick<Ticket, 'id' | 'ticket_number' | 'title'> | null;
};

export type AppNotification = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  ticket_id: string | null;
  actor_id: string | null;
  kind: NotificationKind;
  title: string;
  body: string;
  data: { invitation_id?: string; comment_id?: string };
  read_at: string | null;
  created_at: string;
  actor: Profile | null;
};

export type TicketStats = {
  total: number;
  open: number;
  in_progress: number;
  resolved: number;
  closed: number;
  overdue: number;
  assigned_to_me: number;
  created_by_me: number;
  unassigned: number;
};
