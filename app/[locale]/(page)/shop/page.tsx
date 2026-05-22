import type { Metadata } from "next";
import { getLocale } from "next-intl/server";

export const metadata: Metadata = {
  title: "Shop | Essentia Wellness",
  description:
    "Shop premium wellness and longevity products curated by Essentia's expert team to enhance your health routine.",
};

export default async function StorePage() {
  const locale = await getLocale();
  const isEs = locale === "es";

  return (
    <section className="bg-sand-50 min-h-dvh">
      <div className="mx-auto flex min-h-dvh flex-col items-center justify-center px-4 text-center">
        <p className="text-petroleum-400 mb-4 text-xs font-semibold tracking-widest uppercase">
          {isEs ? "Próximamente" : "Coming soon"}
        </p>
        <h1 className="font-display text-petroleum-700 text-4xl md:text-6xl">
          {isEs ? "Tienda" : "Store"}
        </h1>
        <p className="text-petroleum-400 mt-4 max-w-md text-lg">
          {isEs
            ? "Productos de bienestar y longevidad seleccionados por nuestro equipo de expertos."
            : "Premium wellness and longevity products curated by our expert team."}
        </p>
      </div>
    </section>
  );
}
