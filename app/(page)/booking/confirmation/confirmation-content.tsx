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

  const date = dateStr ? new Date(dateStr) : null;
  const formattedDate = date
    ? date.toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : null;

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-5 py-20 text-center">
      <div className="bg-petroleum-700 flex size-16 items-center justify-center rounded-full">
        <Check className="text-sand-50" size={28} />
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-petroleum-700 text-3xl md:text-4xl">
          Booking requested.
        </h1>
        {formattedDate && (
          <p className="text-petroleum-500 text-balance">
            {service} on {formattedDate} at {time}.
          </p>
        )}
        {phone && (
          <p className="text-petroleum-400 mt-1 text-sm text-balance">
            We will contact you by phone or WhatsApp at{" "}
            <span className="text-petroleum-500 font-medium">{phone}</span> to
            confirm your appointment.
          </p>
        )}
      </div>
      <Button variant="solid" size="md" href="/">
        Back to home
      </Button>
    </div>
  );
}
