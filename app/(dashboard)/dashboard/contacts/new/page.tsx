"use client";

import { useReducer } from "react";
import { useRouter } from "next/navigation";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";

const INPUT_CLASS =
  "border-sand-200 bg-white text-petroleum-700 placeholder:text-petroleum-300 focus:border-petroleum-400 focus:ring-petroleum-100 rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 w-full disabled:opacity-60";

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

type FormState = {
  submitting: boolean;
  error: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  language: string;
};

type FormAction =
  | {
      type: "SET_FIELD";
      field: "firstName" | "lastName" | "email" | "phone" | "language";
      value: string;
    }
  | { type: "SUBMIT_START" }
  | { type: "SUBMIT_ERROR"; message: string }
  | { type: "CLEAR_ERROR" };

const initialFormState: FormState = {
  submitting: false,
  error: null,
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  language: "en",
};

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
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
  const { push } = useRouter();
  const [state, dispatch] = useReducer(formReducer, initialFormState);
  const { submitting, error, firstName, lastName, email, phone, language } =
    state;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    dispatch({ type: "CLEAR_ERROR" });

    const trimmedFirst = firstName.trim();
    const trimmedEmail = email.trim();

    if (!trimmedFirst || !trimmedEmail) {
      dispatch({
        type: "SUBMIT_ERROR",
        message: "First name and email are required.",
      });
      return;
    }

    dispatch({ type: "SUBMIT_START" });

    const { error: insertError } = await insforge.database
      .from("contacts")
      .insert([
        {
          first_name: trimmedFirst,
          last_name: lastName.trim() || null,
          email: trimmedEmail,
          phone: phone.trim() || null,
          preferred_language: language === "es" ? "es" : "en",
        },
      ]);

    if (insertError) {
      dispatch({
        type: "SUBMIT_ERROR",
        message:
          (insertError as { message?: string })?.message ??
          "Failed to create contact.",
      });
      return;
    }

    push("/dashboard/contacts");
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      <form onSubmit={(e) => void handleSubmit(e)} noValidate>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-petroleum-700 text-3xl">
              New Contact
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" size="md" href="/dashboard/contacts">
              Cancel
            </Button>
            <Button
              type="submit"
              variant="solid"
              size="md"
              disabled={submitting}
            >
              {submitting ? "Creating…" : "Add Contact"}
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
                  placeholder="jane@example.com"
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

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="language"
                  className="text-petroleum-500 text-xs font-medium"
                >
                  Preferred language
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
