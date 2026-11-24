import type { Role, Ticket } from '@/types/models';

/**
 * UI-side permission checks. These only decide what to show; the database
 * (RLS + SECURITY DEFINER functions) is what actually enforces them.
 */
export function isAdmin(role: Role | null | undefined) {
  return role === 'owner' || role === 'admin';
}

export const can = {
  viewAllTickets: (role?: Role | null) => isAdmin(role),
  assign: (role?: Role | null) => isAdmin(role),
  deleteTicket: (role?: Role | null) => isAdmin(role),
  inviteMembers: (role?: Role | null) => isAdmin(role),
  removeMembers: (role?: Role | null) => isAdmin(role),
  changeRoles: (role?: Role | null) => isAdmin(role),
  internalNotes: (role?: Role | null) => isAdmin(role),
  manageCategories: (role?: Role | null) => isAdmin(role),
  editWorkspace: (role?: Role | null) => isAdmin(role),
  /** Prefix, priorities, visibility, default assignee. */
  editTicketConfig: (role?: Role | null) => role === 'owner',
  deleteWorkspace: (role?: Role | null) => role === 'owner',
  transferOwnership: (role?: Role | null) => role === 'owner',
  leaveWorkspace: (role?: Role | null) => !!role && role !== 'owner',

  /** Status, priority, title, description, category, due date. */
  manageTicket(role: Role | null | undefined, ticket: Pick<Ticket, 'created_by' | 'assigned_to'>, userId?: string) {
    if (isAdmin(role)) return true;
    return !!userId && (ticket.created_by === userId || ticket.assigned_to === userId);
  },

  /** Can `actor` remove `target`? Owners remove anyone but themselves; admins remove members. */
  removeMember(actor: Role | null | undefined, target: Role, isSelf: boolean) {
    if (isSelf || target === 'owner') return false;
    if (actor === 'owner') return true;
    return actor === 'admin' && target === 'member';
  },

  changeRoleOf(actor: Role | null | undefined, target: Role) {
    return isAdmin(actor) && target !== 'owner';
  },
};
