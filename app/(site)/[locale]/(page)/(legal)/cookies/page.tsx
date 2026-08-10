import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isEs = locale === "es";

  return {
    title: {
      absolute: isEs
        ? "Política de Cookies | Essentia"
        : "Cookie Policy | Essentia",
    },
    description: isEs
      ? "Descubre cómo Essentia utiliza cookies y tecnologías similares en nuestro sitio web, y cómo gestionar tus preferencias."
      : "Learn how Essentia uses cookies and similar technologies on our website, and how to manage your preferences.",
    alternates: {
      canonical: isEs ? "/es/cookies" : "/cookies",
      languages: {
        en: "/cookies",
        es: "/es/cookies",
        "x-default": "/cookies",
      },
    },
  };
}
import { CookiesES } from "./content-es";
import { CookiesEN } from "./content-en";

export default async function CookiesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return locale === "es" ? <CookiesES /> : <CookiesEN />;
}
