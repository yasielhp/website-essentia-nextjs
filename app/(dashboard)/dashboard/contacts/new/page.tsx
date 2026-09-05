"use client";

import { useReducer } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { notifySuccess } from "@/lib/feedback";
import { insforge } from "@/lib/insforge";
import { dashboardContactSchema, parseErrors } from "@/lib/schemas";
import { normalizeEmail, normalizePhone } from "@/utils/contact";
import { Button } from "@/components/ui/button";
import { toStoredGender } from "@/constants/gender";
import { ContactFields } from "./contact-fields";
import { formReducer, initialFormState } from "./form-state";

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export default function NewContactPage() {
  const t = useTranslations("dashboard.contacts.form");
  const tToasts = useTranslations("dashboard.toasts");
  const tCommon = useTranslations("dashboard.common");
  const { push } = useRouter();
  const [state, dispatch] = useReducer(formReducer, initialFormState);
  const {
    submitting,
    error,
    firstName,
    lastName,
    email,
    phone,
    language,
    gender,
    status,
    newsletter,
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
          // Only ever set to true: a form left untouched says nothing about
          // a consent the client may have given before.
          ...(newsletter
            ? {
                newsletter_subscribed: true,
                newsletter_subscribed_at: new Date().toISOString(),
              }
            : {}),
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
          <ContactFields state={state} dispatch={dispatch} />
        </div>
      </form>
    </div>
  );
}
