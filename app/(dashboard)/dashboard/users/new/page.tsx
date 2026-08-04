"use client";

import { useReducer } from "react";
import { useRouter } from "next/navigation";
import { insforge } from "@/lib/insforge";
import {
  newDashboardPersonSchema,
  parseErrors,
  type FormErrors,
} from "@/lib/schemas";
import { normalizeEmail, normalizePhone } from "@/utils/contact";
import { Button } from "@/components/ui/button";
import { INPUT_CLASS } from "@/constants/form-styles";
import { OptionSelect, type SelectOption } from "@/components/ui/option-select";
import {
  GENDER_OPTIONS,
  toStoredGender,
  type GenderValue,
} from "@/constants/gender";

/**
 * What this form can create.
 *
 * `admin`/`staff`/`partner` are `profiles.role` values and come with an auth
 * account. `client` is not a role at all — it is a `contacts` row with
 * `status = 'client'` and no login. `member` is a `memberships` record that
 * needs a plan and dates, so this form only creates the underlying contact and
 * hands over to the membership screen.
 */
type NewUserKind = "admin" | "staff" | "partner" | "client" | "member";

type SystemRole = "admin" | "staff" | "partner";

const SYSTEM_ROLES: SystemRole[] = ["admin", "staff", "partner"];

function isSystemRole(kind: NewUserKind): kind is SystemRole {
  return (SYSTEM_ROLES as NewUserKind[]).includes(kind);
}

// ─── Form state ───────────────────────────────────────────────

type PersonErrors = FormErrors<typeof newDashboardPersonSchema>;

type FormState = {
  submitting: boolean;
  error: string | null;
  fieldErrors: PersonErrors;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gender: GenderValue;
  role: NewUserKind;
};

type FormAction =
  | {
      type: "SET_FIELD";
      field: "firstName" | "lastName" | "email" | "phone";
      value: string;
    }
  | { type: "SET_ROLE"; role: NewUserKind }
  | { type: "SET_GENDER"; gender: GenderValue }
  | { type: "SUBMIT_START" }
  | { type: "SUBMIT_ERROR"; message: string }
  | { type: "SET_FIELD_ERRORS"; errors: PersonErrors }
  | { type: "CLEAR_ERROR" };

const ROLES: SelectOption<NewUserKind>[] = [
  { value: "client", label: "Client", desc: "Contact record, no login" },
  {
    value: "member",
    label: "Member",
    desc: "Entitled to a subscription",
  },
  { value: "staff", label: "Staff", desc: "Dashboard access" },
  { value: "partner", label: "Partner", desc: "Hotel bookings only" },
  { value: "admin", label: "Admin", desc: "Full dashboard access" },
];

/** Keeps the default in step with whatever ROLES lists first. */
const ROLES_DEFAULT: NewUserKind = ROLES[0]!.value;

const initialState: FormState = {
  submitting: false,
  error: null,
  fieldErrors: {},
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  gender: "",
  // The first option in ROLES, so the form opens on what the list shows first
  // rather than on a different choice further down.
  role: ROLES_DEFAULT,
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
    case "SET_ROLE":
      return { ...state, role: action.role };
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

// ─── Page ─────────────────────────────────────────────────────

export default function NewUserPage() {
  const { push } = useRouter();
  const [state, dispatch] = useReducer(formReducer, initialState);
  const {
    submitting,
    error,
    fieldErrors,
    firstName,
    lastName,
    email,
    phone,
    gender,
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
            "Failed to create contact.",
        });
        return;
      }

      // A membership needs a plan, dates and a price, which live on their own
      // screen — send the user there to finish what they started.
      push(role === "member" ? "/dashboard/members/new" : "/dashboard/users");
      return;
    }

    const tempPassword =
      "Essentia" + Math.random().toString(36).slice(2, 10).toUpperCase() + "!";

    const { data: authData, error: signUpError } = await insforge.auth.signUp({
      email: trimEmail,
      password: tempPassword,
      name: fullName,
      redirectTo: `${window.location.origin}/dashboard`,
    });

    let userId = (authData as { user?: { id: string } } | null)?.user?.id;

    if (!userId) {
      const errMsg =
        (signUpError as { message?: string } | null)?.message ?? "";
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
          message: errMsg || "Failed to create account.",
        });
        return;
      }
    }

    await insforge.database.from("profiles").upsert([
      {
        id: userId,
        role,
        first_name: trimFirst,
        last_name: lastName.trim() || null,
        full_name: fullName,
        email: trimEmail,
        phone: trimPhone,
        gender: toStoredGender(gender),
      },
    ]);

    push("/dashboard/users?tab=system");
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      <form onSubmit={(e) => void handleSubmit(e)} noValidate>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-petroleum-700 text-3xl">
              New User
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="md" href="/dashboard/users">
              Cancel
            </Button>
            <Button
              type="submit"
              variant="solid"
              size="md"
              disabled={submitting}
            >
              {submitting ? "Creating…" : "Add User"}
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
              Role
            </h2>
            <OptionSelect
              id="role"
              value={role}
              options={ROLES}
              onChange={(nextRole) =>
                dispatch({ type: "SET_ROLE", role: nextRole })
              }
              disabled={submitting}
              ariaLabel="Role"
            />
          </div>

          {/* Details */}
          <div className="border-sand-200 rounded-2xl border bg-white p-6">
            <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
              Details
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="firstName"
                    className="text-petroleum-500 text-xs font-medium"
                  >
                    First name <span className="text-red-400">*</span>
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
                    placeholder="Jane"
                    disabled={submitting}
                    className={INPUT_CLASS}
                  />
                  {fieldErrors.firstName && (
                    <p className="text-xs text-red-500">
                      {fieldErrors.firstName}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="lastName"
                    className="text-petroleum-500 text-xs font-medium"
                  >
                    Last name
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
                    placeholder="Doe"
                    disabled={submitting}
                    className={INPUT_CLASS}
                  />
                  {fieldErrors.lastName && (
                    <p className="text-xs text-red-500">
                      {fieldErrors.lastName}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="email"
                  className="text-petroleum-500 text-xs font-medium"
                >
                  Email <span className="text-red-400">*</span>
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
                  placeholder="jane@essentia.com"
                  disabled={submitting}
                  className={INPUT_CLASS}
                />
                {fieldErrors.email && (
                  <p className="text-xs text-red-500">{fieldErrors.email}</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="phone"
                  className="text-petroleum-500 text-xs font-medium"
                >
                  Phone
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
                  placeholder="+34 600 000 000"
                  disabled={submitting}
                  className={INPUT_CLASS}
                />
                {fieldErrors.phone && (
                  <p className="text-xs text-red-500">{fieldErrors.phone}</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="gender"
                  className="text-petroleum-500 text-xs font-medium"
                >
                  Gender
                </label>
                <OptionSelect
                  id="gender"
                  value={gender}
                  options={GENDER_OPTIONS}
                  onChange={(next) =>
                    dispatch({ type: "SET_GENDER", gender: next })
                  }
                  disabled={submitting}
                  ariaLabel="Gender"
                />
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
