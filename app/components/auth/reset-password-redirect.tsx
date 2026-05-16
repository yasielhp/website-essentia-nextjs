"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ResetPasswordRedirect() {
  const router = useRouter();
  const { replace } = router;

  useEffect(() => {
    // Para flujo de link (futuro): si hay token en params úsalo
    // Por ahora redirige siempre al flujo de código
    replace("/forgot-password");
  }, [replace]);

  return (
    <div className="flex items-center justify-center py-20">
      <div className="border-petroleum-700 size-6 animate-spin rounded-full border-2 border-t-transparent" />
    </div>
  );
}
