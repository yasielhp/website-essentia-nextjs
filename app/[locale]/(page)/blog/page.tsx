import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import BlogHeroSection from "@/components/sections/blog/hero-section";
import PostsSection from "@/components/sections/blog/posts-section";
import Newsletter from "@/components/sections/newsletter";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("blog.meta");
  return {
    title: t("title"),
    description: t("description"),
    openGraph: {
      title: t("ogTitle"),
      description: t("ogDescription"),
      type: "website",
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
