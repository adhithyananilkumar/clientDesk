import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type SwapContext = { settled: boolean; settle: () => void };

const AuthSwapContext = createContext<SwapContext | null>(null);

/**
 * Wraps the sign in / create account stack. The first form screen to mount
 * (arriving from welcome) plays its entrance; screens swapped in afterwards
 * (sign in <-> create account) skip it, so the native cross-fade is the only
 * motion and the shared logo stays perfectly still.
 */
export function AuthSwapProvider({ children }: { children: ReactNode }) {
  const [settled, setSettled] = useState(false);
  const settle = useCallback(() => setSettled(true), []);
  const value = useMemo(() => ({ settled, settle }), [settled, settle]);
  return <AuthSwapContext.Provider value={value}>{children}</AuthSwapContext.Provider>;
}

/** True only for the first form screen shown after leaving welcome. */
export function useShouldPlayEntrance() {
  const swap = useContext(AuthSwapContext);
  // Captured once at mount, so later context updates never re-trigger it.
  const [play] = useState(() => !swap?.settled);
  const settle = swap?.settle;
  useEffect(() => {
    settle?.();
  }, [settle]);
  return play;
}
