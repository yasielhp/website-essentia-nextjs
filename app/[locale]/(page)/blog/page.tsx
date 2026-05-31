import type { Metadata } from "next";

export const revalidate = 3600;
import { getTranslations } from "next-intl/server";
import { getOgImage } from "@/constants/metadata";
import BlogHeroSection from "@/components/sections/blog/hero-section";
import PostsSection from "@/components/sections/blog/posts-section";
import Newsletter from "@/components/sections/newsletter";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "blog.meta" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical: locale === "es" ? "/es/blog" : "/blog",
      languages: {
        en: "/blog",
        es: "/es/blog",
        "x-default": "/blog",
      },
    },
    openGraph: {
      title: t("ogTitle"),
      description: t("ogDescription"),
      type: "website",
      locale: locale === "es" ? "es_ES" : "en_US",
      images: getOgImage(locale),
    },
  };
}

export default function BlogPage() {
  return (
    <>
      <BlogHeroSection />
      <PostsSection />
      <div id="newsletter">
        <Newsletter variant="light" />
      </div>
    </>
  );
}
