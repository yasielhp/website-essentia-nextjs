"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { notifySuccess } from "@/lib/feedback";
import { Button } from "@/components/ui/button";
import {
  subscribeToNewsletter,
  unsubscribeFromNewsletter,
} from "@/actions/newsletter";
import { IconCheckmark, IconTrash } from "@/components/ui/icons";
import { deleteContact } from "@/actions/delete-contact";
import { getAccessToken } from "@/lib/client-session";
import {
  dashboardContactSchema,
  parseErrors,
  type FormErrors,
} from "@/lib/schemas";
import { normalizeEmail, normalizePhone } from "@/utils/contact";
import { OptionSelect } from "@/components/ui/option-select";
import { toStoredGender, type GenderValue } from "@/constants/gender";
import { useGenderOptions } from "@/hooks/use-gender-options";
import { useDashboardLocale } from "@/hooks/use-dashboard-locale";
import { formatMediumDate, formatPrice } from "@/utils/format";
import {
  LocationBadge,
  SourceBadge,
  StatusBadge,
  formatBookingDate,
  formatCreatedDate,
  formatCreatedTime,
  locationDetail,
} from "@/components/dashboard/booking-cells";
import { fetchContactDetail, updateContact } from "@/actions/contacts";
import type {
  ContactBooking,
  ContactMembership,
  ContactRaceReg,
  ContactEduReg,
} from "@/types/contact";
import { EmailInput } from "@/components/ui/email-input";
import { TabButton } from "@/components/dashboard/settings/tab-button";

/** The four views of a contact's history. */
type HistoryTab = "transactions" | "bookings" | "races" | "education";

const INPUT_CLASS =
  "border-sand-200 bg-white text-petroleum-700 placeholder:text-petroleum-300 focus:border-petroleum-400 focus:ring-petroleum-100 rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 w-full disabled:opacity-60";

type Booking = ContactBooking;
type Membership = ContactMembership;
type RaceReg = ContactRaceReg;
type EduReg = ContactEduReg;

// ─── Load reducer ─────────────────────────────────────────────

type LoadState = {
  loading: boolean;
  notFound: boolean;
  bookings: Booking[];
  memberships: Membership[];
  raceRegs: RaceReg[];
  eduRegs: EduReg[];
};

type LoadAction =
  | {
      type: "LOADED";
      bookings: Booking[];
      memberships: Membership[];
      raceRegs: RaceReg[];
      eduRegs: EduReg[];
    }
  | { type: "NOT_FOUND" };

const initialLoadState: LoadState = {
  loading: true,
  notFound: false,
  bookings: [],
  memberships: [],
  raceRegs: [],
  eduRegs: [],
};

function loadReducer(state: LoadState, action: LoadAction): LoadState {
  switch (action.type) {
    case "LOADED":
      return {
        loading: false,
        notFound: false,
        bookings: action.bookings,
        memberships: action.memberships,
        raceRegs: action.raceRegs,
        eduRegs: action.eduRegs,
      };
    case "NOT_FOUND":
      return { ...state, loading: false, notFound: true };
    default:
      return state;
  }
}

// ─── Form reducer ─────────────────────────────────────────────

type ContactErrors = FormErrors<typeof dashboardContactSchema>;

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  language: string;
  gender: GenderValue;
  newsletterSubscribed: boolean;
  fieldErrors: ContactErrors;
  error: string | null;
  saving: boolean;
  deleting: boolean;
  deleteOpen: boolean;
};

type FormAction =
  | {
      type: "INIT";
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      language: string;
      gender: GenderValue;
      newsletterSubscribed: boolean;
    }
  | {
      type: "SET_FIELD";
      field: "firstName" | "lastName" | "email" | "phone" | "language";
      value: string;
    }
  | { type: "SET_GENDER"; gender: GenderValue }
  | { type: "TOGGLE_NEWSLETTER" }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "SET_FIELD_ERRORS"; errors: ContactErrors }
  | { type: "SAVING_START" }
  | { type: "SAVING_END" }
  | { type: "DELETING_START" }
  | { type: "OPEN_DELETE" }
  | { type: "CLOSE_DELETE" };

const initialFormState: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  language: "en",
  gender: "",
  newsletterSubscribed: false,
  fieldErrors: {},
  error: null,
  saving: false,
  deleting: false,
  deleteOpen: false,
};

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "INIT":
      return {
        ...state,
        firstName: action.firstName,
        lastName: action.lastName,
        email: action.email,
        phone: action.phone,
        language: action.language,
        gender: action.gender,
        newsletterSubscribed: action.newsletterSubscribed,
      };
    case "SET_GENDER":
      return { ...state, gender: action.gender };
    case "TOGGLE_NEWSLETTER":
      return { ...state, newsletterSubscribed: !state.newsletterSubscribed };
    case "SET_FIELD":
      return {
        ...state,
        [action.field]: action.value,
        fieldErrors: { ...state.fieldErrors, [action.field]: undefined },
      };
    case "SET_FIELD_ERRORS":
      return { ...state, fieldErrors: action.errors, saving: false };
    case "SET_ERROR":
      return { ...state, error: action.error };
    case "SAVING_START":
      return { ...state, saving: true, error: null };
    case "SAVING_END":
      return { ...state, saving: false };
    case "DELETING_START":
      return { ...state, deleting: true };
    case "OPEN_DELETE":
      return { ...state, deleteOpen: true };
    case "CLOSE_DELETE":
      return { ...state, deleteOpen: false };
    default:
      return state;
  }
}

// ─── Shared helpers ───────────────────────────────────────────

function RowSkeleton({ cols }: { cols: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="bg-sand-100 h-10 animate-pulse rounded-xl" />
      ))}
      <span className="sr-only">{cols}</span>
    </div>
  );
}

function DeleteDialog({
  name,
  deleting,
  onConfirm,
  onCancel,
}: {
  name: string;
  deleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("dashboard.contacts.detail");
  const tCommon = useTranslations("dashboard.common");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex flex-col gap-1">
          <h3 className="font-display text-petroleum-700 text-xl">
            {t("deleteDialog.title")}
          </h3>
          <p className="text-petroleum-400 text-sm">
            {t.rich("deleteDialog.body", {
              name: () => (
                <strong className="text-petroleum-500 font-medium">
                  {name}
                </strong>
              ),
            })}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Button
            variant="danger"
            size="md"
            onClick={onConfirm}
            disabled={deleting}
            className="w-full"
          >
            {deleting ? t("deleteDialog.deleting") : t("deleteDialog.confirm")}
          </Button>
          <Button
            variant="outline"
            size="md"
            onClick={onCancel}
            disabled={deleting}
            className="w-full"
          >
            {tCommon("cancel")}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Section components ───────────────────────────────────────

function ContactDetailsCard({
  firstName,
  lastName,
  email,
  phone,
  language,
  gender,
  newsletterSubscribed,
  fieldErrors,
  loading,
  saving,
  dispatchForm,
}: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  language: string;
  gender: GenderValue;
  newsletterSubscribed: boolean;
  fieldErrors: ContactErrors;
  loading: boolean;
  saving: boolean;
  dispatchForm: React.Dispatch<FormAction>;
}) {
  const t = useTranslations("dashboard.contacts.detail");
  const tForm = useTranslations("dashboard.contacts.form");
  const genderOptions = useGenderOptions();
  function field(
    f: "firstName" | "lastName" | "email" | "phone" | "language",
    value: string,
  ) {
    dispatchForm({ type: "SET_FIELD", field: f, value });
  }

  return (
    <div className="border-sand-200 mb-6 rounded-2xl border bg-white p-6">
      <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">Details</h2>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="firstName"
              className="text-petroleum-500 text-xs font-medium"
            >
              {tForm("fields.firstName")}{" "}
              <span className="text-red-400">*</span>
            </label>
            {loading ? (
              <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
            ) : (
              <input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => field("firstName", e.target.value)}
                placeholder={tForm("fields.firstNamePlaceholder")}
                disabled={saving}
                className={INPUT_CLASS}
              />
            )}
            {fieldErrors.firstName && (
              <p className="text-xs text-red-500">{fieldErrors.firstName}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="lastName"
              className="text-petroleum-500 text-xs font-medium"
            >
              {tForm("fields.lastName")}
            </label>
            {loading ? (
              <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
            ) : (
              <input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => field("lastName", e.target.value)}
                placeholder={tForm("fields.lastNamePlaceholder")}
                disabled={saving}
                className={INPUT_CLASS}
              />
            )}
            {fieldErrors.lastName && (
              <p className="text-xs text-red-500">{fieldErrors.lastName}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="email"
            className="text-petroleum-500 text-xs font-medium"
          >
            {tForm("fields.email")}
          </label>
          {loading ? (
            <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
          ) : (
            <EmailInput
              id="email"
              value={email}
              onChange={(value) => field("email", value)}
              placeholder={tForm("fields.emailPlaceholder")}
              disabled={saving}
              className={INPUT_CLASS}
            />
          )}
          {fieldErrors.email && (
            <p className="text-xs text-red-500">{fieldErrors.email}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="phone"
            className="text-petroleum-500 text-xs font-medium"
          >
            {tForm("fields.phone")}
          </label>
          {loading ? (
            <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
          ) : (
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => field("phone", e.target.value)}
              placeholder={tForm("fields.phonePlaceholder")}
              disabled={saving}
              className={INPUT_CLASS}
            />
          )}
          {fieldErrors.phone && (
            <p className="text-xs text-red-500">{fieldErrors.phone}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="gender"
            className="text-petroleum-500 text-xs font-medium"
          >
            {tForm("fields.gender")}
          </label>
          {loading ? (
            <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
          ) : (
            <OptionSelect
              id="gender"
              value={gender}
              options={genderOptions}
              onChange={(next) =>
                dispatchForm({ type: "SET_GENDER", gender: next })
              }
              disabled={saving}
              ariaLabel={tForm("fields.gender")}
            />
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="language"
            className="text-petroleum-500 text-xs font-medium"
          >
            {t("fields.preferredLanguage")}
          </label>
          {loading ? (
            <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
          ) : (
            <select
              id="language"
              value={language}
              onChange={(e) => field("language", e.target.value)}
              disabled={saving}
              className={INPUT_CLASS}
            >
              <option value="en">English</option>
              <option value="es">Español</option>
            </select>
          )}
        </div>

        {loading ? (
          <div className="bg-sand-100 h-16 animate-pulse rounded-2xl" />
        ) : (
          <button
            type="button"
            disabled={saving}
            onClick={() => dispatchForm({ type: "TOGGLE_NEWSLETTER" })}
            className={[
              "flex w-full items-center justify-between rounded-2xl border p-4 text-left transition-all duration-200",
              newsletterSubscribed
                ? "border-petroleum-200 bg-petroleum-50"
                : "border-sand-200 bg-sand-50",
              saving ? "cursor-not-allowed opacity-60" : "cursor-pointer",
            ].join(" ")}
          >
            <div className="flex flex-col gap-0.5">
              <p className="text-petroleum-700 text-sm font-medium">
                {t("newsletter.label")}
              </p>
              <p className="text-petroleum-400 text-xs">
                {newsletterSubscribed
                  ? t("newsletter.subscribed")
                  : t("newsletter.notSubscribed")}
              </p>
            </div>
            <div
              className={[
                "flex h-6 w-11 shrink-0 items-center rounded-full px-0.5 transition-colors duration-200",
                newsletterSubscribed ? "bg-petroleum-500" : "bg-sand-300",
              ].join(" ")}
            >
              <div
                className={[
                  "size-5 rounded-full bg-white shadow-sm transition-transform duration-200",
                  newsletterSubscribed ? "translate-x-5" : "translate-x-0",
                ].join(" ")}
              />
            </div>
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Everything this contact has transacted, in one list.
 *
 * There is no `transactions` table — the dashboard's transactions screen
 * derives its rows from bookings, memberships and registrations, and this
 * mirrors it for a single person.
 *
 * Rows without an amount are still transactions. Filtering them out hid drafts,
 * memberships and registrations, which is most of what some contacts have.
 *
 * The status is the payment's, not the appointment's. Counting a confirmed
 * booking as "completed" marked all 77 of them settled while every
 * `payment_status` in the database is still `pending` — a column of money
 * saying it had been collected when none of it had.
 */
type TransactionRow = {
  id: string;
  kind: string;
  title: string;
  date: string | null;
  amount: number | null;
  status: string;
  created_at: string | null;
};

function bookingStatus(b: Booking): string {
  if (b.payment_status === "paid") return "completed";
  // A cancelled appointment is not a pending charge, whatever the payment row
  // still says.
  if (b.status === "cancelled") return "cancelled";
  return b.payment_status ?? "—";
}

const TX_STATUS_STYLES: Record<string, string> = {
  completed: "bg-green-50 text-green-700",
  paid: "bg-green-50 text-green-700",
  active: "bg-green-50 text-green-700",
  confirmed: "bg-green-50 text-green-700",
  failed: "bg-red-50 text-red-700",
  refunded: "bg-red-50 text-red-700",
  cancelled: "bg-red-50 text-red-700",
};

function TransactionsSection({
  loading,
  bookings,
  memberships,
  raceRegs,
  eduRegs,
}: {
  loading: boolean;
  bookings: Booking[];
  memberships: Membership[];
  raceRegs: RaceReg[];
  eduRegs: EduReg[];
}) {
  const t = useTranslations("dashboard.contacts.detail.transactions");
  const locale = useDashboardLocale();
  const rows: TransactionRow[] = [
    ...bookings.map((b) => ({
      id: b.id,
      kind: "Booking",
      title: b.service_title ?? "—",
      date: b.date,
      amount: b.price_eur,
      status: bookingStatus(b),
      created_at: b.created_at,
    })),
    ...memberships.map((m) => ({
      id: m.id,
      kind: "Membership",
      title: m.plan ?? "Membership",
      date: m.start_date,
      amount: null,
      status: m.status ?? "—",
      created_at: m.created_at,
    })),
    ...raceRegs.map((r) => ({
      id: r.id,
      kind: "Race",
      title: r.race?.title ?? "—",
      date: r.race?.date ?? r.created_at,
      amount: null,
      status: "confirmed",
      created_at: r.created_at,
    })),
    ...eduRegs.map((r) => ({
      id: r.id,
      kind: "Education",
      title: r.session?.title ?? "—",
      date: r.session?.date ?? r.created_at,
      amount: null,
      status: "confirmed",
      created_at: r.created_at,
    })),
  ].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));

  const paidTotal = bookings
    .filter((b) => b.payment_status === "paid")
    .reduce((sum, b) => sum + (b.price_eur ?? 0), 0);

  return (
    <div>
      <div className="mb-4 flex items-center justify-end">
        {!loading && paidTotal > 0 && (
          <span className="text-petroleum-400 text-xs">
            Paid to date{" "}
            <span className="text-petroleum-700 font-medium">
              {formatPrice(paidTotal, locale)}
            </span>
          </span>
        )}
      </div>
      {loading ? (
        <RowSkeleton cols={5} />
      ) : rows.length === 0 ? (
        <p className="text-petroleum-300 text-sm">{t("empty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-sand-100 border-b text-left">
                {["type", "concept", "date", "amount", "status"].map((h) => (
                  <th
                    key={h}
                    className="text-petroleum-400 pr-4 pb-2.5 font-medium"
                  >
                    {t(`columns.${h}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={`${r.kind}-${r.id}`}
                  className="border-sand-50 border-b last:border-0"
                >
                  <td className="text-petroleum-400 py-3 pr-4 text-xs">
                    {r.kind}
                  </td>
                  <td className="text-petroleum-700 py-3 pr-4 font-medium">
                    {r.title}
                  </td>
                  <td className="text-petroleum-500 py-3 pr-4">
                    {formatMediumDate(r.date, locale)}
                  </td>
                  <td className="text-petroleum-700 py-3 pr-4">
                    {r.amount == null ? "—" : formatPrice(r.amount, locale)}
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                        TX_STATUS_STYLES[r.status] ??
                        "bg-sand-100 text-petroleum-500"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * The same table as the bookings list, minus the client column — the page is
 * already about one person. Rows link through to the booking, as they do there.
 */
function BookingsSection({
  loading,
  bookings,
}: {
  loading: boolean;
  bookings: Booking[];
}) {
  const t = useTranslations("dashboard");
  const tSection = useTranslations("dashboard.contacts.detail.bookings");
  const locale = useLocale();
  const { push } = useRouter();

  return (
    <div>
      {loading ? (
        <RowSkeleton cols={5} />
      ) : bookings.length === 0 ? (
        <p className="text-petroleum-300 text-sm">{tSection("empty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-sand-100 border-b text-left">
                {[
                  "created",
                  "status",
                  "service",
                  "location",
                  "datetime",
                  "reservedBy",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-petroleum-400 pr-4 pb-2.5 font-medium"
                  >
                    {tSection(`columns.${h}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => {
                const detail = locationDetail(
                  b.location,
                  b.location_address,
                  (number) => t("bookings.room", { number }),
                );
                return (
                  <tr
                    key={b.id}
                    onClick={() => push(`/dashboard/bookings/${b.id}`)}
                    className="border-sand-50 hover:bg-sand-50 cursor-pointer border-b transition-colors last:border-0"
                  >
                    <td className="py-3 pr-4">
                      <p className="text-petroleum-500">
                        {formatCreatedDate(b.created_at, locale)}
                      </p>
                      <p className="text-petroleum-400 text-xs">
                        {formatCreatedTime(b.created_at, locale)}
                      </p>
                    </td>
                    <td className="py-3 pr-4">
                      <StatusBadge status={b.status} />
                    </td>
                    <td className="py-3 pr-4">
                      <p className="text-petroleum-700 font-medium">
                        {b.service_title ?? "—"}
                      </p>
                      {b.duration && (
                        <p className="text-petroleum-400 text-xs">
                          {b.duration}
                        </p>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <LocationBadge location={b.location} />
                      {detail && (
                        <p className="text-petroleum-400 mt-1 text-xs">
                          {detail}
                        </p>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <p className="text-petroleum-500">
                        {formatBookingDate(b.date, locale)}
                      </p>
                      {b.time && (
                        <p className="text-petroleum-400 text-xs">{b.time}</p>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <SourceBadge role={b.created_by_role} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RaceRegsSection({
  loading,
  raceRegs,
}: {
  loading: boolean;
  raceRegs: RaceReg[];
}) {
  const t = useTranslations("dashboard.contacts.detail.races");
  const locale = useDashboardLocale();
  return (
    <div>
      {loading ? (
        <RowSkeleton cols={4} />
      ) : raceRegs.length === 0 ? (
        <p className="text-petroleum-300 text-sm">{t("empty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-sand-100 border-b text-left">
                {["race", "date", "location", "registered"].map((h) => (
                  <th
                    key={h}
                    className="text-petroleum-400 pr-4 pb-2.5 font-medium"
                  >
                    {t(`columns.${h}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {raceRegs.map((r) => (
                <tr
                  key={r.id}
                  className="border-sand-50 border-b last:border-0"
                >
                  <td className="text-petroleum-700 py-3 pr-4 font-medium">
                    {r.race?.title ?? "—"}
                  </td>
                  <td className="text-petroleum-500 py-3 pr-4">
                    {r.race?.date ? formatMediumDate(r.race.date, locale) : "—"}
                  </td>
                  <td className="text-petroleum-500 py-3 pr-4">
                    {r.race?.location ?? "—"}
                  </td>
                  <td className="text-petroleum-400 py-3">
                    {formatMediumDate(r.created_at, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EduRegsSection({
  loading,
  eduRegs,
}: {
  loading: boolean;
  eduRegs: EduReg[];
}) {
  const t = useTranslations("dashboard.contacts.detail.education");
  const locale = useDashboardLocale();
  return (
    <div>
      {loading ? (
        <RowSkeleton cols={4} />
      ) : eduRegs.length === 0 ? (
        <p className="text-petroleum-300 text-sm">{t("empty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-sand-100 border-b text-left">
                {["session", "date", "location", "registered"].map((h) => (
                  <th
                    key={h}
                    className="text-petroleum-400 pr-4 pb-2.5 font-medium"
                  >
                    {t(`columns.${h}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {eduRegs.map((r) => (
                <tr
                  key={r.id}
                  className="border-sand-50 border-b last:border-0"
                >
                  <td className="text-petroleum-700 py-3 pr-4 font-medium">
                    {r.session?.title ?? "—"}
                  </td>
                  <td className="text-petroleum-500 py-3 pr-4">
                    {r.session?.date
                      ? formatMediumDate(r.session.date, locale)
                      : "—"}
                  </td>
                  <td className="text-petroleum-500 py-3 pr-4">
                    {r.session?.location ?? "—"}
                  </td>
                  <td className="text-petroleum-400 py-3">
                    {formatMediumDate(r.created_at, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function ContactDetailPage() {
  const tToasts = useTranslations("dashboard.toasts");
  const t = useTranslations("dashboard.contacts.detail");
  const { id } = useParams<{ id: string }>();
  const { push, back } = useRouter();

  const [loadState, dispatch] = useReducer(loadReducer, initialLoadState);
  const { loading, notFound, bookings, memberships, raceRegs, eduRegs } =
    loadState;

  const tHistory = useTranslations("dashboard.contacts.detail");
  const [tab, setTab] = useState<HistoryTab>("transactions");
  const historyTabs: { id: HistoryTab; label: string; count: number }[] = [
    {
      id: "transactions",
      label: tHistory("transactions.heading"),
      count: bookings.length + memberships.length,
    },
    {
      id: "bookings",
      label: tHistory("bookings.heading"),
      count: bookings.length,
    },
    { id: "races", label: tHistory("races.heading"), count: raceRegs.length },
    {
      id: "education",
      label: tHistory("education.heading"),
      count: eduRegs.length,
    },
  ];

  const [form, dispatchForm] = useReducer(formReducer, initialFormState);
  const {
    firstName,
    lastName,
    email,
    phone,
    language,
    gender,
    newsletterSubscribed,
    fieldErrors,
    error,
    saving,
    deleting,
    deleteOpen,
  } = form;

  const originalNewsletter = useRef<boolean>(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const result = await fetchContactDetail(getAccessToken(), id);
      if (cancelled) return;
      if (!result.found) {
        dispatch({ type: "NOT_FOUND" });
        return;
      }

      const { contact, bookings, memberships, raceRegs, eduRegs } = result;
      const initialNewsletter = contact.newsletter_subscribed ?? false;
      originalNewsletter.current = initialNewsletter;
      dispatchForm({
        type: "INIT",
        firstName: contact.first_name ?? "",
        lastName: contact.last_name ?? "",
        email: contact.email ?? "",
        phone: contact.phone ?? "",
        language: contact.preferred_language ?? "en",
        gender: contact.gender ?? "",
        newsletterSubscribed: initialNewsletter,
      });

      dispatch({ type: "LOADED", bookings, memberships, raceRegs, eduRegs });
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    dispatchForm({ type: "SET_ERROR", error: null });

    const errors = parseErrors(dashboardContactSchema, {
      firstName,
      lastName,
      email,
      phone,
      gender,
    });
    if (Object.keys(errors).length > 0) {
      dispatchForm({ type: "SET_FIELD_ERRORS", errors });
      return;
    }

    const trimmedFirst = firstName.trim();

    dispatchForm({ type: "SAVING_START" });

    const { error: updateErrorMsg } = await updateContact(
      getAccessToken(),
      id,
      {
        first_name: trimmedFirst,
        last_name: lastName.trim() || null,
        email: normalizeEmail(email),
        phone: normalizePhone(phone),
        preferred_language: language === "es" ? "es" : "en",
        gender: toStoredGender(gender),
        newsletter_subscribed: newsletterSubscribed,
      },
    );

    dispatchForm({ type: "SAVING_END" });

    if (updateErrorMsg) {
      dispatchForm({
        type: "SET_ERROR",
        error: updateErrorMsg ?? t("errors.saveFailed"),
      });
      return;
    }

    // Sync Resend audience only when the newsletter status actually changed
    const trimmedEmail = email.trim();
    if (trimmedEmail && newsletterSubscribed !== originalNewsletter.current) {
      try {
        if (newsletterSubscribed) {
          await subscribeToNewsletter(trimmedEmail);
        } else {
          await unsubscribeFromNewsletter(trimmedEmail);
        }
        originalNewsletter.current = newsletterSubscribed;
      } catch {
        // fail-open: Resend sync failure must not block navigation
      }
    }

    notifySuccess(tToasts("contactSaved"));
    push("/dashboard/contacts");
  }

  async function handleDelete() {
    dispatchForm({ type: "DELETING_START" });
    const { error } = await deleteContact(getAccessToken(), id);
    if (error) {
      dispatchForm({ type: "SET_ERROR", error });
      dispatchForm({ type: "CLOSE_DELETE" });
      return;
    }
    notifySuccess(tToasts("contactDeleted"));
    push("/dashboard/contacts");
  }

  const displayName =
    [firstName, lastName].filter(Boolean).join(" ") || "Contact";

  if (notFound) {
    return (
      <div className="text-petroleum-400 flex flex-col items-center justify-center py-24">
        <p className="text-sm">{t("notFound")}</p>
        <button
          onClick={() => back()}
          className="hover:text-petroleum-700 mt-4 text-xs underline"
        >
          {t("goBack")}
        </button>
      </div>
    );
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      <form onSubmit={(e) => void handleSave(e)} noValidate>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-display text-petroleum-700 text-3xl">
            {t("title")}
          </h1>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline-danger"
              size="md"
              onClick={() => dispatchForm({ type: "OPEN_DELETE" })}
              disabled={loading}
              className="gap-1.5"
            >
              <IconTrash />
              {t("delete")}
            </Button>
            <Button
              type="submit"
              variant="solid"
              size="md"
              disabled={saving || loading}
              className="gap-1.5"
            >
              <IconCheckmark />
              {saving ? t("saving") : t("save")}
            </Button>
          </div>
        </div>

        {error && (
          <p className="mb-6 rounded-xl bg-red-100 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <ContactDetailsCard
          firstName={firstName}
          lastName={lastName}
          email={email}
          phone={phone}
          language={language}
          gender={gender}
          newsletterSubscribed={newsletterSubscribed}
          fieldErrors={fieldErrors}
          loading={loading}
          saving={saving}
          dispatchForm={dispatchForm}
        />
      </form>

      {/* One card, four views. Stacked, the four lists pushed the form far up
          the page and most of them are empty for most contacts. */}
      <div className="border-sand-200 rounded-2xl border bg-white p-6">
        <div className="border-sand-100 -mx-6 -mt-6 mb-6 flex gap-1 overflow-x-auto border-b px-4 py-3">
          {historyTabs.map(({ id, label, count }) => (
            <TabButton key={id} active={tab === id} onClick={() => setTab(id)}>
              <span className="whitespace-nowrap">
                {label}
                {count > 0 && (
                  <span
                    className={`ml-1.5 text-xs ${
                      tab === id ? "text-white/70" : "text-petroleum-300"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </span>
            </TabButton>
          ))}
        </div>

        {tab === "transactions" && (
          <TransactionsSection
            loading={loading}
            bookings={bookings}
            memberships={memberships}
            raceRegs={raceRegs}
            eduRegs={eduRegs}
          />
        )}
        {tab === "bookings" && (
          <BookingsSection loading={loading} bookings={bookings} />
        )}
        {tab === "races" && (
          <RaceRegsSection loading={loading} raceRegs={raceRegs} />
        )}
        {tab === "education" && (
          <EduRegsSection loading={loading} eduRegs={eduRegs} />
        )}
      </div>

      {deleteOpen && (
        <DeleteDialog
          name={displayName}
          deleting={deleting}
          onConfirm={() => void handleDelete()}
          onCancel={() => dispatchForm({ type: "CLOSE_DELETE" })}
        />
      )}
    </div>
  );
}
