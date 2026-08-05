"use client";

import { createContext, use, useEffect, useState, type ReactNode } from "react";
import { insforge } from "@/lib/insforge";
import { clearSession, hasSession, markSession } from "@/lib/auth-session-flag";

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

  // `force` skips the local flag: after a sign-in the cookie is fresh and the
  // flag may not be written yet, so the caller knows better than the hint.
  const hydrateAuth = async ({ force = false }: { force?: boolean } = {}) => {
    if (!force && !hasSession()) {
      setUser(null);
      setLoading(false);
      return;
    }

    const { data, error } = await insforge.auth.getCurrentUser();
    if (error || !data?.user) {
      clearSession();
      setUser(null);
      setLoading(false);
      return;
    }
    markSession();
    const authUser = data.user;
    const { data: profileData } = await insforge.database
      .from("profiles")
      .select("role")
      .eq("id", authUser.id)
      .single();
    setUser({
      ...authUser,
      role: (profileData as { role?: string } | null)?.role ?? undefined,
    });
    setLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void hydrateAuth({ force: requireSession });
  }, [requireSession]);

  const signOut = async () => {
    await insforge.auth.signOut();
    clearSession();
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
