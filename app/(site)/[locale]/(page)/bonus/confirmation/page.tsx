import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "bonus.confirmation" });
  return {
    title: { absolute: t("title") },
    description: t("body"),
    // Reached from the bank with nothing to index.
    robots: { index: false, follow: false },
    alternates: {
      canonical:
        locale === "es" ? "/es/bonus/confirmation" : "/bonus/confirmation",
      languages: {
        en: "/bonus/confirmation",
        es: "/es/bonus/confirmation",
        "x-default": "/bonus/confirmation",
      },
    },
  };
}

export default async function BonusConfirmationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "bonus.confirmation" });

  return (
    <section className="bg-sand-50 flex min-h-dvh flex-col items-center justify-center px-5 py-24">
      <div className="w-full max-w-md text-center">
        <div className="bg-petroleum-700 mx-auto mb-8 flex size-16 items-center justify-center rounded-full">
          <CheckCircle className="text-sand-50" size={28} strokeWidth={2.5} />
        </div>
        <h1 className="font-display text-petroleum-700 text-3xl md:text-4xl">
          {t("heading")}
        </h1>
        <p className="text-petroleum-400 mt-3 leading-relaxed text-balance">
          {t("body")}
        </p>
        <Button variant="solid" size="md" href="/" className="mt-8 w-full">
          {t("cta")}
        </Button>
      </div>
    </section>
  );
}
