import { getAdminClient } from "@/lib/insforge-admin";
import { bookingMoney, ledgerTotals } from "@/lib/payments/ledger";
import { json, defineTool, fail, type ToolServer } from "@/lib/mcp/tool";
import { dayShape, pagingShape } from "@/lib/mcp/paging";

const db = () => getAdminClient().database;

/** The most rows of each kind read for one report, so a wide range stays quick. */
const SCAN_LIMIT = 2000;

type Row = {
  type: "booking" | "bonus" | "membership";
  id: string;
  title: string;
  client: string;
  date: string | null;
  created_at: string | null;
  amount_eur: number | null;
  list_price_eur: number | null;
  owed_eur: number;
  status: string | null;
};

/** The money: what came in, what is owed, and every line behind it. */
export function registerFinanceTools(server: ToolServer): void {
  defineTool(
    server,
    "list_transactions",
    {
      title: "List Transactions",
      description:
        "The ledger for a date range (by the day each line was created or bought; default the last 30 days): bookings with the money actually received, bonus sales and memberships, newest first, with totals — income received and money still owed. Uses the same reading of old and new bookings as the dashboard's Transactions screen. Scans at most 2000 lines of each kind.",
      inputSchema: {
        from: dayShape.optional(),
        to: dayShape.optional(),
        ...pagingShape,
      },
    },
    async ({ from, to, limit, offset }) => {
      const today = new Date();
      const end = to ?? today.toISOString().slice(0, 10);
      const start =
        from ??
        new Date(today.getTime() - 30 * 86_400_000).toISOString().slice(0, 10);
      // Created-at is a timestamp: the end day is included up to its last second.
      const startTs = `${start}T00:00:00Z`;
      const endTs = `${end}T23:59:59.999Z`;

      const [bookings, bonuses, memberships] = await Promise.all([
        db()
          .from("bookings")
          .select(
            "id, service_title, first_name, last_name, date, status, payment_status, payment_mode, price_eur, amount_paid_eur, created_at",
          )
          .neq("status", "draft")
          .gte("created_at", startTs)
          .lte("created_at", endTs)
          .order("created_at", { ascending: false })
          .limit(SCAN_LIMIT),
        db()
          .from("contact_bonuses")
          .select(
            "id, sessions_total, price_eur, purchased_at, created_at, service_tiers(label), contacts(first_name, last_name)",
          )
          .gte("purchased_at", start)
          .lte("purchased_at", end)
          .order("created_at", { ascending: false })
          .limit(SCAN_LIMIT),
        db()
          .from("memberships")
          .select(
            "id, first_name, last_name, plan, status, start_date, created_at",
          )
          .gte("created_at", startTs)
          .lte("created_at", endTs)
          .order("created_at", { ascending: false })
          .limit(SCAN_LIMIT),
      ]);
      if (bookings.error || bonuses.error || memberships.error) {
        return fail("Could not read the ledger.");
      }

      const name = (first: string | null, last: string | null) =>
        [first, last].filter(Boolean).join(" ") || "—";
      const rows: Row[] = [];

      for (const b of (bookings.data ?? []) as unknown as {
        id: string;
        service_title: string | null;
        first_name: string | null;
        last_name: string | null;
        date: string | null;
        status: string | null;
        payment_status: string | null;
        payment_mode: string | null;
        price_eur: number | string | null;
        amount_paid_eur: number | string | null;
        created_at: string | null;
      }[]) {
        const money = bookingMoney(b);
        rows.push({
          type: "booking",
          id: b.id,
          title: b.service_title ?? "—",
          client: name(b.first_name, b.last_name),
          date: b.date?.slice(0, 10) ?? null,
          created_at: b.created_at,
          amount_eur: money.amount,
          list_price_eur: money.listAmount ?? null,
          // A cancelled booking is not owed anything, whatever its row says.
          owed_eur: b.status === "cancelled" ? 0 : (money.owed ?? 0),
          status: money.status,
        });
      }

      // A bonus is income the day it is sold; the sessions drawn from it carry
      // no amount of their own, so nothing is counted twice.
      for (const b of (bonuses.data ?? []) as unknown as {
        id: string;
        sessions_total: number;
        price_eur: number | string;
        purchased_at: string;
        created_at: string;
        service_tiers: { label: string | null } | null;
        contacts: {
          first_name: string | null;
          last_name: string | null;
        } | null;
      }[]) {
        rows.push({
          type: "bonus",
          id: b.id,
          title: `Bono de ${b.sessions_total} sesiones${b.service_tiers?.label ? ` · ${b.service_tiers.label}` : ""}`,
          client: name(
            b.contacts?.first_name ?? null,
            b.contacts?.last_name ?? null,
          ),
          date: b.purchased_at,
          created_at: b.created_at,
          amount_eur: Number(b.price_eur),
          list_price_eur: null,
          owed_eur: 0,
          status: "completed",
        });
      }

      for (const m of (memberships.data ?? []) as unknown as {
        id: string;
        first_name: string | null;
        last_name: string | null;
        plan: string | null;
        status: string | null;
        start_date: string | null;
        created_at: string | null;
      }[]) {
        rows.push({
          type: "membership",
          id: m.id,
          title: m.plan ?? "Membership",
          client: name(m.first_name, m.last_name),
          date: m.start_date,
          created_at: m.created_at,
          amount_eur: null,
          list_price_eur: null,
          owed_eur: 0,
          status: m.status,
        });
      }

      rows.sort((a, b) =>
        (b.created_at ?? "").localeCompare(a.created_at ?? ""),
      );
      const totals = ledgerTotals(
        rows.map((r) => ({
          status: r.status,
          amount: r.amount_eur,
          owed: r.owed_eur,
        })),
      );

      return json({
        range: { from: start, to: end },
        totals: {
          income_received_eur: totals.revenue,
          still_owed_eur: totals.owed,
          lines: totals.total,
          completed_lines: totals.completed,
        },
        lines: rows.slice(offset, offset + limit),
        has_more: rows.length > offset + limit,
      });
    },
  );
}
