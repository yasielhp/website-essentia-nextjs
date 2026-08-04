import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import SignUpForm from "@components/auth/sign-up-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth.signUp.meta" });
  return {
    title: { absolute: t("title") },
    robots: { index: false, follow: false },
    alternates: {
      canonical: locale === "es" ? "/es/sign-up" : "/sign-up",
      languages: {
        en: "/sign-up",
        es: "/es/sign-up",
        "x-default": "/sign-up",
      },
    },
  };
}

export default async function SignUpPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <section className="bg-sand-50 min-h-dvh">
      <div className="mx-auto max-w-xl px-5 pt-32 pb-24 md:pt-48">
        <SignUpForm />
      </div>
    </section>
  );
}
