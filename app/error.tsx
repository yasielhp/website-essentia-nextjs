"use client";

import { useEffect, useSyncExternalStore } from "react";
import { ErrorView } from "@components/error-view";

type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function Error({ error, reset }: ErrorProps) {
  const isEs = useSyncExternalStore(
    () => () => {},
    () => /(?:^|;\s*)NEXT_LOCALE=es(?:;|$)/.test(document.cookie),
    () => false,
  );

  useEffect(() => {
    console.error(error);
  }, [error]);

  return <ErrorView isEs={isEs} reset={reset} />;
}
