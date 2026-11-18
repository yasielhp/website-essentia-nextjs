"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { MobileRowCard } from "@/components/dashboard/mobile-row-card";
import type { SegmentPerson } from "@/types/campaign";
import { formatMediumDate, type SupportedLocale } from "@/utils/format";
import { headerCheckState, personName } from "@/lib/campaigns/segment-people";

const TH =
  "text-petroleum-400 px-4 py-2.5 text-left text-xs font-medium whitespace-nowrap";

/** One reason a channel would not reach her, as a small mark under the datum. */
export function Issue({
  reason,
}: {
  reason: NonNullable<
    SegmentPerson["emailIssue"] | SegmentPerson["whatsappIssue"]
  >;
}) {
  const t = useTranslations("dashboard.campaigns.segments.issue");
  return (
    <span className="mt-1 inline-block rounded-full bg-yellow-100 px-2 py-0.5 text-[11px] font-medium text-yellow-800">
      {t(reason)}
    </span>
  );
}

/**
 * The people a segment can be made of, one per row, with a checkbox. A table on
 * a wide screen and labelled cards on a phone, from the same rows. The header
 * checkbox selects (or clears) EVERYONE the table lists, on every page, under
 * the filters and the search in force; the selection itself lives in the form,
 * so it survives filtering, searching and paging.
 */
export function SegmentPeopleTable({
  rows,
  listedIds,
  selected,
  locale,
  onToggle,
  onToggleListed,
}: {
  /** The people on this page. */
  rows: SegmentPerson[];
  /** Everyone the table lists, across its pages: what the header checkbox acts on. */
  listedIds: string[];
  selected: ReadonlySet<string>;
  locale: SupportedLocale;
  onToggle: (id: string) => void;
  onToggleListed: () => void;
}) {
  const t = useTranslations("dashboard.campaigns.segments");
  const tForm = useTranslations("dashboard.campaigns.segments.form");
  const tAudience = useTranslations("dashboard.campaigns.audience");
  const header = useRef<HTMLInputElement>(null);
  const check = headerCheckState(selected, listedIds);
  useEffect(() => {
    if (header.current) header.current.indeterminate = check === "some";
  }, [check]);

  const language = (p: SegmentPerson) => (p.language === "es" ? "ES" : "EN");
  const subscription = (p: SegmentPerson) =>
    p.newsletter ? t("subscribed") : t("notSubscribed");
  const lastBooking = (p: SegmentPerson) =>
    p.lastBookingDate ? formatMediumDate(p.lastBookingDate, locale) : "—";

  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-sand-100 border-b">
              <th scope="col" className="w-12 px-4 py-2.5">
                <input
                  ref={header}
                  type="checkbox"
                  checked={check === "all"}
                  onChange={onToggleListed}
                  aria-label={tForm("selectVisible")}
                  className="accent-petroleum-700 size-4"
                />
              </th>
              <th scope="col" className={TH}>
                {t("columns.name")}
              </th>
              <th scope="col" className={TH}>
                {t("columns.email")}
              </th>
              <th scope="col" className={TH}>
                {t("columns.phone")}
              </th>
              <th scope="col" className={TH}>
                {t("columns.language")}
              </th>
              <th scope="col" className={TH}>
                {tAudience("subscription")}
              </th>
              <th scope="col" className={TH}>
                {t("columns.lastBooking")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((person) => {
              const isOn = selected.has(person.id);
              return (
                <tr
                  key={person.id}
                  onClick={() => onToggle(person.id)}
                  className={`border-sand-50 cursor-pointer border-b transition-colors last:border-0 ${
                    isOn ? "bg-petroleum-50/40" : "hover:bg-sand-50"
                  }`}
                >
                  <td className="w-12 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={isOn}
                      onChange={() => onToggle(person.id)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={tForm("selectPerson", {
                        name: personName(person),
                      })}
                      className="accent-petroleum-700 size-4"
                    />
                  </td>
                  <td className="text-petroleum-700 px-4 py-3 font-medium">
                    {personName(person)}
                  </td>
                  <td className="text-petroleum-500 px-4 py-3">
                    {person.email || "—"}
                    {person.emailIssue && (
                      <div>
                        <Issue reason={person.emailIssue} />
                      </div>
                    )}
                  </td>
                  <td className="text-petroleum-500 px-4 py-3 whitespace-nowrap">
                    {person.phone ?? "—"}
                    {person.whatsappIssue && (
                      <div>
                        <Issue reason={person.whatsappIssue} />
                      </div>
                    )}
                  </td>
                  <td className="text-petroleum-500 px-4 py-3">
                    {language(person)}
                  </td>
                  <td className="text-petroleum-500 px-4 py-3">
                    {subscription(person)}
                  </td>
                  <td className="text-petroleum-500 px-4 py-3 whitespace-nowrap">
                    {lastBooking(person)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden">
        <label className="border-sand-100 text-petroleum-500 flex min-h-11 items-center gap-3 border-b px-5 text-xs font-medium">
          <input
            type="checkbox"
            checked={check === "all"}
            ref={(el) => {
              if (el) el.indeterminate = check === "some";
            }}
            onChange={onToggleListed}
            className="accent-petroleum-700 size-4"
          />
          {tForm("selectVisible")}
        </label>
        <ul className="divide-sand-100 divide-y">
          {rows.map((person) => (
            <MobileRowCard
              key={person.id}
              title={
                <label className="flex min-h-11 items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selected.has(person.id)}
                    onChange={() => onToggle(person.id)}
                    aria-label={tForm("selectPerson", {
                      name: personName(person),
                    })}
                    className="accent-petroleum-700 size-4 shrink-0"
                  />
                  <span className="min-w-0 break-words">
                    {personName(person)}
                  </span>
                </label>
              }
              facts={[
                { label: t("columns.email"), value: person.email || "—" },
                { label: t("columns.phone"), value: person.phone ?? "—" },
                { label: t("columns.language"), value: language(person) },
                {
                  label: tAudience("subscription"),
                  value: subscription(person),
                },
                { label: t("columns.lastBooking"), value: lastBooking(person) },
              ]}
            >
              {(person.emailIssue || person.whatsappIssue) && (
                <div className="flex flex-wrap gap-x-1.5">
                  {person.emailIssue && <Issue reason={person.emailIssue} />}
                  {person.whatsappIssue && (
                    <Issue reason={person.whatsappIssue} />
                  )}
                </div>
              )}
            </MobileRowCard>
          ))}
        </ul>
      </div>
    </>
  );
}
