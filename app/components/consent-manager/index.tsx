import type { ReactNode } from "react";
import ConsentManagerProvider from "./provider";

/**
 * Consent management wrapper.
 * @see https://c15t.com/docs/frameworks/nextjs/quickstart
 */
export function ConsentManager({ children }: { children: ReactNode }) {
  return <ConsentManagerProvider>{children}</ConsentManagerProvider>;
}
