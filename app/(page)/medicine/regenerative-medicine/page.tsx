import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Regenerative Medicine | Essentia Tenerife",
  description:
    "Cutting-edge regenerative medicine treatments to restore and optimize your health at Essentia Longevity Center, Tenerife.",
};

export default function RegenerativePage() {
  return (
    <section className="text-primary min-h-dvh">
      <div className="max-w-10xl mx-auto flex min-h-dvh flex-col items-center justify-center px-4 text-center">
        <h1 className="font-display xs:text-7xl text-4xl">
          Medicina Regenerativa
        </h1>
        <p className="text-primary/70 mt-4 text-lg">
          Tratamientos regenerativos para restaurar y optimizar tu salud.
        </p>
      </div>
    </section>
  );
}
