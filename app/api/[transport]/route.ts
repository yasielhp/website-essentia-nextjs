import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import {
  bookableServices,
  manualTherapyTreatments,
} from "@/data/services-data";
import { getAvailableStartTimes } from "@/utils/calendar-helpers";

// ─── Helpers ──────────────────────────────────────────────────

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://www.essentiawellnessclub.com";

type BusyInterval = { start: string; end: string };

// ─── MCP handler ──────────────────────────────────────────────

const handler = createMcpHandler(
  (server) => {
    // ── Tool 1: list_services ──────────────────────────────────
    server.registerTool(
      "list_services",
      {
        title: "List Services",
        description:
          "List all available services and treatments at Essentia Wellness Club, including prices, durations, and descriptions.",
      },
      async () => {
        type ServiceEntry = {
          id: string;
          category: string;
          title: string;
          description: string;
          durations: string[];
          priceCenter?: string;
          priceSuite?: string;
        };

        const services: ServiceEntry[] = bookableServices.map((s) => ({
          id: s.id,
          category: s.category,
          title: s.title,
          description: s.description,
          durations: s.durations,
        }));

        const manualTreatments: ServiceEntry[] = manualTherapyTreatments.map(
          (t) => ({
            id: `manual-therapies:${t.id}`,
            category: "wellness",
            title: t.title,
            description: t.description,
            durations: t.durations,
            priceCenter: t.priceCenter,
            priceSuite: t.priceSuite,
          }),
        );

        const text = [...services, ...manualTreatments]
          .map((s) => {
            const price = s.priceCenter
              ? `Price: ${s.priceCenter} (at centre)${s.priceSuite ? ` / ${s.priceSuite} (in-suite)` : ""}`
              : "";
            return [
              `**${s.title}** (${s.category}) — ID: ${s.id}`,
              `Duration: ${s.durations.join(", ")}`,
              price,
              s.description,
            ]
              .filter(Boolean)
              .join("\n");
          })
          .join("\n\n---\n\n");

        return { content: [{ type: "text" as const, text }] };
      },
    );

    // ── Tool 2: get_availability ───────────────────────────────
    server.registerTool(
      "get_availability",
      {
        title: "Get Availability",
        description:
          "Check available time slots for a specific service on a given date. Returns HH:MM time slots.",
        inputSchema: {
          service_id: z
            .string()
            .describe(
              "Service ID from list_services (e.g. 'contrast-therapy', 'manual-therapies')",
            ),
          date: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .describe("Date in YYYY-MM-DD format"),
          duration_minutes: z
            .number()
            .int()
            .positive()
            .optional()
            .describe(
              "Session duration in minutes — required for services with variable durations",
            ),
        },
      },
      async ({ service_id, date, duration_minutes }) => {
        try {
          const res = await fetch(
            `${siteUrl}/api/google/calendar/freebusy?service_id=${service_id}&date=${date}`,
          );

          if (!res.ok) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Could not fetch availability for ${service_id} on ${date}. Please call +34 634 09 12 95 or email info@essentiawellnessclub.com.`,
                },
              ],
            };
          }

          const { busy } = (await res.json()) as { busy: BusyInterval[] };

          const service = bookableServices.find((s) => s.id === service_id);
          const fallbackDuration = service
            ? parseInt(service.durations[0], 10) || 60
            : 60;
          const duration = duration_minutes ?? fallbackDuration;
          const available = getAvailableStartTimes(date, duration, busy ?? []);

          if (available.length === 0) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `No available slots for ${service_id} on ${date}. Please try a different date or contact us.`,
                },
              ],
            };
          }

          return {
            content: [
              {
                type: "text" as const,
                text: `Available slots for ${service_id} on ${date} (${duration} min):\n\n${available.join(", ")}`,
              },
            ],
          };
        } catch {
          return {
            content: [
              {
                type: "text" as const,
                text: "Unable to check availability. Please contact us at +34 634 09 12 95 or info@essentiawellnessclub.com.",
              },
            ],
          };
        }
      },
    );

    // Tool 3 was `create_booking`. Online booking is off while the studio is
    // between premises — only staff and partners book, from the dashboard — so
    // the tool is gone rather than left announced and refusing. The two tools
    // above are read-only; an agent now hands the person the contact page.
    // The old body is in git history for this file.
  },
  {
    // `basePath` and `maxDuration` were dropped in mcp-handler 2: the handler
    // is served wherever it is mounted, and each request is its own
    // invocation. The route is unchanged — `/api/mcp` — because the
    // `[transport]` segment still supplies the `mcp` part.
    verboseLogs: false,
  },
);

export { handler as GET, handler as POST };
