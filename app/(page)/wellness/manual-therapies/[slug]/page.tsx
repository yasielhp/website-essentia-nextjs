import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { manualTherapyTreatments } from "@/data/services-data";
import { ServiceDetailView } from "@components/sections/wellness/treatment/service-detail-view";
import { breadcrumbSchema } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return manualTherapyTreatments.map((s) => ({ slug: s.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const service = manualTherapyTreatments.find((s) => s.id === slug);
  if (!service) return {};
  return {
    title: `${service.title} | Manual Therapies · Essentia Wellness`,
    description: service.description,
  };
}

export default async function ManualTherapyDetailPage({ params }: Props) {
  const { slug } = await params;
  const service = manualTherapyTreatments.find((s) => s.id === slug);
  if (!service) notFound();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbSchema([
              { name: "Home", url: "/" },
              { name: "Wellness", url: "/wellness" },
              { name: "Manual Therapies", url: "/wellness/manual-therapies" },
              { name: service.title, url: `/wellness/manual-therapies/${service.id}` },
            ]),
          ),
        }}
      />
      <ServiceDetailView service={service} />
    </>
  );
}
