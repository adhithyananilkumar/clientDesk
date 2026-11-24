/** Display helpers: ticket keys, names, dates and sizes. */

export function ticketKey(prefix: string | undefined, number: number) {
  return `${prefix || 'CD'}-${String(number).padStart(5, '0')}`;
}

export function displayName(profile: { full_name?: string | null; email?: string | null } | null | undefined, fallback = 'Unknown') {
  if (!profile) return fallback;
  return profile.full_name?.trim() || profile.email?.split('@')[0] || fallback;
}

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? name;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "now", "5m", "3h", "2d", then a short date. */
export function timeAgo(iso: string, now = Date.now()) {
  const diff = now - new Date(iso).getTime();
  if (diff < MINUTE) return 'now';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d`;
  return shortDate(iso);
}

export function shortDate(iso: string) {
  const date = new Date(iso);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}

export function longDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** "Due today", "Due tomorrow", "Due in 3 days", "Overdue by 2 days". */
export function dueLabel(iso: string, now = new Date()) {
  const due = new Date(iso);
  const days = Math.round((startOfDay(due).getTime() - startOfDay(now).getTime()) / DAY);
  if (due.getTime() < now.getTime()) {
    if (days === 0) return 'Due today';
    return `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}`;
  }
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days < 7) return `Due in ${days} days`;
  return `Due ${shortDate(iso)}`;
}

export function isOverdue(iso: string | null, status: string) {
  return !!iso && (status === 'open' || status === 'in_progress') && new Date(iso).getTime() < Date.now();
}

export function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function greeting(hour = new Date().getHours()) {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Turn a Supabase/Postgres error into one short sentence. */
export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.') {
  if (!error) return fallback;
  const message = (error as { message?: string }).message ?? String(error);
  const lower = message.toLowerCase();
  if (lower.includes('network request failed') || lower.includes('failed to fetch')) {
    return 'You appear to be offline. Check your connection and try again.';
  }
  if (lower.includes('jwt') || lower.includes('not signed in')) return 'Your session expired. Please sign in again.';
  if (lower.includes('row-level security') || lower.includes('permission denied')) {
    return 'You don’t have permission to do that.';
  }
  if (lower.includes('duplicate key') && lower.includes('ticket_categories')) return 'A category with that name already exists.';
  return message.length > 160 ? fallback : message;
}
