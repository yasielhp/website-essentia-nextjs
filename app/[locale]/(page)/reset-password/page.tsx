import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import ResetPasswordRedirect from "@components/auth/reset-password-redirect";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.resetPassword.meta");
  return {
    title: t("title"),
    robots: { index: false, follow: false },
  };
}

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
