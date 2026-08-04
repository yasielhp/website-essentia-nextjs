import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import ResetPasswordRedirect from "@components/auth/reset-password-redirect";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: "auth.resetPassword.meta",
  });
  return {
    title: t("title"),
    robots: { index: false, follow: false },
    alternates: {
      canonical: locale === "es" ? "/es/reset-password" : "/reset-password",
      languages: {
        en: "/reset-password",
        es: "/es/reset-password",
        "x-default": "/reset-password",
      },
    },
  };
}

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

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
