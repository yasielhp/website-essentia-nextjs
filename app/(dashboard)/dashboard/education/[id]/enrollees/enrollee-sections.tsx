"use client";

import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { TIME_ZONE } from "@/utils/format";
import {
  IconPlus,
  IconTrash,
  IconX,
  IconSearch,
  IconSpinner,
} from "@/components/ui/icons";
import type { Contact, Enrollee } from "./types";

/**
 * The header, one enrollee's row, and the dialog that adds somebody.
 *
 * The same three parts the race registrations screen has, split the same way
 * and for the same reason: the page's job is the query, not the markup.
 */
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
  title: string | null | undefined;
  loading: boolean;
  onAddOpen: () => void;
};

export function PageHeader({ title, loading, onAddOpen }: PageHeaderProps) {
  const t = useTranslations("dashboard.education.enrollees");
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

        <Button
          variant="solid"
          size="md"
          onClick={() => void onAddOpen()}
          disabled={loading}
          className="gap-2 self-start sm:self-auto"
        >
          <IconPlus />
          {t("addEnrollee")}
        </Button>
      </div>
    </div>
  );
}

type EnrolleeRowProps = {
  enrollee: Enrollee;
  index: number;
  removeOpen: string | null;
  removingId: string | null;
  onConfirmOpen: (id: string) => void;
  onConfirmClose: () => void;
  onRemove: (id: string) => void;
};

export function EnrolleeRow({
  enrollee,
  index,
  removeOpen,
  removingId,
  onConfirmOpen,
  onConfirmClose,
  onRemove,
}: EnrolleeRowProps) {
  const t = useTranslations("dashboard.education.enrollees");
  const locale = useLocale();
  return (
    <tr className="border-sand-50 hover:bg-sand-50 border-b transition-colors">
      <td className="text-petroleum-300 px-5 py-4">{index + 1}</td>
      <td className="text-petroleum-700 px-5 py-4 font-medium">
        {enrollee.full_name ?? (
          <span className="text-petroleum-300">{"—"}</span>
        )}
      </td>
      <td className="text-petroleum-500 px-5 py-4">
        {enrollee.email ?? <span className="text-petroleum-300">{"—"}</span>}
      </td>
      <td className="text-petroleum-500 px-5 py-4">
        {enrollee.phone ?? <span className="text-petroleum-300">{"—"}</span>}
      </td>
      <td className="text-petroleum-400 px-5 py-4">
        {formatDateTime(enrollee.registered_at, locale)}
      </td>
      <td className="px-5 py-4">
        {removeOpen === enrollee.id ? (
          <div className="flex items-center gap-1.5">
            <span className="text-petroleum-400 text-xs">Remove?</span>
            <button
              onClick={() => onRemove(enrollee.id)}
              disabled={removingId === enrollee.id}
              className="inline-flex items-center rounded-xl bg-red-500 px-3 py-1.5 text-xs text-white transition-colors hover:bg-red-600 disabled:opacity-50"
            >
              {removingId === enrollee.id ? "…" : t("removeYes")}
            </button>
            <button
              onClick={onConfirmClose}
              disabled={removingId === enrollee.id}
              className="border-sand-200 text-petroleum-400 hover:bg-sand-50 inline-flex items-center rounded-xl border px-3 py-1.5 text-xs transition-colors disabled:opacity-50"
            >
              {t("keep")}
            </button>
          </div>
        ) : (
          <button
            onClick={() => onConfirmOpen(enrollee.id)}
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

type AddEnrolleeModalProps = {
  search: string;
  contactsLoading: boolean;
  filteredContacts: Contact[];
  addingId: string | null;
  onClose: () => void;
  onSearch: (value: string) => void;
  onAdd: (contact: Contact) => void;
};

export function AddEnrolleeModal({
  search,
  contactsLoading,
  filteredContacts,
  addingId,
  onClose,
  onSearch,
  onAdd,
}: AddEnrolleeModalProps) {
  const t = useTranslations("dashboard.education.enrollees");
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
              {search ? t("noMatches") : t("allEnrolled")}
            </p>
          ) : (
            <ul className="space-y-1.5 pt-1">
              {filteredContacts.map((contact) => (
                <li key={contact.id}>
                  <div className="border-sand-100 hover:border-petroleum-200 hover:bg-sand-50 flex w-full items-center justify-between rounded-xl border px-4 py-3 transition-colors">
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
                      variant="solid"
                      size="sm"
                      onClick={() => onAdd(contact)}
                      disabled={addingId === contact.id}
                      className="shrink-0 gap-1.5"
                    >
                      {addingId === contact.id ? (
                        <IconSpinner className="animate-spin" />
                      ) : (
                        <IconPlus />
                      )}
                      {t("addEnrollee")}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
