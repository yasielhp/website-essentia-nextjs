import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Book Your Visit | Essentia Tenerife",
  description:
    "Schedule your appointment at Essentia Longevity Center and Social Wellness Club in Tenerife. Begin your path to optimal health.",
};

export default function BookPage() {
  return (
    <section className="text-primary min-h-dvh">
      <div className="max-w-10xl mx-auto flex min-h-dvh flex-col items-center justify-center px-4 text-center">
        <h1 className="font-display xs:text-7xl text-4xl">Book Now</h1>
        <p className="text-primary/70 mt-4 text-lg">
          Schedule your appointment and begin your path to relaxation.
        </p>
      </div>
    </section>
  );
}
