"use client";

import type { ReactNode } from "react";
import {
  ConsentDialog,
  ConsentManagerProvider,
  ConsentBanner,
  ConsentDialogTrigger,
} from "@c15t/nextjs";
import { DevTools } from "@c15t/dev-tools/react";
import { theme } from "./theme";
import { googleTagManager } from "@c15t/scripts/google-tag-manager";

const scripts = process.env.NEXT_PUBLIC_GTM_ID
  ? [googleTagManager({ id: process.env.NEXT_PUBLIC_GTM_ID })]
  : [];

export default function ConsentManagerClient({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ConsentManagerProvider
      options={{
        mode: "offline",
        overrides: { country: "ES" },
        theme,
        scripts,
      }}
    >
      <ConsentBanner />
      <ConsentDialog />
      <ConsentDialogTrigger
        icon="fingerprint"
        showWhen="always"
        defaultPosition="bottom-left"
        size="sm"
      />
      <DevTools disabled={process.env.NODE_ENV === "production"} />
      {children}
    </ConsentManagerProvider>
  );
}
