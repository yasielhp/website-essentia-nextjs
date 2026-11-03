import { z } from "zod";
import { getAdminClient } from "@/lib/insforge-admin";
import { effectivePayment } from "@/lib/payments/amounts";
import { json, defineTool, fail, type ToolServer } from "@/lib/mcp/tool";
import { dayShape, pagingShape, rangeOf, searchTerm } from "@/lib/mcp/paging";
import {
  cancelBookingForStaff,
  createBookingForStaff,
} from "@/lib/bookings/for-staff";

const db = () => getAdminClient().database;

type BookingRow = {
  id: string;
  date: string | null;
  time: string | null;
  duration: string | null;
  service_title: string | null;
  staff_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  payment_status: string | null;
  payment_mode: string | null;
  price_eur: number | string | null;
  amount_paid_eur: number | string | null;
  location: string | null;
  created_at: string | null;
  service_tiers: { label: string | null } | null;
};

const LIST_COLUMNS =
  "id, date, time, duration, service_title, staff_id, first_name, last_name, email, phone, status, payment_status, payment_mode, price_eur, amount_paid_eur, location, created_at, service_tiers(label)";

/** Names of the professionals behind a page of bookings, in one query. */
async function staffNames(
  ids: (string | null)[],
): Promise<Map<string, string>> {
  const wanted = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  const names = new Map<string, string>();
  if (wanted.length === 0) return names;
  const { data } = await db()
    .from("profiles")
    .select("id, full_name, first_name")
    .in("id", wanted);
  for (const p of (data ?? []) as {
    id: string;
    full_name: string | null;
    first_name: string | null;
  }[]) {
    names.set(p.id, p.full_name ?? p.first_name ?? "");
  }
  return names;
}

function shape(row: BookingRow, staff: Map<string, string>) {
  const pay = effectivePayment(row);
  return {
    id: row.id,
    date: row.date?.slice(0, 10) ?? null,
    time: row.time,
    duration: row.duration,
    service: row.service_title,
    session_type: row.service_tiers?.label ?? null,
    professional: row.staff_id ? (staff.get(row.staff_id) ?? null) : null,
    client: {
      name: [row.first_name, row.last_name].filter(Boolean).join(" "),
      email: row.email,
      phone: row.phone,
    },
    status: row.status,
    location: row.location,
    price_eur: row.price_eur == null ? null : Number(row.price_eur),
    payment: {
      status: pay.status,
      mode: row.payment_mode,
      paid_eur: pay.paidEur,
      owed_eur: pay.owedEur,
    },
  };
}

/** Bookings: read them, take one for a client, cancel one. */
export function registerBookingTools(server: ToolServer): void {
  defineTool(
    server,
    "list_bookings",
    {
      title: "List Bookings",
      description:
        "List bookings, soonest first within the range. Filter by date range (from/to, YYYY-MM-DD), status, professional (staff_id from list_staff) and a client name or email. Payment is the effective one (what was paid and what is owed). Drafts are left out.",
      inputSchema: {
        from: dayShape.optional(),
        to: dayShape.optional(),
        status: z
          .enum(["pending", "confirmed", "cancelled", "completed", "all"])
          .default("all"),
        staff_id: z.string().uuid().optional(),
        q: z
          .string()
          .max(80)
          .optional()
          .describe("Part of the client's name or email."),
        ...pagingShape,
      },
    },
    async ({ from, to, status, staff_id, q, limit, offset }) => {
      let query = db()
        .from("bookings")
        .select(LIST_COLUMNS)
        .neq("status", "draft");
      if (from) query = query.gte("date", from);
      if (to) query = query.lte("date", to);
      if (status !== "all") query = query.eq("status", status);
      if (staff_id) query = query.eq("staff_id", staff_id);
      const term = q ? searchTerm(q) : "";
      if (term) {
        query = query.or(
          `first_name.ilike.*${term}*,last_name.ilike.*${term}*,email.ilike.*${term}*`,
        );
      }
      const [start, end] = rangeOf(limit, offset);
      const { data, error } = await query
        .order("date", { ascending: true })
        .order("time", { ascending: true })
        .range(start, end);
      if (error) return fail("Could not read the bookings.");

      const rows = (data ?? []) as unknown as BookingRow[];
      const staff = await staffNames(rows.map((r) => r.staff_id));
      return json(rows.map((r) => shape(r, staff)));
    },
  );

  defineTool(
    server,
    "get_booking",
    {
      title: "Get Booking",
      description:
        "One booking in full — client, session, place, notes, payment — with the latest entries of its history (who did what, and which messages went out).",
      inputSchema: { id: z.string().uuid() },
    },
    async ({ id }) => {
      const { data, error } = await db()
        .from("bookings")
        .select(
          `${LIST_COLUMNS}, notes, location_address, bonus_id, created_by_role, contact_id`,
        )
        .eq("id", id)
        .maybeSingle();
      if (error) return fail("Could not read the booking.");
      const row = data as unknown as
        | (BookingRow & {
            notes: string | null;
            location_address: string | null;
            bonus_id: string | null;
            created_by_role: string | null;
            contact_id: string | null;
          })
        | null;
      if (!row) return fail("No booking has that id.");

      const [staff, events] = await Promise.all([
        staffNames([row.staff_id]),
        db()
          .from("booking_events")
          .select("created_at, channel, event, status, summary, actor_role")
          .eq("booking_id", id)
          .order("created_at", { ascending: false })
          .limit(30),
      ]);

      return json({
        ...shape(row, staff),
        notes: row.notes,
        location_address: row.location_address,
        contact_id: row.contact_id,
        paid_with_bonus: row.bonus_id !== null,
        created_by_role: row.created_by_role,
        created_at: row.created_at,
        // A WhatsApp message is long; the start says what it was.
        history: (
          (events.data ?? []) as unknown as { summary: string | null }[]
        ).map((e) => ({
          ...e,
          summary:
            e.summary && e.summary.length > 160
              ? `${e.summary.slice(0, 157)}…`
              : e.summary,
        })),
      });
    },
  );

  defineTool(
    server,
    "create_booking",
    {
      title: "Create Booking",
      description:
        "Take a booking for a client, as the dashboard does: it is created confirmed and unpaid, the client gets the confirmation email, the professional a WhatsApp, and it goes on the calendars. tier_id is a session type from list_session_types and staff_id a professional assigned to it (list_staff with tier_id); the hour must be free (get_availability / the professional's free hours). Pass dry_run=true to check everything and see what would be created without writing anything or sending anything.",
      inputSchema: {
        tier_id: z.string().uuid(),
        staff_id: z.string().uuid(),
        date: dayShape,
        time: z
          .string()
          .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
          .describe("HH:MM, 24 hours."),
        location: z.enum(["centro", "habitacion", "domicilio"]),
        location_address: z
          .string()
          .trim()
          .max(300)
          .optional()
          .describe(
            "Room number for habitacion, the street address for domicilio.",
          ),
        notes: z.string().trim().max(1000).optional(),
        client: z.object({
          first_name: z.string().trim().min(1).max(80),
          last_name: z.string().trim().min(1).max(80),
          email: z.string().email().max(160),
          phone: z.string().trim().min(6).max(30).optional(),
          language: z.enum(["en", "es"]).default("es"),
        }),
        dry_run: z.boolean().default(false),
      },
    },
    async (input, auth) => {
      const result = await createBookingForStaff(
        {
          tierId: input.tier_id,
          staffId: input.staff_id,
          date: input.date,
          time: input.time,
          location: input.location,
          locationAddress: input.location_address,
          notes: input.notes,
          client: {
            firstName: input.client.first_name,
            lastName: input.client.last_name,
            email: input.client.email.toLowerCase(),
            phone: input.client.phone,
            language: input.client.language,
          },
          dryRun: input.dry_run,
        },
        { userId: auth.userId, role: auth.role },
      );
      if (!result.ok) return fail(result.error);
      return json({
        dry_run: result.dryRun,
        id: result.bookingId,
        booking: result.summary,
        ...(result.dryRun
          ? { note: "Nothing was written and nobody was notified." }
          : { notified: result.notified }),
      });
    },
  );

  defineTool(
    server,
    "cancel_booking",
    {
      title: "Cancel Booking",
      description:
        "Cancel a booking as the dashboard does: the history, the client's email, the professional's WhatsApp and the calendars. It does NOT return any money: paid_eur in the answer is what someone has to settle by hand.",
      inputSchema: {
        id: z.string().uuid(),
        reason: z.string().trim().max(300).optional(),
      },
    },
    async ({ id, reason }, auth) => {
      const result = await cancelBookingForStaff(id, reason, {
        userId: auth.userId,
        role: auth.role,
      });
      if (!result.ok) {
        return fail(
          result.error === "not_found"
            ? "No booking has that id."
            : result.error === "already_cancelled"
              ? "That booking is already cancelled."
              : "The booking could not be cancelled.",
        );
      }
      return json({
        cancelled: true,
        id: result.bookingId,
        paid_eur: result.paid_eur,
        refund: "none — settle any payment by hand",
        notified: result.notified,
      });
    },
  );
}
