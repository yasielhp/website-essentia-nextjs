import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ConsentForm } from "@/components/sections/consent/consent-form";
import { loadConsentByToken } from "@/lib/consent/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}): Promise<Metadata> {
  const { locale, token } = await params;
  const t = await getTranslations({ locale, namespace: "consent" });
  return {
    title: { absolute: t("metaTitle") },
    // Not for a search engine, and kept out of the sitemap: it is reached from a
    // private link and shows one person's data. The language pair is still
    // declared because the language selector reads it to find its counterpart.
    alternates: {
      canonical:
        locale === "es" ? `/es/consentimiento/${token}` : `/consent/${token}`,
      languages: {
        en: `/consent/${token}`,
        es: `/es/consentimiento/${token}`,
        "x-default": `/consent/${token}`,
      },
    },
    robots: { index: false, follow: false },
  };
}

export default async function ConsentPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  setRequestLocale(locale);

  const subject = await loadConsentByToken(token);
  if (!subject) notFound();

  const t = await getTranslations({ locale, namespace: "consent" });
  const name = [subject.firstName, subject.lastName].filter(Boolean).join(" ");

  return (
    <section className="bg-sand-50 flex min-h-dvh flex-col items-center px-5 py-24">
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="font-display text-petroleum-700 text-3xl md:text-4xl">
            {t("title")}
          </h1>
          <p className="text-petroleum-400 mt-3 leading-relaxed text-balance">
            {subject.signed ? t("already") : t("intro")}
          </p>
        </div>

        {!subject.signed && (
          <ConsentForm
            mode="client"
            token={token}
            subject={{
              name,
              email: subject.email,
              phone: subject.phone,
              birthdate: subject.birthdate,
            }}
          />
        )}
      </div>
    </section>
  );
}
