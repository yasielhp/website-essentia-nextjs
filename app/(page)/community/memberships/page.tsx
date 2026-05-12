import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Memberships | Essentia Social Wellness Club",
  description:
    "Exclusive membership plans at Essentia giving you full access to our longevity center, wellness programs, and community events.",
};

export default function MembershipsPage() {
  return (
    <section className="text-primary min-h-dvh">
      <div className="max-w-10xl mx-auto flex min-h-dvh flex-col items-center justify-center px-4 text-center">
        <h1 className="font-display xs:text-7xl text-4xl">Membresías</h1>
        <p className="text-primary/70 mt-4 text-lg">
          Acceso exclusivo a todos nuestros servicios con planes adaptados a ti.
        </p>
      </div>
    </section>
  );
}
