import type { IconName } from '@/components/ui/icon';
import type { ThemeColor } from '@/constants/theme';
import type { Role, TicketPriority, TicketStatus } from '@/types/models';

/** GitHub-style: green open, amber in progress, purple resolved, grey closed. */
export const STATUS: Record<TicketStatus, { label: string; tone: ThemeColor; icon: IconName; description: string }> = {
  open: { label: 'Open', tone: 'success', icon: 'issue-opened', description: 'Waiting for someone to pick it up' },
  in_progress: { label: 'In progress', tone: 'warning', icon: 'sync', description: 'Someone is actively working on it' },
  resolved: { label: 'Resolved', tone: 'done', icon: 'issue-closed', description: 'The issue has been fixed' },
  closed: { label: 'Closed', tone: 'neutral', icon: 'skip', description: 'Finalised and no longer active' },
};
export const STATUSES: TicketStatus[] = ['open', 'in_progress', 'resolved', 'closed'];

export const PRIORITY: Record<TicketPriority, { label: string; tone: ThemeColor; icon: IconName; rank: number }> = {
  low: { label: 'Low', tone: 'neutral', icon: 'arrow-down', rank: 0 },
  medium: { label: 'Medium', tone: 'info', icon: 'dash', rank: 1 },
  high: { label: 'High', tone: 'attention', icon: 'arrow-up', rank: 2 },
  urgent: { label: 'Urgent', tone: 'danger', icon: 'flame', rank: 3 },
};
export const PRIORITIES: TicketPriority[] = ['low', 'medium', 'high', 'urgent'];

export const ROLE: Record<Role, { label: string; description: string; tone: ThemeColor }> = {
  owner: { label: 'Owner', description: 'Full control, including deleting the workspace', tone: 'done' },
  admin: { label: 'Admin', description: 'Manages members, tickets and settings', tone: 'info' },
  member: { label: 'Member', description: 'Creates tickets and joins discussions', tone: 'neutral' },
};

export const CATEGORY_COLORS = ['#CF222E', '#BC4C00', '#9A6700', '#1F883D', '#0969DA', '#8250DF', '#BF3989', '#59636E'];

/** Upload rules (mirrored by the database and the storage bucket). */
export const UPLOAD = {
  maxBytes: 10 * 1024 * 1024,
  maxPerBatch: 5,
  mimeTypes: {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
    'text/plain': 'txt',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  } as Record<string, string>,
} as const;
