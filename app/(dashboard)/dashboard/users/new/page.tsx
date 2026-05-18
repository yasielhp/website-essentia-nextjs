"use client";

import { useReducer } from "react";
import { useRouter } from "next/navigation";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";
import { INPUT_CLASS } from "@/constants/form-styles";

type SystemRole = "admin" | "staff" | "partner";

// ─── Form state ───────────────────────────────────────────────

type FormState = {
  submitting: boolean;
  error: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: SystemRole;
};

type FormAction =
  | {
      type: "SET_FIELD";
      field: "firstName" | "lastName" | "email" | "phone";
      value: string;
    }
  | { type: "SET_ROLE"; role: SystemRole }
  | { type: "SUBMIT_START" }
  | { type: "SUBMIT_ERROR"; message: string }
  | { type: "CLEAR_ERROR" };

const initialState: FormState = {
  submitting: false,
  error: null,
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  role: "staff",
};

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "SET_ROLE":
      return { ...state, role: action.role };
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

const ROLES: { value: SystemRole; label: string; desc: string }[] = [
  { value: "admin", label: "Admin", desc: "Full access" },
  { value: "staff", label: "Staff", desc: "Dashboard access" },
  { value: "partner", label: "Partner", desc: "Hotel bookings only" },
];

export default function NewUserPage() {
  const { push } = useRouter();
  const [state, dispatch] = useReducer(formReducer, initialState);
  const { submitting, error, firstName, lastName, email, phone, role } = state;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    dispatch({ type: "CLEAR_ERROR" });

    const trimFirst = firstName.trim();
    const trimEmail = email.trim();

    if (!trimFirst || !trimEmail) {
      dispatch({
        type: "SUBMIT_ERROR",
        message: "First name and email are required.",
      });
      return;
    }

    dispatch({ type: "SUBMIT_START" });

    const fullName = [trimFirst, lastName.trim()].filter(Boolean).join(" ");
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
        phone: phone.trim() || null,
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
            <div className="grid grid-cols-3 gap-3">
              {ROLES.map((r) => {
                const selected = role === r.value;
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() =>
                      dispatch({ type: "SET_ROLE", role: r.value })
                    }
                    disabled={submitting}
                    className={`flex flex-col items-start rounded-xl border px-4 py-3 text-left transition-colors ${
                      selected
                        ? "border-petroleum-400 bg-petroleum-50"
                        : "border-sand-200 hover:border-sand-300 hover:bg-sand-50"
                    }`}
                  >
                    <span
                      className={`text-sm font-semibold ${selected ? "text-petroleum-700" : "text-petroleum-500"}`}
                    >
                      {r.label}
                    </span>
                    <span className="text-petroleum-400 mt-0.5 text-xs">
                      {r.desc}
                    </span>
                  </button>
                );
              })}
            </div>
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
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
