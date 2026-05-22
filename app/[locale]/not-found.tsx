import { getLocale } from "next-intl/server";
import { Button } from "@components/ui/button";

export default async function NotFound() {
  const locale = await getLocale();
  const isEs = locale === "es";

  return (
    <section className="bg-petroleum-700 relative flex min-h-[calc(100svh-140px)] flex-col items-center justify-center overflow-hidden px-5 py-20">
      <span
        aria-hidden
        className="font-display text-petroleum-800 pointer-events-none absolute inset-0 flex items-center justify-center text-[38vw] leading-none opacity-40 select-none"
      >
        404
      </span>

      <div className="relative z-10 flex flex-col items-center gap-6 text-center">
        <div className="flex items-center gap-4">
          <span className="bg-sand-500 h-px w-8" />
          <p className="text-sand-500 text-xs tracking-[0.25em] uppercase">
            {isEs ? "Página no encontrada" : "Page not found"}
          </p>
          <span className="bg-sand-500 h-px w-8" />
        </div>

        <h1 className="font-display text-sand-50 max-w-sm text-4xl text-balance md:max-w-lg md:text-6xl">
          {isEs ? (
            <>
              Te has perdido
              <br />
              por el camino.
            </>
          ) : (
            <>
              You&apos;ve wandered
              <br />
              off the path.
            </>
          )}
        </h1>

        <p className="text-sand-500 max-w-xs text-sm text-balance md:max-w-sm">
          {isEs
            ? "La página que buscas no existe. Volvamos al inicio."
            : "The page you're looking for doesn't exist. Let's get you back on track."}
        </p>

        <Button href={isEs ? "/es" : "/"} variant="white" size="lg">
          {isEs ? "Volver al inicio" : "Return home"}
        </Button>
      </div>
    </section>
  );
}
