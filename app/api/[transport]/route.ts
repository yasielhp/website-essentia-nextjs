import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { createClient } from "@insforge/sdk";
import {
  bookableServices,
  manualTherapyTreatments,
} from "@/data/services-data";
import { TIME_SLOTS } from "@/constants/booking";

// ─── Helpers ──────────────────────────────────────────────────

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://www.essentiawellnessclub.com";

function getAdminClient() {
  return createClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
    anonKey: process.env.INSFORGE_SERVICE_KEY!,
  });
}

type BusyInterval = { start: string; end: string };

function computeAvailableSlots(
  dateStr: string,
  durationMinutes: number,
  busyIntervals: BusyInterval[],
): string[] {
  return TIME_SLOTS.filter((slot) => {
    const slotStart = new Date(`${dateStr}T${slot}:00`);
    const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60_000);
    return !busyIntervals.some((b) => {
      const bStart = new Date(b.start);
      const bEnd = new Date(b.end);
      return slotStart < bEnd && slotEnd > bStart;
    });
  });
}

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
        inputSchema: {},
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

        return { content: [{ type: "text", text }] };
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
                  type: "text",
                  text: `Could not fetch availability for ${service_id} on ${date}. Please call +34 683 240 986 or email info@essentiawellnessclub.com.`,
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
          const available = computeAvailableSlots(date, duration, busy ?? []);

          if (available.length === 0) {
            return {
              content: [
                {
                  type: "text",
                  text: `No available slots for ${service_id} on ${date}. Please try a different date or contact us.`,
                },
              ],
            };
          }

          return {
            content: [
              {
                type: "text",
                text: `Available slots for ${service_id} on ${date} (${duration} min):\n\n${available.join(", ")}`,
              },
            ],
          };
        } catch {
          return {
            content: [
              {
                type: "text",
                text: "Unable to check availability. Please contact us at +34 683 240 986 or info@essentiawellnessclub.com.",
              },
            ],
          };
        }
      },
    );

    // ── Tool 3: create_booking ─────────────────────────────────
    server.registerTool(
      "create_booking",
      {
        title: "Create Booking",
        description:
          "Submit a booking request at Essentia Wellness Club. Returns a confirmation with a reference number. Our team confirms within 24 h.",
        inputSchema: {
          service_id: z
            .string()
            .describe(
              "Service ID (e.g. 'contrast-therapy'). Use list_services to see all options.",
            ),
          service_title: z.string().describe("Human-readable service name"),
          tier_id: z
            .string()
            .optional()
            .describe(
              "Treatment ID for manual therapies (e.g. 'espira', 'soma', 'pulse')",
            ),
          duration: z
            .string()
            .describe("Session duration (e.g. '60 min', '45 min')"),
          date: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional()
            .describe("Preferred date in YYYY-MM-DD format"),
          time: z
            .string()
            .regex(/^\d{2}:\d{2}$/)
            .optional()
            .describe(
              "Preferred time in HH:MM format (use get_availability first)",
            ),
          first_name: z.string().min(1).describe("Customer first name"),
          last_name: z.string().min(1).describe("Customer last name"),
          email: z.string().email().describe("Customer email address"),
          phone: z
            .string()
            .min(5)
            .describe(
              "Customer phone number (include country code, e.g. +34...)",
            ),
          therapist_gender: z
            .enum(["male", "female"])
            .optional()
            .describe("Preferred therapist gender — only for manual therapies"),
          notes: z
            .string()
            .optional()
            .describe("Special requests or notes for the therapist"),
        },
      },
      async ({
        service_id,
        service_title,
        tier_id,
        duration,
        date,
        time,
        first_name,
        last_name,
        email,
        phone,
        therapist_gender,
        notes,
      }) => {
        try {
          const adminClient = getAdminClient();

          // 1. Upsert contact
          const { data: contactUuid } = await adminClient.database.rpc(
            "upsert_contact",
            {
              p_email: email,
              p_first_name: first_name,
              p_last_name: last_name,
              p_phone: phone,
              p_language: "en",
            },
          );

          // 2. Create draft booking
          const { data: bookingId } = await adminClient.database.rpc(
            "create_draft_booking",
            {
              p_contact_id: (contactUuid as string) ?? null,
              p_user_id: null,
              p_service_id: service_id,
              p_service_title: service_title,
              p_duration: duration,
              p_first_name: first_name,
              p_last_name: last_name,
              p_email: email,
              p_phone: phone,
            },
          );

          if (!bookingId) {
            return {
              content: [
                {
                  type: "text",
                  text: "Unable to create your booking. Please contact us at +34 683 240 986 or info@essentiawellnessclub.com.",
                },
              ],
            };
          }

          const id = bookingId as string;

          // 3. Compose notes (therapist preference + user notes)
          const therapistNote =
            therapist_gender === "male"
              ? "Terapeuta: Masculino"
              : therapist_gender === "female"
                ? "Terapeuta: Femenina"
                : null;
          const composedNotes =
            [therapistNote, notes?.trim() || null]
              .filter(Boolean)
              .join("\n\n") || null;

          // 4. Resolve tier price from DB
          let tierPrice: number | null = null;
          let resolvedTierId: string | null = tier_id ?? null;

          if (tier_id) {
            const { data: tierRow } = await adminClient.database
              .from("service_tiers")
              .select("id, price_eur")
              .eq("service_id", service_id)
              .ilike("label", `%${tier_id}%`)
              .maybeSingle();

            if (tierRow) {
              const t = tierRow as { id: string; price_eur: number | null };
              resolvedTierId = t.id;
              tierPrice = t.price_eur;
            }
          }

          // 5. Update booking with meta + confirm
          await adminClient.database
            .from("bookings")
            .update({
              status: "pending",
              tier_id: resolvedTierId,
              price_eur: tierPrice,
              duration,
              location: "centro",
              created_by_role: "anonymous",
              ...(composedNotes ? { notes: composedNotes } : {}),
              ...(date ? { date } : {}),
              ...(time ? { time } : {}),
            })
            .eq("id", id);

          // 6. Build response
          const dateInfo =
            date && time
              ? `\n- **Date & time:** ${date} at ${time}`
              : date
                ? `\n- **Preferred date:** ${date} (time to be confirmed by our team)`
                : "\n- **Date:** To be confirmed — our team will contact you";

          const priceInfo = tierPrice ? `\n- **Price:** €${tierPrice}` : "";

          const text = [
            `✅ **Booking request received — Essentia Wellness Club**`,
            ``,
            `- **Service:** ${service_title}`,
            `- **Duration:** ${duration}`,
            dateInfo,
            priceInfo,
            `- **Name:** ${first_name} ${last_name}`,
            `- **Email:** ${email}`,
            `- **Booking reference:** ${id}`,
            ``,
            `Our team will confirm by email within 24 hours. For immediate assistance: **+34 683 240 986** · **info@essentiawellnessclub.com**`,
            ``,
            `Book more or manage your visit: ${siteUrl}/booking`,
          ]
            .filter((l) => l !== null)
            .join("\n");

          return { content: [{ type: "text", text }] };
        } catch (err) {
          console.error("[MCP create_booking]", err);
          return {
            content: [
              {
                type: "text",
                text: "An error occurred. Please contact us at +34 683 240 986 or info@essentiawellnessclub.com.",
              },
            ],
          };
        }
      },
    );
  },
  {},
  {
    basePath: "/api",
    maxDuration: 60,
  },
);

export { handler as GET, handler as POST };
