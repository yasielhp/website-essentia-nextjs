"use client";

import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { TIME_ZONE } from "@/utils/format";
import {
  IconQr,
  IconPlus,
  IconTrash,
  IconX,
  IconSearch,
} from "@/components/ui/icons";
import type { Contact, Registration } from "./types";

/**
 * Everything this screen draws: the header, one entrant's row, the dialog that
 * adds somebody, the empty state, the count, and the table around them.
 *
 * Six components with their own names, in one file of eight hundred lines with
 * the page that fetches the race. They kept the names; now they have a file.
 */
function formatDate(iso: string | null, locale: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: TIME_ZONE,
  });
}

function formatDateTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  });
}

type PageHeaderProps = {
  raceId: string;
  title: string | null | undefined;
  loading: boolean;
  onAddOpen: () => void;
};

export function PageHeader({
  raceId,
  title,
  loading,
  onAddOpen,
}: PageHeaderProps) {
  const t = useTranslations("dashboard.races.registrations");
  return (
    <div className="mb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-petroleum-700 text-3xl">
          {loading ? (
            <span className="bg-sand-100 inline-block h-8 w-64 animate-pulse rounded-lg" />
          ) : (
            title
          )}
        </h1>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="md"
            href={`/dashboard/races/${raceId}/checkin`}
            className="gap-2"
          >
            <IconQr />
            {t("checkIn")}
          </Button>
          <Button
            variant="solid"
            size="md"
            onClick={() => void onAddOpen()}
            disabled={loading}
            className="gap-2"
          >
            <IconPlus />
            {t("addToRace")}
          </Button>
        </div>
      </div>
    </div>
  );
}

type RegistrationRowProps = {
  reg: Registration;
  index: number;
  removeOpen: string | null;
  removingId: string | null;
  onConfirmOpen: (id: string) => void;
  onConfirmClose: () => void;
  onRemove: (id: string) => void;
};

function RegistrationRow({
  reg,
  index,
  removeOpen,
  removingId,
  onConfirmOpen,
  onConfirmClose,
  onRemove,
}: RegistrationRowProps) {
  const t = useTranslations("dashboard.races.registrations");
  const locale = useLocale();
  return (
    <tr className="border-sand-50 hover:bg-sand-50 border-b transition-colors">
      <td className="text-petroleum-300 px-5 py-4">{index + 1}</td>
      <td className="text-petroleum-700 px-5 py-4 font-medium">
        {reg.full_name ?? <span className="text-petroleum-300">{"—"}</span>}
      </td>
      <td className="text-petroleum-500 px-5 py-4">
        {reg.email ?? <span className="text-petroleum-300">{"—"}</span>}
      </td>
      <td className="text-petroleum-500 px-5 py-4">
        {reg.phone ?? <span className="text-petroleum-300">{"—"}</span>}
      </td>
      <td className="px-5 py-4">
        {reg.table_number != null ? (
          <span className="inline-flex items-center gap-1">
            <span className="bg-petroleum-100 text-petroleum-500 rounded-full px-2.5 py-0.5 text-xs font-medium">
              {t("table", { number: reg.table_number })}
            </span>
            {reg.checked_in_at && (
              <span
                className="size-1.5 rounded-full bg-green-500"
                title="Verificado"
              />
            )}
          </span>
        ) : (
          <span className="text-petroleum-300">{"—"}</span>
        )}
      </td>
      <td className="text-petroleum-400 px-5 py-4">
        {formatDateTime(reg.registered_at, locale)}
      </td>
      <td className="px-5 py-4">
        {removeOpen === reg.id ? (
          <div className="flex items-center gap-1.5">
            <span className="text-petroleum-400 text-xs">
              {t("removeConfirm")}
            </span>
            <button
              onClick={() => onRemove(reg.id)}
              disabled={removingId === reg.id}
              className="inline-flex items-center rounded-xl bg-red-500 px-3 py-1.5 text-xs text-white transition-colors hover:bg-red-600 disabled:opacity-50"
            >
              {removingId === reg.id ? "…" : t("removeYes")}
            </button>
            <button
              onClick={onConfirmClose}
              disabled={removingId === reg.id}
              className="border-sand-200 text-petroleum-400 hover:bg-sand-50 inline-flex items-center rounded-xl border px-3 py-1.5 text-xs transition-colors disabled:opacity-50"
            >
              {t("keep")}
            </button>
          </div>
        ) : (
          <button
            onClick={() => onConfirmOpen(reg.id)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-red-300 px-3 py-1.5 text-xs text-red-500 transition-colors hover:bg-red-50"
          >
            <IconTrash />
            {t("remove")}
          </button>
        )}
      </td>
    </tr>
  );
}

type AddContactModalProps = {
  search: string;
  contactsLoading: boolean;
  filteredContacts: Contact[];
  addingId: string | null;
  onClose: () => void;
  onSearch: (value: string) => void;
  onAdd: (contact: Contact) => void;
};

export function AddContactModal({
  search,
  contactsLoading,
  filteredContacts,
  addingId,
  onClose,
  onSearch,
  onAdd,
}: AddContactModalProps) {
  const t = useTranslations("dashboard.races.registrations");
  const tCommon = useTranslations("dashboard.common");
  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        role="presentation"
        className="mx-4 flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between px-6 pt-6 pb-4">
          <h2 className="font-display text-petroleum-700 text-xl">
            {t("addModalTitle")}
          </h2>
          <button
            onClick={onClose}
            aria-label={tCommon("close")}
            className="text-petroleum-400 hover:bg-sand-100 hover:text-petroleum-700 rounded-lg p-1.5 transition-colors"
          >
            <IconX />
          </button>
        </div>

        <div className="shrink-0 px-6 pb-3">
          <div className="relative">
            <span className="text-petroleum-300 pointer-events-none absolute top-1/2 left-3 -translate-y-1/2">
              <IconSearch />
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="border-sand-200 bg-sand-50 text-petroleum-700 placeholder:text-petroleum-300 focus:border-petroleum-400 focus:ring-petroleum-100 w-full rounded-xl border py-2.5 pr-4 pl-9 text-sm outline-none focus:ring-2"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {contactsLoading ? (
            <div className="space-y-2 pt-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-sand-100 h-14 animate-pulse rounded-xl"
                />
              ))}
            </div>
          ) : filteredContacts.length === 0 ? (
            <p className="text-petroleum-400 py-8 text-center text-sm">
              {search ? t("noMatches") : t("allRegistered")}
            </p>
          ) : (
            <ul className="space-y-1.5 pt-1">
              {filteredContacts.map((contact) => (
                <li
                  key={contact.id}
                  className="border-sand-100 hover:border-petroleum-200 hover:bg-sand-50 flex items-center justify-between rounded-xl border px-4 py-3 transition-colors"
                >
                  <div>
                    <p className="text-petroleum-700 text-sm font-medium">
                      {contact.full_name}
                    </p>
                    <p className="text-petroleum-400 mt-0.5 text-xs">
                      {[contact.email, contact.phone]
                        .filter(Boolean)
                        .join(" · ") || t("noContactInfo")}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="solid"
                    size="sm"
                    className="shrink-0 gap-1.5"
                    onClick={() => onAdd(contact)}
                    disabled={addingId === contact.id}
                  >
                    {addingId === contact.id ? (
                      <div className="size-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    ) : (
                      <IconPlus />
                    )}
                    {t("addToRace")}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

type NotFoundStateProps = {
  onBack: () => void;
};

export function NotFoundState({ onBack }: NotFoundStateProps) {
  const t = useTranslations("dashboard.races.registrations");
  return (
    <div className="text-petroleum-400 flex flex-col items-center justify-center py-24">
      <p className="text-sm">{t("notFound")}</p>
      <button
        onClick={onBack}
        className="hover:text-petroleum-700 mt-4 text-xs underline"
      >
        {t("goBack")}
      </button>
    </div>
  );
}

type RegistrationsSummaryProps = {
  date: string | null;
  count: number;
  maxParticipants: number | null;
};

export function RegistrationsSummary({
  date,
  count,
  maxParticipants,
}: RegistrationsSummaryProps) {
  const t = useTranslations("dashboard.races.registrations");
  const locale = useLocale();
  return (
    <div className="border-sand-100 flex items-center justify-between border-b px-5 py-3">
      <p className="text-petroleum-400 text-sm">{formatDate(date, locale)}</p>
      <p className="text-petroleum-400 text-sm">
        {t("count", { count })}
        {maxParticipants != null && (
          <span
            className={
              count >= maxParticipants ? "font-medium text-red-500" : ""
            }
          >
            {t("ofMax", { max: maxParticipants })}
          </span>
        )}
      </p>
    </div>
  );
}

type RegistrationsTableProps = {
  loading: boolean;
  registrations: Registration[];
  removeOpen: string | null;
  removingId: string | null;
  onConfirmOpen: (id: string) => void;
  onConfirmClose: () => void;
  onRemove: (id: string) => void;
};

export function RegistrationsTable({
  loading,
  registrations,
  removeOpen,
  removingId,
  onConfirmOpen,
  onConfirmClose,
  onRemove,
}: RegistrationsTableProps) {
  const t = useTranslations("dashboard.races.registrations");
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-sand-200 border-b text-left">
            <th className="text-petroleum-400 px-5 py-3.5 font-medium">#</th>
            <th className="text-petroleum-400 px-5 py-3.5 font-medium">
              {t("columns.name")}
            </th>
            <th className="text-petroleum-400 px-5 py-3.5 font-medium">
              {t("columns.email")}
            </th>
            <th className="text-petroleum-400 px-5 py-3.5 font-medium">
              {t("columns.phone")}
            </th>
            <th className="text-petroleum-400 px-5 py-3.5 font-medium">
              {t("columns.table")}
            </th>
            <th className="text-petroleum-400 px-5 py-3.5 font-medium">
              {t("columns.registeredAt")}
            </th>
            <th className="text-petroleum-400 px-5 py-3.5 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-sand-50 border-b">
                {Array.from({ length: 7 }).map((_, j) => (
                  <td key={j} className="px-5 py-4">
                    <div className="bg-sand-100 h-4 animate-pulse rounded" />
                  </td>
                ))}
              </tr>
            ))
          ) : registrations.length === 0 ? (
            <tr>
              <td
                colSpan={7}
                className="text-petroleum-400 px-6 py-12 text-center"
              >
                {t("empty")}
              </td>
            </tr>
          ) : (
            registrations.map((reg, index) => (
              <RegistrationRow
                key={reg.id}
                reg={reg}
                index={index}
                removeOpen={removeOpen}
                removingId={removingId}
                onConfirmOpen={onConfirmOpen}
                onConfirmClose={onConfirmClose}
                onRemove={onRemove}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
