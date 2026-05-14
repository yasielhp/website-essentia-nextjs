"use client";

import { useState } from "react";
import { insforge } from "@/lib/insforge";
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

  const handleClick = async () => {
    setLoading(true);
    await insforge.auth.signInWithOAuth({ provider, redirectTo });
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="md"
      disabled={loading}
      onClick={handleClick}
      className="w-full"
    >
      {loading ? "Redirecting…" : providerLabel[provider]}
    </Button>
  );
}
