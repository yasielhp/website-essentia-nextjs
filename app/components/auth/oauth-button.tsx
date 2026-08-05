"use client";

import { useState } from "react";
import { insforge } from "@/lib/insforge";
import { markSession } from "@/lib/auth-session-flag";
import { Button } from "@components/ui/button";

type Props = {
  provider: "google";
  redirectTo: string;
};

const providerLabel: Record<Props["provider"], string> = {
  google: "Continue with Google",
};

export function OAuthButton({ provider, redirectTo }: Props) {
  const [loading, setLoading] = useState(false);

  const handleOAuthSignIn = async () => {
    setLoading(true);
    // The provider takes over the tab and the app comes back on a fresh load,
    // so the flag is written before leaving. If the user abandons the consent
    // screen it costs one refresh on the next visit, which clears it again.
    markSession();
    await insforge.auth.signInWithOAuth({ provider, redirectTo });
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="md"
      disabled={loading}
      onClick={handleOAuthSignIn}
      className="w-full"
    >
      {loading ? "Redirecting…" : providerLabel[provider]}
    </Button>
  );
}
