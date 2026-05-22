import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { MembershipsContent } from "./content";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("memberships.meta");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default function MembershipsPage() {
  return (
    <Suspense>
      <MembershipsContent />
    </Suspense>
  );
}
