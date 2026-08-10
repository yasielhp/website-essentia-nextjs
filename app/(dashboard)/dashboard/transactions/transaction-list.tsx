"use client";

import { useTranslations } from "next-intl";
import type { TxType, UnifiedRow } from "./types";

const TYPE_BADGE: Record<TxType, { cls: string }> = {
  booking: { cls: "bg-blue-100 text-blue-700" },
  membership: { cls: "bg-purple-50 text-purple-700" },
  race: { cls: "bg-green-50 text-green-700" },
  education: { cls: "bg-yellow-50 text-yellow-700" },
};

const SOURCE_BADGE: Record<string, { cls: string }> = {
  admin: { cls: "bg-petroleum-100 text-petroleum-700" },
  staff: { cls: "bg-blue-100 text-blue-700" },
  partner: { cls: "bg-yellow-100 text-yellow-700" },
  client: { cls: "bg-green-50 text-green-700" },
  anonymous: { cls: "bg-sand-100 text-petroleum-500" },
};

const STATUS_CLS: Record<string, string> = {
  completed: "bg-green-50 text-green-700",
  paid: "bg-green-50 text-green-700",
  confirmed: "bg-green-50 text-green-700",
  active: "bg-green-50 text-green-700",
  pending: "bg-yellow-50 text-yellow-700",
  failed: "bg-red-50 text-red-600",
  cancelled: "bg-red-50 text-red-600",
  expired: "bg-red-50 text-red-600",
  refunded: "bg-yellow-50 text-yellow-700",
};

function StatusBadge({ status }: { status: string | null }) {
  const t = useTranslations("dashboard.transactions");
  const s = status ?? "unknown";
  const cls = STATUS_CLS[s] ?? "bg-sand-100 text-petroleum-500";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${cls}`}
    >
      {t.has(`status.${s}`) ? t(`status.${s}`) : s}
    </span>
  );
}

function formatDate(value: string | null, locale: string): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(d);
}

function formatTime(value: string | null, locale: string): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function formatAmount(value: number | null, locale: string): string {
  if (value === null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

/**
 * One page of payments: cards on a phone, a table on a desk.
 *
 * Bookings, memberships, race entries and course places all end up in the same
 * `UnifiedRow`, and drawing them took two hundred and twenty-five lines inside
 * the page that gathers the four sources. The badges and the three formatters
 * belong with the drawing, so they moved too.
 */
export function TransactionList({
  rows,
  loading,
  locale,
}: {
  rows: UnifiedRow[];
  loading: boolean;
  locale: string;
}) {
  const t = useTranslations("dashboard");

  return (
    <>
      {/* ── Mobile cards ── */}
      <div className="sm:hidden">
        {loading ? (
          <div className="divide-sand-200 border-sand-200 divide-y overflow-hidden rounded-2xl border bg-white">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-2 px-4 py-4">
                <div className="flex items-center gap-2">
                  <div className="bg-sand-100 h-4 w-20 animate-pulse rounded-full" />
                  <div className="bg-sand-100 h-4 w-16 animate-pulse rounded-full" />
                </div>
                <div className="bg-sand-100 h-4 w-40 animate-pulse rounded" />
                <div className="bg-sand-100 h-3 w-28 animate-pulse rounded" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="text-petroleum-400 py-12 text-center text-sm">
            {t("transactions.empty")}
          </p>
        ) : (
          <div className="divide-sand-200 border-sand-200 divide-y overflow-hidden rounded-2xl border bg-white">
            {rows.map((row) => {
              const tb = TYPE_BADGE[row.type];
              return (
                <div key={row.id} className="px-4 py-4">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tb.cls}`}
                    >
                      {t(`transactions.types.${row.type}`)}
                    </span>
                    <StatusBadge status={row.status} />
                  </div>
                  <p className="text-petroleum-700 mt-1.5 leading-snug font-medium">
                    {row.title}
                  </p>
                  {row.subtitle && (
                    <p className="text-petroleum-400 mt-0.5 text-xs">
                      {row.subtitle}
                    </p>
                  )}
                  <p className="text-petroleum-500 mt-0.5 text-sm">
                    {row.client}
                  </p>
                  {row.clientEmail && (
                    <p className="text-petroleum-400 text-xs">
                      {row.clientEmail}
                    </p>
                  )}
                  {row.reservedBy &&
                    (() => {
                      const src =
                        SOURCE_BADGE[row.reservedBy] ??
                        SOURCE_BADGE["anonymous"];
                      return (
                        <span
                          className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${src.cls}`}
                        >
                          {t(`transactions.sources.${row.reservedBy}`)}
                        </span>
                      );
                    })()}
                  <div className="mt-1.5 flex items-center gap-3">
                    {row.created_at && (
                      <span className="text-petroleum-300 text-xs">
                        {formatDate(row.created_at, locale)}
                        {formatTime(row.created_at, locale)
                          ? ` · ${formatTime(row.created_at, locale)}`
                          : ""}
                      </span>
                    )}
                    {row.amount !== null && (
                      <span className="text-petroleum-700 text-xs font-medium">
                        {formatAmount(row.amount, locale)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Desktop table ── */}
      <div className="hidden sm:block">
        <div className="border-sand-200 rounded-2xl border bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-sand-200 border-b text-left">
                  <th className="text-petroleum-400 px-5 py-3.5 text-xs font-medium">
                    {t("transactions.columns.created")}
                  </th>
                  <th className="text-petroleum-400 px-5 py-3.5 text-xs font-medium">
                    {t("transactions.columns.status")}
                  </th>
                  <th className="text-petroleum-400 px-5 py-3.5 text-xs font-medium">
                    {t("transactions.columns.service")}
                  </th>
                  <th className="text-petroleum-400 px-5 py-3.5 text-xs font-medium">
                    {t("transactions.columns.client")}
                  </th>
                  <th className="text-petroleum-400 px-5 py-3.5 text-xs font-medium">
                    {t("transactions.columns.reservedBy")}
                  </th>
                  <th className="text-petroleum-400 px-5 py-3.5 text-right text-xs font-medium">
                    {t("transactions.columns.amount")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-sand-50 border-b">
                      {/* Created */}
                      <td className="px-5 py-4">
                        <div className="bg-sand-100 h-4 w-20 animate-pulse rounded" />
                        <div className="bg-sand-100 mt-1.5 h-3 w-12 animate-pulse rounded" />
                      </td>
                      {/* Status */}
                      <td className="px-5 py-4">
                        <div className="bg-sand-100 h-5 w-20 animate-pulse rounded-full" />
                      </td>
                      {/* Service */}
                      <td className="px-5 py-4">
                        <div className="bg-sand-100 h-4 w-40 animate-pulse rounded" />
                        <div className="bg-sand-100 mt-1.5 h-3 w-24 animate-pulse rounded" />
                      </td>
                      {/* Client */}
                      <td className="px-5 py-4">
                        <div className="bg-sand-100 h-4 w-32 animate-pulse rounded" />
                        <div className="bg-sand-100 mt-1.5 h-3 w-40 animate-pulse rounded" />
                      </td>
                      {/* Reserved by */}
                      <td className="px-5 py-4">
                        <div className="bg-sand-100 h-5 w-16 animate-pulse rounded-full" />
                      </td>
                      {/* Amount (right-aligned) */}
                      <td className="px-5 py-4 text-right">
                        <div className="bg-sand-100 ml-auto h-4 w-16 animate-pulse rounded" />
                      </td>
                    </tr>
                  ))
                ) : rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="text-petroleum-400 px-6 py-12 text-center"
                    >
                      {t("transactions.empty")}
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const tb = TYPE_BADGE[row.type];
                    return (
                      <tr
                        key={row.id}
                        className="border-sand-50 hover:bg-sand-50 border-b transition-colors"
                      >
                        <td className="px-5 py-4">
                          <p className="text-petroleum-500">
                            {formatDate(row.created_at, locale)}
                          </p>
                          <p className="text-petroleum-400 text-xs">
                            {formatTime(row.created_at, locale)}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge status={row.status} />
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-petroleum-700 leading-snug font-medium">
                            {row.title}
                          </p>
                          <div className="mt-1 flex items-center gap-1.5">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tb.cls}`}
                            >
                              {t(`transactions.types.${row.type}`)}
                            </span>
                            {row.subtitle && (
                              <span className="text-petroleum-400 text-xs">
                                · {row.subtitle}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-petroleum-500">{row.client}</p>
                          {row.clientEmail && (
                            <p className="text-petroleum-400 mt-0.5 text-xs">
                              {row.clientEmail}
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          {(() => {
                            const src =
                              SOURCE_BADGE[row.reservedBy ?? "anonymous"] ??
                              SOURCE_BADGE["anonymous"];
                            return row.reservedBy !== null ? (
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${src.cls}`}
                              >
                                {t(`transactions.sources.${row.reservedBy}`)}
                              </span>
                            ) : (
                              <span className="text-petroleum-300">—</span>
                            );
                          })()}
                        </td>
                        <td className="text-petroleum-700 px-5 py-4 text-right font-medium">
                          {formatAmount(row.amount, locale)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
