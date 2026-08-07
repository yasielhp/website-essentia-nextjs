"use client";

import { useEffect } from "react";
import { useLocale } from "next-intl";
import { ErrorView } from "@components/error-view";

type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function Error({ error, reset }: ErrorProps) {
  const locale = useLocale();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return <ErrorView isEs={locale === "es"} reset={reset} />;
}
