import { z } from "zod";
import { getAdminClient } from "@/lib/insforge-admin";
import { json, defineTool, fail, type ToolServer } from "@/lib/mcp/tool";
import { pagingShape, rangeOf } from "@/lib/mcp/paging";
import { shapeCampaign, shapeCampaignListing } from "@/lib/mcp/campaign-shape";

const db = () => getAdminClient().database;

const fullName = (first: string | null, last: string | null) =>
  [first, last].filter(Boolean).join(" ") || null;

/**
 * Memberships, campaigns, races and courses: what the administrator looks at to
 * run the rest of the centre. Read only.
 */
export function registerBusinessTools(server: ToolServer): void {
  // ── Memberships ─────────────────────────────────────────────
  defineTool(
    server,
    "list_membership_plans",
    {
      title: "List Membership Plans",
      description:
        "The membership plans: label, monthly and annual price in euros, whether it is active, and its features.",
    },
    async () => {
      const { data, error } = await db()
        .from("membership_plans")
        .select("id, label, price_monthly, price_annual, features, active")
        .order("price_monthly");
      if (error) return fail("Could not read the plans.");
      return json(data ?? []);
    },
  );

  defineTool(
    server,
    "list_memberships",
    {
      title: "List Memberships",
      description:
        "List memberships: plan, status, member (name, email, phone) and start and end dates, newest first. Filter by status and plan.",
      inputSchema: {
        status: z.string().max(40).optional(),
        plan: z.string().max(80).optional(),
        ...pagingShape,
      },
    },
    async ({ status, plan, limit, offset }) => {
      let query = db()
        .from("memberships")
        .select(
          "id, first_name, last_name, email, phone, plan, status, start_date, end_date, created_at",
        );
      if (status) query = query.eq("status", status);
      if (plan) query = query.eq("plan", plan);
      const [from, to] = rangeOf(limit, offset);
      const { data, error } = await query
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) return fail("Could not read the memberships.");
      return json(data ?? []);
    },
  );

  // ── Campaigns ───────────────────────────────────────────────
  defineTool(
    server,
    "list_campaigns",
    {
      title: "List Campaigns",
      description:
        "List campaigns, newest first: name, channel (email or whatsapp), kind, status, schedule and the counters (recipients, delivered, opened, clicked, bounced). For a WhatsApp campaign the opened counter is reported as read_count and there are no clicks. Use get_campaign for one in detail. Campaigns are read only here: WhatsApp campaigns are created, sent and activated from the dashboard.",
      inputSchema: {
        status: z.string().max(40).optional(),
        ...pagingShape,
      },
    },
    async ({ status, limit, offset }) => {
      let query = db()
        .from("campaigns")
        .select(
          "id, name, channel, kind, status, scheduled_at, sent_at, recipients_count, delivered_count, opened_count, clicked_count, bounced_count",
        );
      if (status) query = query.eq("status", status);
      const [from, to] = rangeOf(limit, offset);
      const { data, error } = await query
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) return fail("Could not read the campaigns.");
      return json(shapeCampaignListing(data ?? []));
    },
  );

  defineTool(
    server,
    "get_campaign",
    {
      title: "Get Campaign",
      description:
        "One campaign: channel (email or whatsapp), kind, status, schedule, trigger, audience filter and the full statistics with rates. An email has a summary of its content (the subject, preheader and title per language and how long the body is, not the body); a WhatsApp campaign has, for each language it is written in (es, en), its template id and where each parameter comes from (a field of the contact or the booking, or a fixed text whose value is never shown), or null for a language with no template yet.",
      inputSchema: { id: z.string().uuid() },
    },
    async ({ id }) => {
      const { data, error } = await db()
        .from("campaigns")
        .select(
          "id, name, channel, kind, status, scheduled_at, sent_at, activated_at, last_run_at, trigger, audience, content, recipients_count, delivered_count, opened_count, clicked_count, bounced_count, complained_count, failed_count, last_error",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) return fail("Could not read the campaign.");
      if (!data) return fail("No campaign has that id.");
      return json(shapeCampaign(data as Record<string, unknown>));
    },
  );

  // ── Races and courses ───────────────────────────────────────
  defineTool(
    server,
    "list_races",
    {
      title: "List Races",
      description:
        "List races: title (both languages), date, time, place, distance, capacity and how many are registered. Newest date first.",
      inputSchema: { ...pagingShape },
    },
    async ({ limit, offset }) => {
      const [from, to] = rangeOf(limit, offset);
      const { data, error } = await db()
        .from("races")
        .select(
          "id, title, title_es, date, time, location, distance_km, max_participants, access, race_registrations(count)",
        )
        .order("date", { ascending: false })
        .range(from, to);
      if (error) return fail("Could not read the races.");
      return json(
        ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => {
          const { race_registrations, ...rest } = r;
          return {
            ...rest,
            registered:
              (race_registrations as { count: number }[] | null)?.[0]?.count ??
              0,
          };
        }),
      );
    },
  );

  defineTool(
    server,
    "list_race_registrations",
    {
      title: "List Race Registrations",
      description:
        "Who is registered for a race (race_id from list_races): name, email, phone, table number and whether they checked in.",
      inputSchema: { race_id: z.string().uuid(), ...pagingShape },
    },
    async ({ race_id, limit, offset }) => {
      const [from, to] = rangeOf(limit, offset);
      const { data, error } = await db()
        .from("race_registrations")
        .select(
          "id, created_at, table_number, checked_in_at, contacts(first_name, last_name, email, phone)",
        )
        .eq("race_id", race_id)
        .order("created_at")
        .range(from, to);
      if (error) return fail("Could not read the registrations.");
      return json(
        (
          (data ?? []) as unknown as {
            id: string;
            created_at: string;
            table_number: number | null;
            checked_in_at: string | null;
            contacts: {
              first_name: string | null;
              last_name: string | null;
              email: string | null;
              phone: string | null;
            } | null;
          }[]
        ).map((r) => ({
          id: r.id,
          registered_at: r.created_at,
          name: fullName(
            r.contacts?.first_name ?? null,
            r.contacts?.last_name ?? null,
          ),
          email: r.contacts?.email ?? null,
          phone: r.contacts?.phone ?? null,
          table_number: r.table_number,
          checked_in_at: r.checked_in_at,
        })),
      );
    },
  );

  defineTool(
    server,
    "list_education_sessions",
    {
      title: "List Education Sessions",
      description:
        "List courses and talks: title (both languages), date, duration, place, speaker, price in euros, capacity and how many are enrolled. Newest date first.",
      inputSchema: { ...pagingShape },
    },
    async ({ limit, offset }) => {
      const [from, to] = rangeOf(limit, offset);
      const { data, error } = await db()
        .from("education_sessions")
        .select(
          "id, title, title_es, date, duration_minutes, location, speaker, price_cents, max_participants, access, education_registrations(count)",
        )
        .order("date", { ascending: false })
        .range(from, to);
      if (error) return fail("Could not read the sessions.");
      return json(
        ((data ?? []) as unknown as Record<string, unknown>[]).map((s) => {
          const { education_registrations, price_cents, ...rest } = s;
          return {
            ...rest,
            price_eur:
              typeof price_cents === "number" ? price_cents / 100 : null,
            enrolled:
              (education_registrations as { count: number }[] | null)?.[0]
                ?.count ?? 0,
          };
        }),
      );
    },
  );

  defineTool(
    server,
    "list_education_enrollees",
    {
      title: "List Education Enrollees",
      description:
        "Who is enrolled in a course or talk (session_id from list_education_sessions): name, email, phone and when they enrolled.",
      inputSchema: { session_id: z.string().uuid(), ...pagingShape },
    },
    async ({ session_id, limit, offset }) => {
      const [from, to] = rangeOf(limit, offset);
      const { data, error } = await db()
        .from("education_registrations")
        .select("id, created_at, contacts(first_name, last_name, email, phone)")
        .eq("session_id", session_id)
        .order("created_at")
        .range(from, to);
      if (error) return fail("Could not read the enrollees.");
      return json(
        (
          (data ?? []) as unknown as {
            id: string;
            created_at: string;
            contacts: {
              first_name: string | null;
              last_name: string | null;
              email: string | null;
              phone: string | null;
            } | null;
          }[]
        ).map((r) => ({
          id: r.id,
          enrolled_at: r.created_at,
          name: fullName(
            r.contacts?.first_name ?? null,
            r.contacts?.last_name ?? null,
          ),
          email: r.contacts?.email ?? null,
          phone: r.contacts?.phone ?? null,
        })),
      );
    },
  );
}
