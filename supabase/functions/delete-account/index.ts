// ClientDesk · delete-account
//
// Permanently deletes the calling user's account. The app calls it after the
// person confirms on the Security screen.
//
//  1. Identify the caller from their JWT (never from the request body).
//  2. prepare_account_deletion(): refuse if they still own a workspace with
//     other members, delete workspaces only they belong to, collect file paths.
//  3. Remove those files from the private `attachments` bucket.
//  4. Delete the auth user; the database cascades the rest.
//
// Needs the service role key, which Supabase injects automatically
// (SUPABASE_SERVICE_ROLE_KEY). Deploy: npx supabase functions deploy delete-account

import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authorization = req.headers.get('Authorization');
  if (!authorization) return json({ error: 'Not signed in' }, 401);

  const url = Deno.env.get('SUPABASE_URL')!;
  const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: auth, error: authError } = await caller.auth.getUser();
  if (authError || !auth.user) return json({ error: 'Not signed in' }, 401);
  const userId = auth.user.id;

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: paths, error: prepError } = await admin.rpc('prepare_account_deletion', { target: userId });
  if (prepError) {
    // P0001 carries a message meant for the person (e.g. transfer ownership first).
    return json({ error: prepError.message }, prepError.code === 'P0001' ? 409 : 500);
  }

  const files = ((paths as string[] | null) ?? []).filter(Boolean);
  for (let i = 0; i < files.length; i += 100) {
    // Best effort: a leftover file is unreachable once its row is gone.
    await admin.storage.from('attachments').remove(files.slice(i, i + 100));
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) return json({ error: deleteError.message }, 500);

  return json({ deleted: true });
});
