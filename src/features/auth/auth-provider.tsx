import type { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

import { clearQueryCache, setAuthFailureHandler } from '@/services/query-client';
import { kv, outboxStore } from '@/services/local-db';
import { supabase } from '@/services/supabase';
import { toast } from '@/stores/toast-store';
import { useWorkspaceStore } from '@/stores/workspace-store';

WebBrowser.maybeCompleteAuthSession();

type AuthResult = { error: string | null };
type SignUpResult = AuthResult & { needsConfirmation: boolean };

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  /** True until the stored session has been read from the device. */
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (fullName: string, email: string, password: string) => Promise<SignUpResult>;
  signInWithGoogle: () => Promise<AuthResult>;
  sendPasswordReset: (email: string) => Promise<AuthResult>;
  resendConfirmation: (email: string) => Promise<AuthResult>;
  signOut: (options?: { everywhere?: boolean }) => Promise<void>;
  /** Permanently deletes the account on the server, then clears this device. */
  deleteAccount: () => Promise<AuthResult>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/** Where Supabase sends users back to after email links and Google sign-in. */
export function authRedirectUrl() {
  return Linking.createURL('/auth/callback');
}

const handledCodes = new Set<string>();

/** True while the user is signing out on purpose (no "session expired" message). */
let manualSignOut = false;

/** Treat a token that expires within 30 s as already expired. */
function isExpired(session: Session) {
  return !!session.expires_at && session.expires_at * 1000 < Date.now() + 30_000;
}

/** Nothing from the previous account stays on the device. */
function clearLocalData() {
  clearQueryCache();
  outboxStore.clear();
  kv.removePrefix('draft:');
  kv.remove('current-workspace');
  useWorkspaceStore.setState({ currentId: null });
}

/** Session can't be renewed: sign out locally (the listener shows the message). */
async function expireSession() {
  await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
}

/**
 * Finish sign-in from a returning URL: a PKCE `code` (OAuth, email confirm,
 * password recovery) or, for older links, tokens in the fragment.
 */
export async function completeAuthFromUrl(url: string): Promise<AuthResult & { type?: string }> {
  const parsed = new URL(url.replace('#', url.includes('?') ? '&' : '?'));
  const params = parsed.searchParams;
  const description = params.get('error_description');
  if (description) return { error: description.replace(/\+/g, ' ') };

  const type = params.get('type') ?? undefined;
  const code = params.get('code');
  if (code) {
    if (handledCodes.has(code)) return { error: null, type };
    handledCodes.add(code);
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return { error: error ? friendlyError(error.message) : null, type };
  }

  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (access_token && refresh_token) {
    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    return { error: error ? friendlyError(error.message) : null, type };
  }
  return { error: null, type };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        let current = data.session;
        // A stored session whose access token has lapsed must refresh now, or the user is signed out.
        if (current && isExpired(current)) {
          const refreshed = await supabase.auth.refreshSession();
          current = refreshed.data.session;
          if (!current) await expireSession();
        }
        if (active) setSession(current);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === 'SIGNED_OUT') {
        // Covers expiry and revocation (refresh token rejected) as well as normal sign-out.
        clearLocalData();
        if (!manualSignOut) toast.error('Your session expired. Please sign in again.');
        manualSignOut = false;
      }
    });

    // Any request rejected for an invalid/expired token: try one refresh, else sign out.
    setAuthFailureHandler(async () => {
      const { data: refreshed } = await supabase.auth.refreshSession();
      if (!refreshed.session) await expireSession();
    });

    // Coming back to the app after a long time: check before showing stale screens.
    const appState = AppState.addEventListener('change', async (state) => {
      if (state !== 'active') return;
      const { data: s } = await supabase.auth.getSession();
      if (s.session && isExpired(s.session)) {
        const refreshed = await supabase.auth.refreshSession();
        if (!refreshed.data.session) await expireSession();
      }
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
      appState.remove();
      setAuthFailureHandler(null);
    };
  }, []);

  const signIn = useCallback<AuthContextValue['signIn']>(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return { error: error ? friendlyError(error.message) : null };
  }, []);

  const signUp = useCallback<AuthContextValue['signUp']>(async (fullName, email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName.trim() }, emailRedirectTo: authRedirectUrl() },
    });
    return {
      error: error ? friendlyError(error.message) : null,
      // No session back means Supabase is waiting for the email to be confirmed.
      needsConfirmation: !error && !data.session,
    };
  }, []);

  const signInWithGoogle = useCallback<AuthContextValue['signInWithGoogle']>(async () => {
    const redirectTo = authRedirectUrl();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: Platform.OS !== 'web' },
    });
    if (error) return { error: friendlyError(error.message) };
    if (Platform.OS === 'web' || !data.url) return { error: null };

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success') return { error: null };
    return completeAuthFromUrl(result.url);
  }, []);

  const sendPasswordReset = useCallback<AuthContextValue['sendPasswordReset']>(async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${authRedirectUrl()}?next=reset`,
    });
    return { error: error ? friendlyError(error.message) : null };
  }, []);

  const resendConfirmation = useCallback<AuthContextValue['resendConfirmation']>(async (email) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: { emailRedirectTo: authRedirectUrl() },
    });
    return { error: error ? friendlyError(error.message) : null };
  }, []);

  const signOut = useCallback<AuthContextValue['signOut']>(async (options) => {
    // This device should stop receiving pushes for the account.
    const token = kv.get<string>('push-token');
    if (token) {
      await supabase.from('push_tokens').delete().eq('token', token).then(undefined, () => undefined);
    }
    manualSignOut = true;
    await supabase.auth.signOut({ scope: options?.everywhere ? 'global' : 'local' });
    clearLocalData();
  }, []);

  const deleteAccount = useCallback<AuthContextValue['deleteAccount']>(async () => {
    const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
    if (error) {
      // The function answers with { error } meant for the person (e.g. transfer ownership first).
      let message = 'Couldn’t delete your account. Check your connection and try again.';
      try {
        const body = await (error as { context?: Response }).context?.json();
        if (body?.error) message = body.error;
      } catch {
        // Keep the generic message.
      }
      return { error: message };
    }
    // The server already removed the user and its push tokens; just forget it here.
    manualSignOut = true;
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    clearLocalData();
    return { error: null };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isLoading,
      signIn,
      signUp,
      signInWithGoogle,
      sendPasswordReset,
      resendConfirmation,
      signOut,
      deleteAccount,
    }),
    [session, isLoading, signIn, signUp, signInWithGoogle, sendPasswordReset, resendConfirmation, signOut, deleteAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}

export function friendlyError(message: string): string {
  const text = message.toLowerCase();
  if (text.includes('invalid login')) return 'Incorrect email or password.';
  if (text.includes('email not confirmed')) return 'Confirm your email first, then sign in.';
  if (text.includes('already registered')) return 'An account with this email already exists.';
  if (text.includes('rate limit')) return 'Too many attempts. Try again in a few minutes.';
  if (text.includes('code verifier') || text.includes('auth code')) {
    return 'Open the link on the same device you requested it from.';
  }
  if (text.includes('should be different')) return 'Choose a password you haven’t used here before.';
  if (text.includes('network') || text.includes('fetch')) return 'Cannot reach the server. Check your connection.';
  return message;
}
