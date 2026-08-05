"use client";

import { createContext, use, useEffect, useState, type ReactNode } from "react";
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
   */
  const hydrateAuth = async ({ force = false }: { force?: boolean } = {}) => {
    // Nobody signed in means nobody to look up: a visitor who never logged in
    // costs no request at all.
    if (!force && !getAccessToken()) {
      setUser(null);
      setLoading(false);
      return;
    }

    const { user: sessionUser, role } = await getSessionUser();
    if (!sessionUser) {
      setUser(null);
      setLoading(false);
      return;
    }

    setUser({ ...sessionUser, role: role ?? undefined });
    setLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void hydrateAuth({ force: requireSession });
  }, [requireSession]);

  const signOut = async () => {
    // Clearing the session means clearing httpOnly cookies, which only the
    // server can do.
    await signOutAction();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signOut,
        refreshUser: () => hydrateAuth({ force: true }),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return use(AuthContext);
}
