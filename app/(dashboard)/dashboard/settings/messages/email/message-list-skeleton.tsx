"use client";

import { useTranslations } from "next-intl";
import { messageListRows } from "@/lib/messages/list-rows";

const PULSE = "bg-sand-100 animate-pulse";

/** The real rows, in their real order, before anything has been read: no jump when they arrive. */
const ROWS = messageListRows([], [], []);

/**
 * The list of messages while it loads, in the list's own shape: the same card,
 * the same header with its real labels, and one row per message and channel
 * in the same order, each with a switch, a name (and, for an email, its line
 * of help), a type and a content badge. On a phone, the same cards.
 */
export function MessageListSkeleton() {
  const t = useTranslations("dashboard.messages.email");
  return (
    <div
      aria-busy="true"
      className="border-sand-200 overflow-hidden rounded-2xl border bg-white"
    >
      <div className="hidden md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-sand-100 border-b text-left">
              {(["switch", "message", "type", "content"] as const).map(
                (column) => (
                  <th
                    key={column}
                    scope="col"
                    className="text-petroleum-400 px-5 py-3 text-xs font-medium whitespace-nowrap"
                  >
                    {t(`columns.${column}`)}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr
                key={row.id}
                className="border-sand-100 border-b align-top last:border-0"
              >
                <td className="px-5 py-1.5 md:py-2.5">
                  <div className={`${PULSE} mt-1.5 h-6 w-11 rounded-full`} />
                </td>
                <td className="px-5 py-3.5">
                  <div className={`${PULSE} h-4 w-44 rounded`} />
                  {row.type === "email" && (
                    <div className={`${PULSE} mt-1.5 h-3 w-72 rounded`} />
                  )}
                </td>
                <td className="px-5 py-3.5">
                  <div className={`${PULSE} h-5 w-20 rounded-full`} />
                </td>
                <td className="px-5 py-3.5">
                  <div
                    className={`${PULSE} h-5 rounded-full ${
                      row.type === "email" ? "w-24" : "w-48"
                    }`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-sand-100 divide-y md:hidden">
        {ROWS.map((row) => (
          <li key={row.id} className="flex flex-col gap-3 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className={`${PULSE} h-6 w-11 shrink-0 rounded-full`} />
              <div className={`${PULSE} h-4 w-40 rounded`} />
            </div>
            {row.type === "email" && (
              <div className={`${PULSE} h-3 w-full rounded`} />
            )}
            <div className="flex gap-5">
              <div className={`${PULSE} h-5 w-20 rounded-full`} />
              <div className={`${PULSE} h-5 w-24 rounded-full`} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
