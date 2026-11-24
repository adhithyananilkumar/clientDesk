import { z } from 'zod';

export const workspaceSchema = z.object({
  name: z.string().trim().min(2, 'Use at least 2 characters').max(60, 'Use at most 60 characters'),
  description: z.string().trim().max(280, 'Keep it under 280 characters'),
});
export type WorkspaceValues = z.input<typeof workspaceSchema>;

export const ticketSchema = z.object({
  title: z.string().trim().min(3, 'Give the ticket a short title').max(200, 'Keep the title under 200 characters'),
  description: z.string().trim().min(1, 'Describe the issue').max(10000, 'That description is too long'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  category_id: z.string().nullable(),
  assigned_to: z.string().nullable(),
  due_at: z.string().nullable(),
});
export type TicketValues = z.infer<typeof ticketSchema>;

export const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address')),
  role: z.enum(['admin', 'member']),
});
export type InviteValues = z.input<typeof inviteSchema>;

export const passwordSchema = z
  .object({
    password: z.string().min(8, 'Use at least 8 characters').max(72, 'Use at most 72 characters'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { error: 'Passwords do not match', path: ['confirm'] });

export const emailChangeSchema = z.object({ email: z.string().trim().pipe(z.email('Enter a valid email address')) });

export const profileSchema = z.object({
  full_name: z.string().trim().min(2, 'Enter your full name').max(80, 'That name is too long'),
});

export const commentSchema = z.string().trim().min(1).max(5000, 'Comments can be up to 5,000 characters');
