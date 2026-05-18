import Image from "next/image";
import Link from "next/link";
import type { BookableService } from "@/data/services-data";
import type { DetailsState } from "@/types";

export function ConfirmStep({
  service,
  duration,
  price,
  date,
  time,
  details,
}: {
  service: BookableService;
  duration: string;
  price: number | null;
  date: Date;
  time: string;
  details: DetailsState;
}) {
  const priceLine = [duration || null, price != null ? `€${price}` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-5 rounded-2xl bg-white p-6">
        <div className="flex items-start gap-4">
          <div className="relative size-16 shrink-0 overflow-hidden rounded-xl">
            <Image
              src={service.image}
              alt={service.title}
              fill
              sizes="64px"
              className="object-cover"
            />
          </div>
          <div>
            <p className="text-petroleum-700 font-medium">{service.title}</p>
            {priceLine && (
              <p className="text-petroleum-400 text-sm">{priceLine}</p>
            )}
          </div>
        </div>

        <div className="border-sand-100 grid gap-3 border-t pt-4 md:grid-cols-2">
          {[
            {
              label: "Date",
              value: date.toLocaleDateString("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              }),
            },
            { label: "Time", value: time },
            {
              label: "Name",
              value: `${details.firstName} ${details.lastName}`,
            },
            { label: "Email", value: details.email },
            { label: "Phone", value: details.phone },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-petroleum-400 text-xs">{label}</p>
              <p className="text-petroleum-700 text-sm">{value}</p>
            </div>
          ))}
        </div>
      </div>

      <p className="text-petroleum-400 text-center text-xs leading-relaxed">
        By confirming you agree to our{" "}
        <Link
          href="/terms"
          className="underline underline-offset-2"
          target="_blank"
        >
          Terms
        </Link>{" "}
        and{" "}
        <Link
          href="/privacy"
          className="underline underline-offset-2"
          target="_blank"
        >
          Privacy Policy
        </Link>
        . A confirmation email will be sent to {details.email}.
      </p>
    </div>
  );
}
