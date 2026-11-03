import { z } from "zod";
import { getAdminClient } from "@/lib/insforge-admin";
import { bonusBalance } from "@/lib/bonuses/balance";
import { effectivePayment } from "@/lib/payments/amounts";
import { json, defineTool, fail, type ToolServer } from "@/lib/mcp/tool";
import { pagingShape, rangeOf, searchTerm } from "@/lib/mcp/paging";

const db = () => getAdminClient().database;

/**
 * Contacts: find someone and see where they stand.
 *
 * Staff see who a person is and what they have booked; the money, the
 * memberships and the registrations are the administrator's. What this never
 * returns, to anyone: the answers of the consent (only whether it is signed and
 * when), and anything that identifies a token or another system user.
 */
export function registerContactTools(server: ToolServer): void {
  defineTool(
    server,
    "search_contacts",
    {
      title: "Search Contacts",
      description:
        "Find contacts by part of their name or email (leave q empty for the most recent). Returns id, name, email, phone, status (lead or client), language and when they were added.",
      inputSchema: {
        q: z.string().max(80).optional(),
        ...pagingShape,
      },
    },
    async ({ q, limit, offset }) => {
      let query = db()
        .from("contacts")
        .select(
          "id, first_name, last_name, email, phone, status, preferred_language, created_at",
        );
      const term = q ? searchTerm(q) : "";
      if (term) {
        query = query.or(
          `email.ilike.*${term}*,first_name.ilike.*${term}*,last_name.ilike.*${term}*`,
        );
      }
      const [from, to] = rangeOf(limit, offset);
      const { data, error } = await query
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) return fail("Could not search the contacts.");
      return json(data ?? []);
    },
  );

  defineTool(
    server,
    "get_contact",
    {
      title: "Get Contact",
      description:
        "One contact in full: details, recent bookings, bonuses with the sessions used and left, and whether the informed consent is signed (and when — never the answers). Administrators also get the payments on each booking, the price of each bonus, memberships and race and course registrations.",
      inputSchema: { id: z.string().uuid() },
    },
    async ({ id }, auth) => {
      const isAdmin = auth.role === "admin";

      const { data: contactData, error } = await db()
        .from("contacts")
        .select(
          "id, first_name, last_name, email, phone, status, preferred_language, gender, birthdate, newsletter_subscribed, created_at",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) return fail("Could not read the contact.");
      const contact = contactData as {
        email: string | null;
        [key: string]: unknown;
      } | null;
      if (!contact) return fail("No contact has that id.");

      // Bookings are linked by id, and older ones only by the email typed.
      const bookingColumns =
        "id, date, time, service_title, status, payment_status, payment_mode, price_eur, amount_paid_eur, service_tiers(label)";
      const [byId, byEmail, bonusRows, consentRow] = await Promise.all([
        db()
          .from("bookings")
          .select(bookingColumns)
          .eq("contact_id", id)
          .neq("status", "draft")
          .order("date", { ascending: false })
          .limit(10),
        contact.email
          ? db()
              .from("bookings")
              .select(bookingColumns)
              .ilike("email", contact.email)
              .neq("status", "draft")
              .order("date", { ascending: false })
              .limit(10)
          : Promise.resolve({ data: [] }),
        db()
          .from("contact_bonuses")
          .select(
            "id, tier_id, sessions_total, price_eur, purchased_at, expires_at, service_tiers(label)",
          )
          .eq("contact_id", id)
          .order("purchased_at", { ascending: false }),
        db()
          .from("contact_consents")
          .select("signed_at")
          .eq("contact_id", id)
          .maybeSingle(),
      ]);

      type B = {
        id: string;
        date: string | null;
        time: string | null;
        service_title: string | null;
        status: string | null;
        payment_status: string | null;
        payment_mode: string | null;
        price_eur: number | string | null;
        amount_paid_eur: number | string | null;
        service_tiers: { label: string | null } | null;
      };
      const merged = new Map<string, B>();
      for (const row of [
        ...((byId.data ?? []) as unknown as B[]),
        ...((byEmail.data ?? []) as unknown as B[]),
      ]) {
        merged.set(row.id, row);
      }
      const bookings = [...merged.values()]
        .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
        .slice(0, 10)
        .map((b) => ({
          id: b.id,
          date: b.date?.slice(0, 10) ?? null,
          time: b.time,
          service: b.service_title,
          session_type: b.service_tiers?.label ?? null,
          status: b.status,
          ...(isAdmin ? { payment: effectivePayment(b) } : {}),
        }));

      // Sessions used come from the bookings that drew on each bonus.
      const bonuses = (bonusRows.data ?? []) as unknown as {
        id: string;
        tier_id: string;
        sessions_total: number;
        price_eur: number | string;
        purchased_at: string;
        expires_at: string;
        service_tiers: { label: string | null } | null;
      }[];
      const uses = bonuses.length
        ? (
            ((
              await db()
                .from("bookings")
                .select("bonus_id, status")
                .in(
                  "bonus_id",
                  bonuses.map((b) => b.id),
                )
            ).data ?? []) as { bonus_id: string; status: string | null }[]
          ).map((u) => ({ bonusId: u.bonus_id, status: u.status ?? "" }))
        : [];

      const result: Record<string, unknown> = {
        contact,
        bookings,
        bonuses: bonuses.map((b) => {
          const { used, remaining } = bonusBalance(
            {
              id: b.id,
              tierId: b.tier_id,
              sessionsTotal: b.sessions_total,
              expiresAt: b.expires_at,
            },
            uses,
          );
          return {
            session_type: b.service_tiers?.label ?? null,
            sessions_total: b.sessions_total,
            sessions_used: used,
            sessions_left: remaining,
            purchased_at: b.purchased_at,
            expires_at: b.expires_at,
            ...(isAdmin ? { price_eur: Number(b.price_eur) } : {}),
          };
        }),
        // Only whether it is signed, and when. The answers are health data.
        consent: {
          signed:
            ((consentRow.data as { signed_at: string | null } | null)
              ?.signed_at ?? null) !== null,
          signed_at:
            (consentRow.data as { signed_at: string | null } | null)
              ?.signed_at ?? null,
        },
      };

      if (isAdmin) {
        const [memberships, races, courses] = await Promise.all([
          // Memberships carry the person's email, not a contact id.
          contact.email
            ? db()
                .from("memberships")
                .select("plan, status, start_date, end_date")
                .ilike("email", contact.email)
                .order("created_at", { ascending: false })
            : Promise.resolve({ data: [] }),
          db()
            .from("race_registrations")
            .select("created_at, races(title, date)")
            .eq("contact_id", id)
            .order("created_at", { ascending: false })
            .limit(20),
          db()
            .from("education_registrations")
            .select("created_at, education_sessions(title, date)")
            .eq("contact_id", id)
            .order("created_at", { ascending: false })
            .limit(20),
        ]);
        result.memberships = memberships.data ?? [];
        result.race_registrations = races.data ?? [];
        result.education_registrations = courses.data ?? [];
      }

      return json(result);
    },
  );
}
