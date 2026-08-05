import { getLocale } from "next-intl/server";
import { NotFoundContent } from "@components/not-found-content";

export default async function NotFound() {
  const locale = await getLocale();

  return <NotFoundContent isEs={locale === "es"} />;
}
