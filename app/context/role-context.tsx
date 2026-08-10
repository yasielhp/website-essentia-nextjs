"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { insforge } from "@/lib/insforge";
import { useAuth } from "@/components/auth-provider";

const STORAGE_KEY = "essentia_role";

type RoleContextValue = {
  role: string | null;
  loading: boolean;
};

const RoleContext = createContext<RoleContextValue>({
  role: null,
  loading: true,
});

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();

  const [role, setRole] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(STORAGE_KEY);
  });
  const [loading, setLoading] = useState(!role);

  useEffect(() => {
    if (authLoading) return;

    let cancelled = false;

    void (async () => {
      if (!user) {
        localStorage.removeItem(STORAGE_KEY);
        setRole(null);
        setLoading(false);
        return;
      }
      const { data } = await insforge.database
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      // A signed-out-then-in switch can leave two lookups in flight; the
      // stale one must not put the previous person's role back in storage.
      if (cancelled) return;

      const fetched = (data as { role: string } | null)?.role ?? null;
      if (fetched) {
        localStorage.setItem(STORAGE_KEY, fetched);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
      setRole(fetched);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  return (
    <RoleContext.Provider value={{ role, loading }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole(): RoleContextValue {
  return useContext(RoleContext);
}
