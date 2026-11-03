"use client";

import { useEffect } from "react";
import {
  bookableServices,
  manualTherapyTreatments,
} from "@/data/services-data";
import { getAvailableStartTimes } from "@/utils/calendar-helpers";
import { contact } from "@/constants/contact";
import { registerWebMcpTools } from "@/lib/webmcp";

/**
 * The tools this site offers a browser agent.
 *
 * Both are read-only. Nothing here books, pays, or writes: a booking carries a
 * name, an email and a phone number, and an agent should not be filing those
 * on someone's behalf without them seeing the form. The agent can find out
 * what Essentia offers and when it is free, then hand the person the booking
 * page — which is the same page a visitor uses.
 */

type BusyInterval = { start: string; end: string };

/** The localized booking path, as declared in `i18n/routing.ts`. */
function bookingUrl(locale: string) {
  return locale === "es" ? "/es/reserva" : "/booking";
}

export function WebMcpTools({ locale }: { locale: string }) {
  useEffect(() => {
    return registerWebMcpTools([
      {
        name: "essentia_list_services",
        title: "List Essentia services",
        description:
          "List the services and treatments that can be booked at Essentia Wellness Club in Tenerife, with their category, description and available session lengths. Use this to answer what Essentia offers, or before checking availability, because the service id is needed there.",
        annotations: { readOnlyHint: true },
        execute() {
          return {
            services: [
              ...bookableServices.map((service) => ({
                id: service.id,
                category: service.category,
                title: service.title,
                description: service.description,
                durations: service.durations,
              })),
              ...manualTherapyTreatments.map((treatment) => ({
                id: `manual-therapies:${treatment.id}`,
                category: "wellness",
                title: treatment.title,
                description: treatment.description,
                durations: treatment.durations,
                priceCenter: treatment.priceCenter,
                priceSuite: treatment.priceSuite,
              })),
            ],
            bookingUrl: bookingUrl(locale),
          };
        },
      },
      {
        name: "essentia_check_availability",
        title: "Check Essentia availability",
        description:
          "Check which start times are free for a service on a given day at Essentia Wellness Club. Returns times as HH:MM in the centre's local time. Use essentia_list_services first to get the service id.",
        annotations: { readOnlyHint: true },
        inputSchema: {
          type: "object",
          properties: {
            service_id: {
              type: "string",
              description:
                "Service id from essentia_list_services, for example 'contrast-therapy' or 'manual-therapies'.",
            },
            date: {
              type: "string",
              description: "The day to check, as YYYY-MM-DD.",
            },
            duration_minutes: {
              type: "number",
              description:
                "Session length in minutes. Optional — the service's shortest session is used when it is left out.",
            },
          },
          required: ["service_id", "date"],
        },
        async execute(input) {
          const serviceId = String(input.service_id ?? "");
          const date = String(input.date ?? "");

          // The schema is loose so the agent can pass what the visitor said;
          // the checks are strict here so a wrong value comes back with a
          // correction rather than an empty list.
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return {
              error: `"${date}" is not a date. Pass the day as YYYY-MM-DD.`,
            };
          }

          const baseId = serviceId.split(":")[0];
          const service = bookableServices.find((s) => s.id === baseId);
          if (!service) {
            return {
              error: `Unknown service "${serviceId}". Call essentia_list_services for the ids that exist.`,
            };
          }

          // A treatment id carries its own length — `manual-therapies:solea`
          // is 70 minutes, not the 30 of the service it is filed under.
          const treatmentId = serviceId.split(":")[1];
          const treatment = treatmentId
            ? manualTherapyTreatments.find((t) => t.id === treatmentId)
            : undefined;
          if (treatmentId && !treatment) {
            return {
              error: `Unknown treatment "${serviceId}". Call essentia_list_services for the ids that exist.`,
            };
          }

          const requested = Number(input.duration_minutes);
          const durations = (treatment ?? service).durations;
          const duration =
            Number.isFinite(requested) && requested > 0
              ? requested
              : parseInt(durations[0], 10) || 60;

          try {
            const response = await fetch(
              `/api/google/calendar/freebusy?service_id=${encodeURIComponent(baseId)}&date=${encodeURIComponent(date)}`,
            );
            if (!response.ok) throw new Error(String(response.status));

            const { busy } = (await response.json()) as {
              busy?: BusyInterval[];
            };
            const times = getAvailableStartTimes(date, duration, busy ?? []);

            return {
              service: (treatment ?? service).title,
              date,
              durationMinutes: duration,
              availableTimes: times,
              bookingUrl: bookingUrl(locale),
              note:
                times.length === 0
                  ? "Nothing free that day. Try another date."
                  : "Booking is finished by the visitor on the booking page.",
            };
          } catch {
            return {
              error: `Could not reach the calendar for ${service.title} on ${date}. Essentia can be reached on ${contact.phone} or ${contact.email}.`,
            };
          }
        },
      },
    ]);
  }, [locale]);

  return null;
}
