import { z } from "zod";
import { bookableServices } from "@/data/services-data";
import { getAvailableStartTimes } from "@/utils/calendar-helpers";
import { json, defineTool, text, type ToolServer } from "@/lib/mcp/tool";
import { getAdminClient } from "@/lib/insforge-admin";
import { catalogueText, serviceCatalogue } from "@/lib/treatments/catalogue";
import {
  listHiddenTreatments,
  listPublicTierPrices,
} from "@/lib/treatments/public-prices";

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://www.essentiawellnessclub.com";

type BusyInterval = { start: string; end: string };

/** What the centre offers and when it is free: the services, the session types, the people. */
export function registerServiceTools(server: ToolServer): void {
  defineTool(
    server,
    "list_services",
    {
      title: "List Services",
      description:
        "List all available services and treatments at Essentia Wellness Club, including prices, durations, and descriptions.",
    },
    async () => {
      // The prices are the session types', read from the database like the
      // public site's cards: the code no longer keeps any. A treatment with no
      // session type on sale is listed without a price, and so is every one of
      // them if the read fails. One whose session type is switched off is not
      // listed while it is off (the site has no page for it), and nothing is
      // left out when the read fails.
      const [prices, hidden] = await Promise.all([
        listPublicTierPrices("manual-therapies"),
        listHiddenTreatments("manual-therapies"),
      ]);
      return text(catalogueText(serviceCatalogue(prices, "en", hidden)));
    },
  );

  defineTool(
    server,
    "get_availability",
    {
      title: "Get Availability",
      description:
        "Check available time slots for a specific service on a given date, from the service's Google Calendar. Returns HH:MM time slots. To book, use list_session_types and create_booking.",
      inputSchema: {
        service_id: z
          .string()
          .max(80)
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
          .max(600)
          .optional()
          .describe(
            "Session duration in minutes — required for services with variable durations",
          ),
      },
    },
    async ({ service_id, date, duration_minutes }) => {
      try {
        const res = await fetch(
          `${siteUrl}/api/google/calendar/freebusy?service_id=${encodeURIComponent(service_id)}&date=${date}`,
        );

        if (!res.ok) {
          return text(
            `Could not fetch availability for ${service_id} on ${date}. Please call +34 634 09 12 95 or email info@essentiawellnessclub.com.`,
          );
        }

        const { busy } = (await res.json()) as { busy: BusyInterval[] };

        const service = bookableServices.find((s) => s.id === service_id);
        const fallbackDuration = service
          ? parseInt(service.durations[0], 10) || 60
          : 60;
        const duration = duration_minutes ?? fallbackDuration;
        const available = getAvailableStartTimes(date, duration, busy ?? []);

        if (available.length === 0) {
          return text(
            `No available slots for ${service_id} on ${date}. Please try a different date or contact us.`,
          );
        }
        return text(
          `Available slots for ${service_id} on ${date} (${duration} min):\n\n${available.join(", ")}`,
        );
      } catch {
        return text(
          "Unable to check availability. Please contact us at +34 634 09 12 95 or info@essentiawellnessclub.com.",
        );
      }
    },
  );

  defineTool(
    server,
    "list_session_types",
    {
      title: "List Session Types",
      description:
        "List the active session types (the bookable treatments) with the id create_booking needs: service, label, duration in minutes, prices in euros and calendar colour.",
    },
    async () => {
      const { data, error } = await getAdminClient()
        .database.from("service_tiers")
        .select(
          "id, service_id, label, duration_minutes, price_eur, price_center_eur, price_suite_eur, color",
        )
        .eq("active", true)
        .order("service_id")
        .order("sort_order");
      if (error) return text("Could not read the session types.", true);
      return json(
        ((data ?? []) as Record<string, unknown>[]).map((t) => ({
          id: t.id,
          service_id: t.service_id,
          label: t.label,
          duration_minutes: t.duration_minutes,
          price_web_eur: t.price_eur,
          price_centre_eur: t.price_center_eur,
          price_suite_eur: t.price_suite_eur,
          color: t.color,
        })),
      );
    },
  );

  defineTool(
    server,
    "list_staff",
    {
      title: "List Staff",
      description:
        "List the professionals (id and name) who perform treatments. Pass tier_id to list only those assigned to that session type, which is who create_booking accepts.",
      inputSchema: {
        tier_id: z.string().uuid().optional(),
      },
    },
    async ({ tier_id }) => {
      const db = getAdminClient().database;
      let ids: string[] | null = null;
      if (tier_id) {
        const { data } = await db
          .from("staff_tiers")
          .select("staff_id")
          .eq("tier_id", tier_id);
        ids = ((data ?? []) as { staff_id: string }[]).map((r) => r.staff_id);
        if (ids.length === 0) return json([]);
      }
      let query = db
        .from("profiles")
        .select("id, full_name, first_name, job_title")
        .eq("role", "staff");
      if (ids) query = query.in("id", ids);
      const { data, error } = await query.order("full_name");
      if (error) return text("Could not read the staff.", true);
      return json(
        ((data ?? []) as Record<string, unknown>[]).map((p) => ({
          id: p.id,
          name: p.full_name ?? p.first_name,
          job_title: p.job_title,
        })),
      );
    },
  );
}
