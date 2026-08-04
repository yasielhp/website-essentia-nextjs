import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import SignInForm from "@components/auth/sign-in-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth.signIn.meta" });
  return {
    title: { absolute: t("title") },
    robots: { index: false, follow: false },
    alternates: {
      canonical: locale === "es" ? "/es/sign-in" : "/sign-in",
      languages: {
        en: "/sign-in",
        es: "/es/sign-in",
        "x-default": "/sign-in",
      },
    },
  };
}

export default async function SignInPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <section className="bg-sand-50 min-h-dvh">
      <div className="mx-auto max-w-xl px-5 pt-32 pb-24 md:pt-48">
        <SignInForm />
      </div>
    </section>
  );
}
