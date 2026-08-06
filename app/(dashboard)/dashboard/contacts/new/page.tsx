"use client";

import { useReducer } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { notifySuccess } from "@/lib/feedback";
import { insforge } from "@/lib/insforge";
import {
  dashboardContactSchema,
  parseErrors,
  type FormErrors,
} from "@/lib/schemas";
import { normalizeEmail, normalizePhone } from "@/utils/contact";
import { Button } from "@/components/ui/button";
import type { ContactStatus } from "@/types/contact";
import { OptionSelect } from "@/components/ui/option-select";
import { toStoredGender, type GenderValue } from "@/constants/gender";
import { useGenderOptions } from "@/hooks/use-gender-options";
import { useFieldError } from "@/hooks/use-field-error";

const INPUT_CLASS =
  "border-sand-200 bg-white text-petroleum-700 placeholder:text-petroleum-300 focus:border-petroleum-400 focus:ring-petroleum-100 rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 w-full disabled:opacity-60";

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

type ContactErrors = FormErrors<typeof dashboardContactSchema>;

type FormState = {
  submitting: boolean;
  error: string | null;
  fieldErrors: ContactErrors;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  language: string;
  gender: GenderValue;
  status: ContactStatus;
};

type FormAction =
  | {
      type: "SET_FIELD";
      field: "firstName" | "lastName" | "email" | "phone" | "language";
      value: string;
    }
  | { type: "SET_STATUS"; status: ContactStatus }
  | { type: "SET_GENDER"; gender: GenderValue }
  | { type: "SUBMIT_START" }
  | { type: "SUBMIT_ERROR"; message: string }
  | { type: "SET_FIELD_ERRORS"; errors: ContactErrors }
  | { type: "CLEAR_ERROR" };

const initialFormState: FormState = {
  submitting: false,
  error: null,
  fieldErrors: {},
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  language: "en",
  gender: "",
  status: "lead",
};

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "SET_FIELD":
      return {
        ...state,
        [action.field]: action.value,
        fieldErrors: { ...state.fieldErrors, [action.field]: undefined },
      };
    case "SET_FIELD_ERRORS":
      return { ...state, fieldErrors: action.errors, submitting: false };
    case "SET_STATUS":
      return { ...state, status: action.status };
    case "SET_GENDER":
      return { ...state, gender: action.gender };
    case "SUBMIT_START":
      return { ...state, submitting: true, error: null };
    case "SUBMIT_ERROR":
      return { ...state, submitting: false, error: action.message };
    case "CLEAR_ERROR":
      return { ...state, error: null };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------

export default function NewContactPage() {
  const t = useTranslations("dashboard.contacts.form");
  const tToasts = useTranslations("dashboard.toasts");
  const tCommon = useTranslations("dashboard.common");
  const fieldError = useFieldError();
  const genderOptions = useGenderOptions();
  const { push } = useRouter();
  const [state, dispatch] = useReducer(formReducer, initialFormState);
  const {
    submitting,
    error,
    fieldErrors,
    firstName,
    lastName,
    email,
    phone,
    language,
    gender,
    status,
  } = state;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    dispatch({ type: "CLEAR_ERROR" });

    const errors = parseErrors(dashboardContactSchema, {
      firstName,
      lastName,
      email,
      phone,
      gender,
    });
    if (Object.keys(errors).length > 0) {
      dispatch({ type: "SET_FIELD_ERRORS", errors });
      return;
    }

    dispatch({ type: "SUBMIT_START" });

    const trimmedFirst = firstName.trim();
    const trimmedEmail = normalizeEmail(email);

    // Upsert: the email may already belong to a lead who abandoned the booking
    // form, in which case this updates that row rather than failing.
    const { error: insertError } = await insforge.database
      .from("contacts")
      .upsert(
        {
          first_name: trimmedFirst,
          last_name: lastName.trim() || null,
          email: trimmedEmail,
          phone: normalizePhone(phone),
          preferred_language: language === "es" ? "es" : "en",
          gender: toStoredGender(gender),
          status,
        },
        { onConflict: "email" },
      );

    if (insertError) {
      dispatch({
        type: "SUBMIT_ERROR",
        message:
          (insertError as { message?: string })?.message ??
          "Failed to create contact.",
      });
      return;
    }

    notifySuccess(tToasts("contactCreated"));
    push("/dashboard/users");
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      <form onSubmit={(e) => void handleSubmit(e)} noValidate>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-petroleum-700 text-3xl">
              {t("title")}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" size="md" href="/dashboard/users">
              {tCommon("cancel")}
            </Button>
            <Button
              type="submit"
              variant="solid"
              size="md"
              disabled={submitting}
            >
              {submitting ? t("creating") : t("addContact")}
            </Button>
          </div>
        </div>

        {error && (
          <p className="mb-6 rounded-xl bg-red-100 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="grid grid-cols-1 gap-6">
          <div className="border-sand-200 rounded-2xl border bg-white p-6">
            <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
              {t("sections.details")}
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="firstName"
                    className="text-petroleum-500 text-xs font-medium"
                  >
                    {t("fields.firstName")}{" "}
                    <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="firstName"
                    type="text"
                    value={firstName}
                    onChange={(e) =>
                      dispatch({
                        type: "SET_FIELD",
                        field: "firstName",
                        value: e.target.value,
                      })
                    }
                    placeholder={t("fields.firstNamePlaceholder")}
                    disabled={submitting}
                    className={INPUT_CLASS}
                  />
                  {fieldErrors.firstName && (
                    <p className="text-xs text-red-500">
                      {fieldError(fieldErrors.firstName)}
                    </p>
                  )}
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
                      dispatch({
                        type: "SET_FIELD",
                        field: "lastName",
                        value: e.target.value,
                      })
                    }
                    placeholder={t("fields.lastNamePlaceholder")}
                    disabled={submitting}
                    className={INPUT_CLASS}
                  />
                  {fieldErrors.lastName && (
                    <p className="text-xs text-red-500">
                      {fieldError(fieldErrors.lastName)}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="email"
                  className="text-petroleum-500 text-xs font-medium"
                >
                  {t("fields.email")} <span className="text-red-400">*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) =>
                    dispatch({
                      type: "SET_FIELD",
                      field: "email",
                      value: e.target.value,
                    })
                  }
                  placeholder={t("fields.emailPlaceholder")}
                  disabled={submitting}
                  className={INPUT_CLASS}
                />
                {fieldErrors.email && (
                  <p className="text-xs text-red-500">
                    {fieldError(fieldErrors.email)}
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
                    dispatch({
                      type: "SET_FIELD",
                      field: "phone",
                      value: e.target.value,
                    })
                  }
                  placeholder={t("fields.phonePlaceholder")}
                  disabled={submitting}
                  className={INPUT_CLASS}
                />
                {fieldErrors.phone && (
                  <p className="text-xs text-red-500">
                    {fieldError(fieldErrors.phone)}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="gender"
                  className="text-petroleum-500 text-xs font-medium"
                >
                  {t("fields.gender")}
                </label>
                <OptionSelect
                  id="gender"
                  value={gender}
                  options={genderOptions}
                  onChange={(next) =>
                    dispatch({ type: "SET_GENDER", gender: next })
                  }
                  disabled={submitting}
                  ariaLabel={t("fields.gender")}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="status"
                  className="text-petroleum-500 text-xs font-medium"
                >
                  {t("fields.type")}
                </label>
                <select
                  id="status"
                  value={status}
                  onChange={(e) =>
                    dispatch({
                      type: "SET_STATUS",
                      status: e.target.value as ContactStatus,
                    })
                  }
                  disabled={submitting}
                  className={INPUT_CLASS}
                >
                  <option value="lead">{t("typeOptions.lead")}</option>
                  <option value="client">{t("typeOptions.client")}</option>
                  <option value="member">{t("typeOptions.member")}</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="language"
                  className="text-petroleum-500 text-xs font-medium"
                >
                  {t("fields.preferredLanguage")}
                </label>
                <select
                  id="language"
                  value={language}
                  onChange={(e) =>
                    dispatch({
                      type: "SET_FIELD",
                      field: "language",
                      value: e.target.value,
                    })
                  }
                  disabled={submitting}
                  className={INPUT_CLASS}
                >
                  <option value="en">English</option>
                  <option value="es">Español</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
