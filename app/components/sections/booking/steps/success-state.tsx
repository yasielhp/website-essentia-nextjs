import { Check } from "lucide-react";
import { Button } from "@components/ui/button";
import type { BookableService } from "@/data/services-data";

export function SuccessState({
  service,
  date,
  time,
  email,
}: {
  service: BookableService;
  date: Date;
  time: string;
  email: string;
}) {
  return (
    <div className="flex flex-col items-center gap-6 py-16 text-center">
      <div className="bg-petroleum-700 flex size-16 items-center justify-center rounded-full">
        <Check className="text-sand-50" size={28} />
      </div>
      <div className="flex flex-col gap-2">
        <h2 className="font-display text-petroleum-700 text-3xl">
          Booking confirmed.
        </h2>
        <p className="text-petroleum-500">
          {service.title} on{" "}
          {date.toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}{" "}
          at {time}.
        </p>
        <p className="text-petroleum-400 mt-1 text-sm">
          A confirmation has been sent to {email}.
        </p>
      </div>
      <Button variant="solid" size="md" href="/">
        Back to home
      </Button>
    </div>
  );
}
