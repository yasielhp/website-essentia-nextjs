"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { insforge } from "@/lib/insforge";

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const hydrateAuth = async () => {
    const { data, error } = await insforge.auth.getCurrentUser();
    if (error || !data?.user) {
      setUser(null);
      setLoading(false);
      return;
    }
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
    void hydrateAuth();
  }, []);

  const signOut = async () => {
    await insforge.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, signOut, refreshUser: hydrateAuth }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
