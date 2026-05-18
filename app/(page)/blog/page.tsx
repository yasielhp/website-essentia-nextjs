import type { Metadata } from "next";
import { BlogList } from "./blog-list";
import Newsletter from "@/components/sections/newsletter";

export const metadata: Metadata = {
  title: "Blog | Essentia Longevity & Wellness",
  description:
    "Artículos, guías y recursos sobre bienestar, salud y longevidad del equipo de Essentia en Tenerife.",
  openGraph: {
    title: "Blog | Essentia Longevity & Wellness",
    description:
      "Artículos, guías y recursos sobre bienestar, salud y longevidad.",
    type: "website",
  },
};

export default function BlogPage() {
  return (
    <>
      <BlogList />
      <Newsletter />
    </>
  );
}
