"use client";

import { type Dispatch } from "react";
import { useTranslations } from "next-intl";
import { INPUT_CLASS } from "@/constants/form-styles";
import { EmailInput } from "@/components/ui/email-input";
import { OptionSelect } from "@/components/ui/option-select";
import { useGenderOptions } from "@/hooks/use-gender-options";
import { ToggleRow } from "@/components/dashboard/toggle-row";
import { LANGUAGE_OPTIONS } from "@/constants/i18n";
import type { GenderValue } from "@/constants/gender";
import type {
  DeskConsentState,
  DeskContactOption,
} from "@/lib/bookings/desk-consents";
import { ContactPicker } from "./contact-picker";
import type { FormAction } from "./form-state";

/**
 * Why a consent switch cannot be moved here, or null when it can. A consent on
 * file stays on (the screen never takes one back), a STOP or an unsubscribe
 * stays off (only her card lifts it, asking first), and a partner changes
 * nothing of a client already on file.
 */
function lockReason(
  contact: DeskContactOption | null,
  state: DeskConsentState | undefined,
  role: string | null,
): "consentOnFile" | "consentStopped" | "consentPartner" | null {
  if (!contact || !state) return null;
  if (state === "on") return "consentOnFile";
  if (state === "stopped") return "consentStopped";
  if (role !== "admin" && role !== "staff") return "consentPartner";
  return null;
}

/**
 * Who the appointment is for.
 *
 * Last of the steps, and shown only once there is an hour to attach the name
 * to — asking for it earlier is asking somebody to type a name into nothing.
 *
 * It opens on a search: a client already on file is picked (her details fill
 * the fields, her address stays fixed, her bonuses are offered) or "New
 * client" leaves the fields to be typed. Under them, the two switches of the
 * contact's card: "Appointment notices", on by default, and "News and offers".
 */
export function ClientStep({
  firstName,
  lastName,
  email,
  phone,
  gender,
  language,
  notes,
  contact,
  marketing,
  appointmentNotices,
  role,
  submitting,
  dispatchForm,
}: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gender: GenderValue;
  language: string;
  notes: string;
  contact: DeskContactOption | null;
  marketing: boolean;
  appointmentNotices: boolean;
  role: string | null;
  submitting: boolean;
  dispatchForm: Dispatch<FormAction>;
}) {
  const t = useTranslations("dashboard.bookings.form");
  const tClient = useTranslations("dashboard.bookings.form.client");
  const tConsent = useTranslations("dashboard.contacts.detail.whatsapp");
  const genderOptions = useGenderOptions();
  const appointmentsLock = lockReason(
    contact,
    contact?.appointmentNotices,
    role,
  );
  const marketingLock = lockReason(contact, contact?.marketing, role);

  return (
    <div className="border-sand-200 animate-fade-in-up rounded-2xl border bg-white p-6">
      <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
        {t("steps.client")}
      </h2>
      <div className="space-y-4">
        {contact ? (
          <div className="border-sand-200 bg-sand-50 flex items-center justify-between gap-4 rounded-2xl border p-4">
            <div className="min-w-0">
              <p className="text-petroleum-400 text-xs">
                {tClient("existing")}
              </p>
              <p className="text-petroleum-700 truncate text-sm font-medium">
                {[contact.firstName, contact.lastName]
                  .filter(Boolean)
                  .join(" ") || contact.email}
              </p>
              <p className="text-petroleum-400 truncate text-xs">
                {[contact.email, contact.phone].filter(Boolean).join(" · ")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => dispatchForm({ type: "CLEAR_CONTACT" })}
              disabled={submitting}
              className="text-petroleum-700 shrink-0 text-sm font-medium underline underline-offset-4"
            >
              {tClient("change")}
            </button>
          </div>
        ) : (
          <ContactPicker
            disabled={submitting}
            onPick={(picked) =>
              dispatchForm({ type: "SELECT_CONTACT", value: picked })
            }
            // Already a new client: what was typed below stays, only the
            // cursor moves to it.
            onNew={() => document.getElementById("firstName")?.focus()}
          />
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="firstName"
              className="text-petroleum-500 text-xs font-medium"
            >
              {t("fields.firstName")} <span className="text-red-400">*</span>
            </label>
            <input
              id="firstName"
              type="text"
              value={firstName}
              onChange={(e) =>
                dispatchForm({
                  type: "SET_FIELD",
                  field: "firstName",
                  value: e.target.value,
                })
              }
              placeholder={t("fields.firstNamePlaceholder")}
              disabled={submitting}
              className={INPUT_CLASS}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="lastName"
              className="text-petroleum-500 text-xs font-medium"
            >
              {t("fields.lastName")}
            </label>
            <input
              id="lastName"
              type="text"
              value={lastName}
              onChange={(e) =>
                dispatchForm({
                  type: "SET_FIELD",
                  field: "lastName",
                  value: e.target.value,
                })
              }
              placeholder={t("fields.lastNamePlaceholder")}
              disabled={submitting}
              className={INPUT_CLASS}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="email"
            className="text-petroleum-500 text-xs font-medium"
          >
            {t("fields.email")} <span className="text-red-400">*</span>
          </label>
          <EmailInput
            id="email"
            value={email}
            onChange={(value) =>
              dispatchForm({
                type: "SET_FIELD",
                field: "email",
                value: value,
              })
            }
            placeholder={t("fields.emailPlaceholder")}
            disabled={submitting || contact !== null}
            className={INPUT_CLASS}
          />
          {contact && (
            <p className="text-petroleum-400 text-xs">
              {tClient("emailLocked")}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="phone"
            className="text-petroleum-500 text-xs font-medium"
          >
            {t("fields.phone")}
          </label>
          <input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) =>
              dispatchForm({
                type: "SET_FIELD",
                field: "phone",
                value: e.target.value,
              })
            }
            placeholder={t("fields.phonePlaceholder")}
            disabled={submitting}
            className={INPUT_CLASS}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="client-gender"
            className="text-petroleum-500 text-xs font-medium"
          >
            {t("fields.gender")}
          </label>
          <OptionSelect
            id="client-gender"
            value={gender}
            options={genderOptions}
            onChange={(next) =>
              dispatchForm({
                type: "SET_FIELD",
                field: "gender",
                value: next,
              })
            }
            disabled={submitting}
            ariaLabel={t("fields.gender")}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="client-language"
            className="text-petroleum-500 text-xs font-medium"
          >
            {t("fields.language")}
          </label>
          <OptionSelect
            id="client-language"
            value={language}
            options={LANGUAGE_OPTIONS}
            onChange={(next) =>
              dispatchForm({
                type: "SET_FIELD",
                field: "language",
                value: next,
              })
            }
            disabled={submitting}
            ariaLabel={t("fields.language")}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="notes"
            className="text-petroleum-500 text-xs font-medium"
          >
            {t("fields.notes")}
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) =>
              dispatchForm({
                type: "SET_NOTES",
                value: e.target.value,
              })
            }
            placeholder={t("fields.notesPlaceholder")}
            rows={3}
            disabled={submitting}
            className={INPUT_CLASS + " resize-none"}
          />
        </div>

        <ToggleRow
          checked={
            appointmentsLock
              ? contact?.appointmentNotices === "on"
              : appointmentNotices
          }
          disabled={submitting || appointmentsLock !== null}
          label={tConsent("appointments.label")}
          hint={tClient(appointmentsLock ?? "appointmentsHint")}
          onToggle={() => dispatchForm({ type: "TOGGLE_APPOINTMENT_NOTICES" })}
        />

        <ToggleRow
          checked={marketingLock ? contact?.marketing === "on" : marketing}
          disabled={submitting || marketingLock !== null}
          label={tConsent("marketing.label")}
          hint={tClient(marketingLock ?? "marketingHint")}
          onToggle={() => dispatchForm({ type: "TOGGLE_MARKETING" })}
        />
      </div>
    </div>
  );
}
