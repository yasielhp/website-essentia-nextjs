import type { Metadata } from "next";
import BlogHeroSection from "@/components/sections/blog/hero-section";
import PostsSection from "@/components/sections/blog/posts-section";
import Newsletter from "@/components/sections/newsletter";

export const metadata: Metadata = {
  title: "Blog | Essentia Longevity & Wellness",
  description:
    "Protocols, perspectives, and science from the Essentia team — written for people who take their health seriously.",
  openGraph: {
    title: "Blog | Essentia Longevity & Wellness",
    description:
      "Protocols, perspectives, and science from the Essentia team.",
    type: "website",
  },
};

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
