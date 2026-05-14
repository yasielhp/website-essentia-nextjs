"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ResetPasswordRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Para flujo de link (futuro): si hay token en params úsalo
    // Por ahora redirige siempre al flujo de código
    router.replace("/forgot-password");
  }, [router]);

  return (
    <div className="flex items-center justify-center py-20">
      <div className="border-petroleum-700 h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
    </div>
  );
}
