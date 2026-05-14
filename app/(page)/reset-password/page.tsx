import type { Metadata } from "next";
import { Suspense } from "react";
import ResetPasswordRedirect from "@components/auth/reset-password-redirect";

export const metadata: Metadata = { title: "Reset Password" };

export default function ResetPasswordPage() {
  return (
    <section className="bg-sand-50 min-h-dvh">
      <div className="mx-auto max-w-md px-5 pt-32 pb-24 md:pt-48">
        <Suspense>
          <ResetPasswordRedirect />
        </Suspense>
      </div>
    </section>
  );
}
