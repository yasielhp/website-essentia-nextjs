"use client";

import { useSearchParams } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ConfirmationContent() {
  const searchParams = useSearchParams();
  const service = searchParams.get("service") ?? "Your session";
  const dateStr = searchParams.get("date");
  const time = searchParams.get("time") ?? "";
  const phone = searchParams.get("phone") ?? "";

  // Parse only the date portion to avoid UTC↔local shift
  const dateIso = dateStr?.split("T")[0];
  const date = dateIso ? new Date(`${dateIso}T12:00:00`) : null;
  const formattedDate = date
    ? date.toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  const hasDetails = service || formattedDate || time;

  return (
    <section className="bg-sand-50 flex min-h-dvh flex-col items-center justify-center px-5 py-24">
      <div className="w-full max-w-md">
        {/* Icon */}
        <div className="bg-petroleum-700 mx-auto mb-8 flex size-16 items-center justify-center rounded-full">
          <Check className="text-sand-50" size={28} strokeWidth={2.5} />
        </div>

        {/* Heading */}
        <div className="mb-8 text-center">
          <h1 className="font-display text-petroleum-700 text-3xl md:text-4xl">
            Booking requested.
          </h1>
          <p className="text-petroleum-400 mt-3 leading-relaxed text-balance">
            We&apos;ve received your request and will be in touch shortly to
            confirm your appointment.
          </p>
        </div>

        {/* Detail card */}
        {hasDetails && (
          <div className="border-sand-200 divide-sand-100 mb-6 divide-y rounded-2xl border bg-white">
            {service && (
              <div className="flex items-center justify-between px-5 py-3.5">
                <span className="text-petroleum-400 text-sm">Service</span>
                <span className="text-petroleum-700 text-sm font-medium">
                  {service}
                </span>
              </div>
            )}
            {formattedDate && (
              <div className="flex items-center justify-between px-5 py-3.5">
                <span className="text-petroleum-400 text-sm">Date</span>
                <span className="text-petroleum-700 text-sm font-medium">
                  {formattedDate}
                </span>
              </div>
            )}
            {time && (
              <div className="flex items-center justify-between px-5 py-3.5">
                <span className="text-petroleum-400 text-sm">Time</span>
                <span className="text-petroleum-700 text-sm font-medium">
                  {time}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Contact note */}
        <p className="text-petroleum-400 mb-8 text-center text-sm leading-relaxed">
          Please keep an eye on your email
          {phone && (
            <>
              {" "}
              and phone{" "}
              <span className="text-petroleum-600 font-medium">{phone}</span>
            </>
          )}
          . We will reach out to confirm your appointment.
        </p>

        {/* CTA */}
        <Button variant="solid" size="md" href="/" className="w-full">
          Back to home
        </Button>
      </div>
    </section>
  );
}
