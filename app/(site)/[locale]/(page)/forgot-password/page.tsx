import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import ForgotPasswordForm from "@components/auth/forgot-password-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: "auth.forgotPassword.meta",
  });
  return {
    title: t("title"),
    robots: { index: false, follow: false },
    alternates: {
      canonical: locale === "es" ? "/es/forgot-password" : "/forgot-password",
      languages: {
        en: "/forgot-password",
        es: "/es/forgot-password",
        "x-default": "/forgot-password",
      },
    },
  };
}

export default async function ForgotPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <section className="bg-sand-50 min-h-dvh">
      <div className="mx-auto max-w-xl px-5 pt-32 pb-24 md:pt-48">
        <ForgotPasswordForm />
      </div>
    </section>
  );
}
