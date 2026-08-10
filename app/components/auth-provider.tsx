"use client";

import {
  createContext,
  use,
  useEffect,
  useState,
  type ReactNode,
  useMemo,
  useCallback,
} from "react";
import { getSessionUser, signOut as signOutAction } from "@/actions/auth";
import { getAccessToken } from "@/lib/client-session";

type User = {
  id: string;
  email: string;
  name?: string;
  role?: string;
};

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  signOut: async () => {},
  refreshUser: async () => {},
});

/**
 * `requireSession` marks the areas that exist only for signed-in people — the
 * account and the dashboard. There the session must be resolved on arrival
 * whatever the local flag says, so a browser holding a valid cookie from
 * before the flag existed still walks straight in. The public site keeps the
 * flag, which is the whole point: a visitor who never signed in never asks the
 * server to refresh a session they do not have.
 */
export function AuthProvider({
  children,
  requireSession = false,
}: {
  children: ReactNode;
  requireSession?: boolean;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * The session is resolved on the server, which is the only side that can
   * read the httpOnly refresh cookie — and, since `createBrowserClient()`
   * holds a token but never a user, the only side that can say who this is.
   *
   * `force` skips the access-token check: right after a sign-in the cookie is
   * there but this component may not have re-read it yet.
   *
   * This half only reads. Keeping it free of `setUser` is what lets the effect
   * below decide, after the await, whether the answer is still wanted.
   */
  const resolveSession = useCallback(
    async ({
      force = false,
    }: { force?: boolean } = {}): Promise<User | null> => {
      // Nobody signed in means nobody to look up: a visitor who never logged in
      // costs no request at all.
      if (!force && !getAccessToken()) return null;

      const { user: sessionUser, role } = await getSessionUser();
      if (!sessionUser) return null;

      return { ...sessionUser, role: role ?? undefined };
    },
    [],
  );

  const hydrateAuth = useCallback(
    async (options?: { force?: boolean }) => {
      setUser(await resolveSession(options));
      setLoading(false);
    },
    [resolveSession],
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const next = await resolveSession({ force: requireSession });

      // `requireSession` can flip while `getSessionUser()` is still in flight.
      // Without this the slower of the two answers would be the one that wins.
      if (cancelled) return;

      setUser(next);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [requireSession, resolveSession]);

  const signOut = useCallback(async () => {
    // Clearing the session means clearing httpOnly cookies, which only the
    // server can do.
    await signOutAction();
    setUser(null);
  }, []);

  // Memoised: the object literal was new on every render, so every consumer
  // of this context re-rendered whenever the provider did, whether or not the
  // user had changed.
  const value = useMemo(
    () => ({
      user,
      loading,
      signOut,
      refreshUser: () => hydrateAuth({ force: true }),
    }),
    [user, loading, signOut, hydrateAuth],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return use(AuthContext);
}
