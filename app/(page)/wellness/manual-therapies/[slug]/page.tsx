import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { bookableServices } from "@/data/services-data";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return bookableServices
    .filter((s) => s.category === "wellness")
    .map((s) => ({ slug: s.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const service = bookableServices.find((s) => s.id === slug);
  if (!service) return {};
  return {
    title: `${service.title} | Manual Therapies · Essentia Wellness`,
    description: service.description,
  };
}

export default async function ManualTherapyDetailPage({ params }: Props) {
  const { slug } = await params;
  const service = bookableServices.find((s) => s.id === slug);
  if (!service) notFound();

  return (
    <main className="bg-sand-50 min-h-screen">
      {/* Hero */}
      <section className="relative flex min-h-[50vh] items-end px-5 pb-14 md:min-h-[60vh] md:pb-20">
        <Image
          src={service.image}
          alt={service.title}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgb(9 33 33 / 0.3), rgb(9 33 33 / 0.82))",
          }}
        />
        <div className="relative mx-auto w-full max-w-4xl">
          <Link
            href="/wellness/manual-therapies"
            className="text-sand-400 hover:text-sand-100 mb-4 inline-flex items-center gap-1.5 text-sm transition-colors"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            Manual Therapies
          </Link>
          <h1 className="font-display text-sand-50 text-4xl leading-tight tracking-tight md:text-6xl">
            {service.title}
          </h1>
          <div className="text-sand-400 mt-4 flex flex-wrap gap-4 text-sm">
            <span>{service.durations.join(" · ")}</span>
            {service.priceCenter && (
              <span>From {service.priceCenter}</span>
            )}
          </div>
        </div>
      </section>

      {/* Body */}
      <section className="px-5 py-16 md:py-20">
        <div className="mx-auto max-w-4xl">
          <div className="grid grid-cols-1 gap-12 md:grid-cols-3">
            {/* Main content */}
            <div className="md:col-span-2">
              <p className="text-petroleum-500 text-lg leading-relaxed">
                {service.description}
              </p>
              <p className="text-petroleum-600 mt-6 leading-relaxed">
                {service.body}
              </p>

              {/* Highlights */}
              <div className="mt-12">
                <h2 className="font-display text-petroleum-700 mb-6 text-2xl">
                  What to expect.
                </h2>
                <div className="flex flex-col gap-5">
                  {service.highlights.map((h, i) => (
                    <div
                      key={i}
                      className="border-sand-200 rounded-2xl border bg-white p-6"
                    >
                      <h3 className="text-petroleum-700 font-semibold">
                        {h.title}
                      </h3>
                      <p className="text-petroleum-500 mt-2 text-sm leading-relaxed">
                        {h.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="flex flex-col gap-4">
              <div className="border-sand-200 sticky top-24 rounded-2xl border bg-white p-6">
                <h3 className="text-petroleum-700 mb-4 font-semibold">
                  Book this treatment
                </h3>

                <dl className="text-petroleum-500 mb-6 flex flex-col gap-3 text-sm">
                  <div className="flex justify-between">
                    <dt>Duration</dt>
                    <dd className="text-petroleum-700 font-medium">
                      {service.durations.join(", ")}
                    </dd>
                  </div>
                  {service.priceCenter && (
                    <div className="flex justify-between">
                      <dt>Center</dt>
                      <dd className="text-petroleum-700 font-medium">
                        {service.priceCenter}
                      </dd>
                    </div>
                  )}
                  {service.priceSuite && (
                    <div className="flex justify-between">
                      <dt>Suite</dt>
                      <dd className="text-petroleum-700 font-medium">
                        {service.priceSuite}
                      </dd>
                    </div>
                  )}
                </dl>

                <Link
                  href={`/booking?service=${service.id}`}
                  className="bg-petroleum-700 hover:bg-petroleum-800 flex w-full items-center justify-center rounded-xl px-5 py-3 text-sm font-medium text-white transition-colors"
                >
                  Book a session
                </Link>
                <Link
                  href="/wellness/manual-therapies#treatments"
                  className="border-sand-200 text-petroleum-500 hover:border-petroleum-300 mt-3 flex w-full items-center justify-center rounded-xl border px-5 py-3 text-sm font-medium transition-colors"
                >
                  View all treatments
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
