"use client";

import { useEffect } from "react";
import { useLocale } from "next-intl";
import { Button } from "@components/ui/button";

type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function Error({ error, reset }: ErrorProps) {
  const locale = useLocale();
  const isEs = locale === "es";

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="bg-petroleum-700 relative flex min-h-[calc(100svh-140px)] flex-col items-center justify-center overflow-hidden px-5 py-20">
      <span
        aria-hidden
        className="font-display text-petroleum-800 pointer-events-none absolute inset-0 flex items-center justify-center text-[28vw] leading-none opacity-40 select-none"
      >
        500
      </span>

      <div className="relative z-10 flex flex-col items-center gap-6 text-center">
        <div className="flex items-center gap-4">
          <span className="bg-sand-500 h-px w-8" />
          <p className="text-sand-500 text-xs tracking-[0.25em] uppercase">
            {isEs ? "Algo salió mal" : "Something went wrong"}
          </p>
          <span className="bg-sand-500 h-px w-8" />
        </div>

        <h1 className="font-display text-sand-50 max-w-sm text-4xl text-balance md:max-w-lg md:text-6xl">
          {isEs ? (
            <>
              Se produjo un error
              <br />
              inesperado.
            </>
          ) : (
            <>
              An unexpected
              <br />
              error occurred.
            </>
          )}
        </h1>

        <p className="text-sand-500 max-w-xs text-sm text-balance md:max-w-sm">
          {isEs
            ? "Pedimos disculpas por las molestias. Por favor, inténtalo de nuevo o vuelve al inicio."
            : "We apologize for the inconvenience. Please try again or return to the home page."}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button onClick={reset} variant="white" size="lg">
            {isEs ? "Intentar de nuevo" : "Try again"}
          </Button>
          <Button href={isEs ? "/es" : "/"} variant="outline-white" size="lg">
            {isEs ? "Volver al inicio" : "Return home"}
          </Button>
        </div>
      </div>
    </section>
  );
}
