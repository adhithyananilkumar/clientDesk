import type { IconName } from '@/components/ui/icon';
import { PRIORITY, STATUS } from '@/constants/tickets';
import type { ThemeColor } from '@/constants/theme';
import type { Activity, Category, Member, TicketPriority, TicketStatus } from '@/types/models';
import { displayName, shortDate } from '@/utils/format';

type Described = { text: string; icon: IconName; tone: ThemeColor };

/** Human sentence for one timeline entry, e.g. "changed status to Resolved". */
export function describeActivity(a: Activity, members: Map<string, Member>, categories: Category[]): Described {
  const person = (id: string | null) => (id ? displayName(members.get(id)?.profile, 'a former member') : 'nobody');
  const category = (id: string | null) => categories.find((c) => c.id === id)?.name ?? 'a removed category';

  switch (a.kind) {
    case 'created':
      return { text: 'opened this ticket', icon: 'issue-opened', tone: 'success' };
    case 'status_changed': {
      const to = (a.to_value ?? 'open') as TicketStatus;
      return { text: `changed status to ${STATUS[to].label}`, icon: STATUS[to].icon, tone: STATUS[to].tone };
    }
    case 'priority_changed': {
      const to = (a.to_value ?? 'medium') as TicketPriority;
      return { text: `set priority to ${PRIORITY[to].label}`, icon: PRIORITY[to].icon, tone: PRIORITY[to].tone };
    }
    case 'assigned':
      return {
        text: a.from_value ? `reassigned from ${person(a.from_value)} to ${person(a.to_value)}` : `assigned ${a.to_value === a.actor_id ? 'themselves' : person(a.to_value)}`,
        icon: 'person',
        tone: 'info',
      };
    case 'unassigned':
      return { text: `unassigned ${person(a.from_value)}`, icon: 'person', tone: 'neutral' };
    case 'title_changed':
      return { text: `renamed this ticket to “${a.to_value}”`, icon: 'pencil', tone: 'neutral' };
    case 'description_changed':
      return { text: 'edited the description', icon: 'pencil', tone: 'neutral' };
    case 'category_changed':
      return { text: a.to_value ? `set category to ${category(a.to_value)}` : 'removed the category', icon: 'tag', tone: 'neutral' };
    case 'due_changed':
      return { text: a.to_value ? `set the due date to ${shortDate(a.to_value)}` : 'removed the due date', icon: 'calendar', tone: 'attention' };
    case 'comment_added':
      return { text: 'commented', icon: 'comment', tone: 'neutral' };
    case 'attachment_added':
      return { text: `attached ${a.to_value ?? 'a file'}`, icon: 'paperclip', tone: 'neutral' };
    case 'deleted':
      return { text: 'deleted this ticket', icon: 'trash', tone: 'danger' };
    default:
      return { text: 'updated this ticket', icon: 'dot-fill', tone: 'neutral' };
  }
}
