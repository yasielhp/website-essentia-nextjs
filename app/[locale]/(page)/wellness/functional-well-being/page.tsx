import { redirect } from "next/navigation";

export default async function FunctionalWellBeingRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(
    locale === "es"
      ? "/es/bienestar/terapias-faciales"
      : "/wellness/facial-therapies",
  );
}
