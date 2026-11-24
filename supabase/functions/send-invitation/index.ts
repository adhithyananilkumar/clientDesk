// ClientDesk · send-invitation
//
// Called by the app right after `create_invitation` returns a one-time token.
// It re-checks, as the calling user (RLS applies), that the invitation exists
// and is still pending, then emails the invite link through Resend.
//
// Secrets (Dashboard > Edge Functions > Secrets):
//   RESEND_API_KEY      required to actually send email
//   INVITE_FROM_EMAIL   e.g. "ClientDesk <invites@yourdomain.com>"
//   INVITE_LINK_BASE    optional, defaults to "clientdesk://invite"
//
// Deploy: npx supabase functions deploy send-invitation

import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authorization = req.headers.get('Authorization');
  if (!authorization) return json({ error: 'Not signed in' }, 401);

  let payload: { invitation_id?: string; token?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid body' }, 400);
  }
  const { invitation_id, token } = payload;
  if (!invitation_id || !token || !/^[0-9a-f]{64}$/.test(token)) return json({ error: 'Invalid invitation' }, 400);

  // User-scoped client: only owners/admins of the workspace can read the row.
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
  });

  const { data: invitation, error } = await supabase
    .from('workspace_invitations')
    .select('id, email, role, expires_at, accepted_at, revoked_at, declined_at, workspace:workspaces(name), inviter:profiles!workspace_invitations_invited_by_fkey(full_name, email)')
    .eq('id', invitation_id)
    .maybeSingle();

  if (error || !invitation) return json({ error: 'Invitation not found' }, 404);
  if (invitation.accepted_at || invitation.revoked_at || invitation.declined_at) {
    return json({ error: 'Invitation is no longer pending' }, 409);
  }

  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) return json({ sent: false, reason: 'Email is not configured' });

  const base = Deno.env.get('INVITE_LINK_BASE') ?? 'clientdesk://invite';
  const link = `${base}?token=${token}`;
  // deno-lint-ignore no-explicit-any
  const workspaceName = (invitation as any).workspace?.name ?? 'a workspace';
  // deno-lint-ignore no-explicit-any
  const inviter = (invitation as any).inviter;
  const inviterName = inviter?.full_name || inviter?.email || 'A teammate';
  const role = invitation.role === 'admin' ? 'Admin' : 'Member';
  const expires = new Date(invitation.expires_at).toUTCString();

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#1F2328">
    <div style="font-size:20px;font-weight:700;margin-bottom:24px">ClientDesk</div>
    <h1 style="font-size:24px;line-height:32px;margin:0 0 12px">Join ${escapeHtml(workspaceName)}</h1>
    <p style="font-size:16px;line-height:24px;color:#59636E;margin:0 0 24px">
      ${escapeHtml(inviterName)} invited you to join <b>${escapeHtml(workspaceName)}</b> as ${role}.
    </p>
    <a href="${link}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;font-weight:600;padding:14px 24px;border-radius:999px">Accept invitation</a>
    <p style="font-size:13px;line-height:20px;color:#59636E;margin:24px 0 0">
      Sign in with ${escapeHtml(invitation.email)} to accept. This link works once and expires ${escapeHtml(expires)}.
    </p>
  </div>`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: Deno.env.get('INVITE_FROM_EMAIL') ?? 'ClientDesk <onboarding@resend.dev>',
      to: [invitation.email],
      subject: `${inviterName} invited you to ${workspaceName} on ClientDesk`,
      html,
      text: `${inviterName} invited you to join ${workspaceName} on ClientDesk as ${role}.\n\nAccept: ${link}\n\nThis link works once and expires ${expires}.`,
    }),
  });

  if (!response.ok) return json({ sent: false, reason: 'Email provider rejected the message' }, 502);
  return json({ sent: true });
});
