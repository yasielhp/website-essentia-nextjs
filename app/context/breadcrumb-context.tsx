"use client";

import { createContext, useContext, useEffect, useState, useMemo } from "react";
import { usePathname } from "next/navigation";

type BreadcrumbContextValue = {
  dynamicLabel: string | null;
  setDynamicLabel: (label: string | null) => void;
};

const BreadcrumbContext = createContext<BreadcrumbContextValue>({
  dynamicLabel: null,
  setDynamicLabel: () => {},
});

export function BreadcrumbProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [dynamicLabel, setDynamicLabel] = useState<string | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const id = setTimeout(() => setDynamicLabel(null), 0);
    return () => clearTimeout(id);
  }, [pathname]);

  // `setDynamicLabel` is stable, so this changes only when the label does.
  const value = useMemo(
    () => ({ dynamicLabel, setDynamicLabel }),
    [dynamicLabel],
  );

  return (
    <BreadcrumbContext.Provider value={value}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

export function useDynamicBreadcrumb(label: string | null) {
  const { setDynamicLabel } = useContext(BreadcrumbContext);
  useEffect(() => {
    if (label) setDynamicLabel(label);
  }, [label, setDynamicLabel]);
}

export function useBreadcrumbContext() {
  return useContext(BreadcrumbContext);
}
