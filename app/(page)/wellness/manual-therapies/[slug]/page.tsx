import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { manualTherapyTreatments } from "@/data/services-data";
import { ServiceDetailView } from "@components/sections/wellness/treatment/service-detail-view";

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

  return <ServiceDetailView service={service} />;
}
