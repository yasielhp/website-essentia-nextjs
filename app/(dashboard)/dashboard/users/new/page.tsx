"use client";

import { useReducer } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { notifySuccess } from "@/lib/feedback";
import { insforge } from "@/lib/insforge";
import { getAccessToken } from "@/lib/client-session";
import { createUserAccount } from "@/actions/create-user-account";
import { upsertStaffProfile } from "@/actions/upsert-staff-profile";
import { newDashboardPersonSchema, parseErrors } from "@/lib/schemas";
import { normalizeEmail, normalizePhone } from "@/utils/contact";
import { Button } from "@/components/ui/button";
import { OptionSelect, type SelectOption } from "@/components/ui/option-select";
import { toStoredGender } from "@/constants/gender";
import { PersonFields } from "./person-fields";
import {
  formReducer,
  initialState,
  isSystemRole,
  ROLE_VALUES,
  type NewUserKind,
} from "./form-state";

/**
 * What this form can create.
 *
 * `admin`/`staff`/`partner` are `profiles.role` values and come with an auth
 * account. `client` is not a role at all — it is a `contacts` row with
 * `status = 'client'` and no login. `member` is a `memberships` record that
 * needs a plan and dates, so this form only creates the underlying contact and
 * hands over to the membership screen.
 */
// ─── Page ─────────────────────────────────────────────────────

export default function NewUserPage() {
  const t = useTranslations("dashboard.users.form");
  const tToasts = useTranslations("dashboard.toasts");
  const tCommon = useTranslations("dashboard.common");
  const roles: SelectOption<NewUserKind>[] = ROLE_VALUES.map((value) => ({
    value,
    label: t(`roles.${value}.label`),
    desc: t(`roles.${value}.desc`),
  }));
  const { push } = useRouter();
  const [state, dispatch] = useReducer(formReducer, initialState);
  const {
    submitting,
    error,
    firstName,
    lastName,
    email,
    phone,
    gender,
    language,
    role,
  } = state;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    dispatch({ type: "CLEAR_ERROR" });

    const errors = parseErrors(newDashboardPersonSchema, {
      firstName,
      lastName,
      email,
      phone,
      gender,
      role,
    });
    if (Object.keys(errors).length > 0) {
      dispatch({ type: "SET_FIELD_ERRORS", errors });
      return;
    }

    dispatch({ type: "SUBMIT_START" });

    const trimFirst = firstName.trim();
    const normalizedEmail = normalizeEmail(email);
    const trimEmail = normalizedEmail ?? "";
    const trimPhone = normalizePhone(phone);
    const fullName = [trimFirst, lastName.trim()].filter(Boolean).join(" ");

    // Clients and members are contact records, not auth accounts.
    //
    // Upsert rather than insert: a lead is someone who started the booking form
    // and never finished, and they already occupy this email. Creating them as
    // a client from here promotes that existing row instead of colliding with
    // the unique email constraint.
    if (!isSystemRole(role)) {
      const { error: contactError } = await insforge.database
        .from("contacts")
        .upsert(
          {
            first_name: trimFirst,
            last_name: lastName.trim() || null,
            email: normalizedEmail,
            phone: trimPhone,
            gender: toStoredGender(gender),
            preferred_language: language,
            // Member is its own status: the subscription form only offers
            // contacts marked this way.
            status: role === "member" ? "member" : "client",
          },
          { onConflict: "email" },
        );

      if (contactError) {
        dispatch({
          type: "SUBMIT_ERROR",
          message:
            (contactError as { message?: string })?.message ??
            t("errors.contactFailed"),
        });
        return;
      }

      // A membership needs a plan, dates and a price, which live on their own
      // screen — send the user there to finish what they started.
      push(
        role === "member" ? "/dashboard/subscriptions/new" : "/dashboard/users",
      );
      return;
    }

    const tempPassword =
      "Essentia" + Math.random().toString(36).slice(2, 10).toUpperCase() + "!";

    // Created through an admin action rather than the browser's own auth: a
    // sign-up from here would hand this administrator the new user's session.
    const { userId: createdId, error: signUpError } = await createUserAccount(
      getAccessToken(),
      trimEmail,
      tempPassword,
      fullName,
    );

    let userId = createdId ?? undefined;

    if (!userId) {
      const errMsg = signUpError ?? "";
      if (errMsg.toLowerCase().includes("already")) {
        // Account exists in auth — look up the profile by email and update the role
        const { data: existing } = await insforge.database
          .from("profiles")
          .select("id")
          .eq("email", trimEmail)
          .maybeSingle();
        userId = (existing as { id: string } | null)?.id ?? undefined;
      }

      if (!userId) {
        dispatch({
          type: "SUBMIT_ERROR",
          message: errMsg || t("errors.accountFailed"),
        });
        return;
      }
    }

    // Through a Server Action rather than the browser client: `role` decides
    // who reaches the dashboard, so the write belongs where the caller's own
    // role is checked.
    const { error: profileError } = await upsertStaffProfile(getAccessToken(), {
      id: userId,
      role,
      firstName: trimFirst,
      lastName: lastName.trim() || null,
      fullName,
      email: trimEmail,
      phone: trimPhone,
      gender: toStoredGender(gender),
      preferredLanguage: language,
    });

    if (profileError) {
      dispatch({ type: "SUBMIT_ERROR", message: profileError });
      return;
    }

    notifySuccess(tToasts("userCreated"));
    push("/dashboard/users?tab=system");
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
              {submitting ? t("creating") : t("addUser")}
            </Button>
          </div>
        </div>

        {error && (
          <p className="mb-6 rounded-xl bg-red-100 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="grid grid-cols-1 gap-6">
          {/* Role */}
          <div className="border-sand-200 rounded-2xl border bg-white p-6">
            <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
              {t("sections.role")}
            </h2>
            <OptionSelect
              id="role"
              value={role}
              options={roles}
              onChange={(nextRole) =>
                dispatch({ type: "SET_ROLE", role: nextRole })
              }
              disabled={submitting}
              ariaLabel={t("fields.role")}
            />
          </div>

          {/* Details */}
          <PersonFields state={state} dispatch={dispatch} />
        </div>
      </form>
    </div>
  );
}
