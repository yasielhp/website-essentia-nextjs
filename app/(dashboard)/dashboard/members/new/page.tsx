"use client";

import { useState, useEffect, useRef, useReducer } from "react";
import { useRouter } from "next/navigation";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";
import {
  INPUT_CLASS,
  SELECT_CLASS,
  TEXTAREA_CLASS,
} from "@/constants/form-styles";

// ─── Types ────────────────────────────────────────────────────

type Plan = {
  id: string;
  label: string;
  price_monthly: number;
};

type Contact = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
};

// ─── Contact Search Reducer ───────────────────────────────────

type ContactSearchState = {
  query: string;
  results: Contact[];
  showDropdown: boolean;
  searching: boolean;
};

type ContactSearchAction =
  | { type: "SET_QUERY"; payload: string }
  | { type: "SEARCH_START" }
  | { type: "SEARCH_DONE"; payload: Contact[] }
  | { type: "CLEAR" }
  | { type: "CLOSE_DROPDOWN" }
  | { type: "OPEN_DROPDOWN" };

function contactSearchReducer(
  state: ContactSearchState,
  action: ContactSearchAction,
): ContactSearchState {
  switch (action.type) {
    case "SET_QUERY":
      return { ...state, query: action.payload };
    case "SEARCH_START":
      return { ...state, searching: true };
    case "SEARCH_DONE":
      return {
        ...state,
        results: action.payload,
        searching: false,
        showDropdown: true,
      };
    case "CLEAR":
      return { ...state, results: [], showDropdown: false };
    case "CLOSE_DROPDOWN":
      return { ...state, showDropdown: false };
    case "OPEN_DROPDOWN":
      return { ...state, showDropdown: true };
    default:
      return state;
  }
}

// ─── Form Reducer ─────────────────────────────────────────────

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  plan: string;
  status: string;
  startDate: string;
  endDate: string;
  notes: string;
};

type FormAction =
  | { type: "SET_FIELD"; field: keyof FormState; value: string }
  | { type: "SET_PLAN"; value: string }
  | {
      type: "FILL_CONTACT";
      payload: Pick<FormState, "firstName" | "lastName" | "email" | "phone">;
    };

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "SET_PLAN":
      return { ...state, plan: action.value };
    case "FILL_CONTACT":
      return { ...state, ...action.payload };
    default:
      return state;
  }
}

// ─── Sub-components ───────────────────────────────────────────

type PageHeaderProps = {
  submitting: boolean;
};

function PageHeader({ submitting }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <h1 className="font-display text-petroleum-700 text-3xl">New Member</h1>
      <div className="flex items-center gap-3">
        <Button variant="outline" size="md" href="/dashboard/members">
          Cancel
        </Button>
        <Button type="submit" variant="solid" size="md" disabled={submitting}>
          {submitting ? "Creating…" : "Create Member"}
        </Button>
      </div>
    </div>
  );
}

type ContactSearchSectionProps = {
  search: ContactSearchState;
  dispatchSearch: React.Dispatch<ContactSearchAction>;
  dropdownRef: React.RefObject<HTMLDivElement | null>;
  submitting: boolean;
  onSelectContact: (c: Contact) => void;
};

function ContactSearchSection({
  search,
  dispatchSearch,
  dropdownRef,
  submitting,
  onSelectContact,
}: ContactSearchSectionProps) {
  return (
    <div className="border-sand-200 rounded-2xl border bg-white p-6">
      <h2 className="text-petroleum-500 mb-1 text-sm font-semibold">
        Import from Contacts
      </h2>
      <p className="text-petroleum-400 mb-4 text-xs">
        Search an existing contact to pre-fill the form.
      </p>
      <div ref={dropdownRef} className="relative">
        <div className="relative">
          <input
            type="text"
            value={search.query}
            onChange={(e) =>
              dispatchSearch({
                type: "SET_QUERY",
                payload: e.target.value,
              })
            }
            onFocus={() => {
              if (search.results.length > 0)
                dispatchSearch({ type: "OPEN_DROPDOWN" });
            }}
            placeholder="Search by name or email…"
            className={INPUT_CLASS}
            disabled={submitting}
          />
          {search.searching && (
            <div className="absolute top-1/2 right-3 -translate-y-1/2">
              <div className="border-petroleum-400 size-4 animate-spin rounded-full border-2 border-t-transparent" />
            </div>
          )}
        </div>

        {search.showDropdown && search.results.length > 0 && (
          <div className="border-sand-200 absolute z-20 mt-1 w-full overflow-hidden rounded-xl border bg-white shadow-lg">
            {search.results.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelectContact(c)}
                className="hover:bg-sand-50 flex w-full items-center gap-3 px-4 py-3 text-left transition-colors"
              >
                <div className="bg-sand-100 flex size-8 shrink-0 items-center justify-center rounded-lg">
                  <span className="text-petroleum-400 text-xs font-medium">
                    {(c.first_name?.[0] ?? "?").toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-petroleum-700 truncate text-sm font-medium">
                    {c.first_name} {c.last_name}
                  </p>
                  {c.email && (
                    <p className="text-petroleum-400 truncate text-xs">
                      {c.email}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {search.showDropdown &&
          !search.searching &&
          search.results.length === 0 &&
          search.query.trim().length >= 2 && (
            <div className="border-sand-200 absolute z-20 mt-1 w-full rounded-xl border bg-white px-4 py-3 text-sm shadow-lg">
              <span className="text-petroleum-400">No contacts found.</span>
            </div>
          )}
      </div>
    </div>
  );
}

type PersonalInfoSectionProps = {
  form: FormState;
  dispatchForm: React.Dispatch<FormAction>;
  submitting: boolean;
};

function PersonalInfoSection({
  form,
  dispatchForm,
  submitting,
}: PersonalInfoSectionProps) {
  return (
    <div className="border-sand-200 rounded-2xl border bg-white p-6">
      <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
        Personal Information
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
              value={form.firstName}
              onChange={(e) =>
                dispatchForm({
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
              Last name <span className="text-red-400">*</span>
            </label>
            <input
              id="lastName"
              type="text"
              value={form.lastName}
              onChange={(e) =>
                dispatchForm({
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="email"
              className="text-petroleum-500 text-xs font-medium"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) =>
                dispatchForm({
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
              value={form.phone}
              onChange={(e) =>
                dispatchForm({
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
  );
}

type MembershipDetailsSectionProps = {
  form: FormState;
  dispatchForm: React.Dispatch<FormAction>;
  plans: Plan[];
  submitting: boolean;
};

function MembershipDetailsSection({
  form,
  dispatchForm,
  plans,
  submitting,
}: MembershipDetailsSectionProps) {
  return (
    <div className="border-sand-200 rounded-2xl border bg-white p-6">
      <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
        Membership
      </h2>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="plan"
              className="text-petroleum-500 text-xs font-medium"
            >
              Plan
            </label>
            <select
              id="plan"
              value={form.plan}
              onChange={(e) =>
                dispatchForm({
                  type: "SET_FIELD",
                  field: "plan",
                  value: e.target.value,
                })
              }
              disabled={submitting || plans.length === 0}
              className={SELECT_CLASS}
            >
              {plans.length === 0 && <option value="">Loading plans…</option>}
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}: €{p.price_monthly}/mo
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="status"
              className="text-petroleum-500 text-xs font-medium"
            >
              Status
            </label>
            <select
              id="status"
              value={form.status}
              onChange={(e) =>
                dispatchForm({
                  type: "SET_FIELD",
                  field: "status",
                  value: e.target.value,
                })
              }
              disabled={submitting}
              className={SELECT_CLASS}
            >
              <option value="active">Active</option>
              <option value="expired">Expired</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="startDate"
              className="text-petroleum-500 text-xs font-medium"
            >
              Start date
            </label>
            <input
              id="startDate"
              type="date"
              value={form.startDate}
              onChange={(e) =>
                dispatchForm({
                  type: "SET_FIELD",
                  field: "startDate",
                  value: e.target.value,
                })
              }
              disabled={submitting}
              className={INPUT_CLASS}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="endDate"
              className="text-petroleum-500 text-xs font-medium"
            >
              Expiry date
            </label>
            <input
              id="endDate"
              type="date"
              value={form.endDate}
              onChange={(e) =>
                dispatchForm({
                  type: "SET_FIELD",
                  field: "endDate",
                  value: e.target.value,
                })
              }
              disabled={submitting}
              className={INPUT_CLASS}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="notes"
            className="text-petroleum-500 text-xs font-medium"
          >
            Notes
          </label>
          <textarea
            id="notes"
            value={form.notes}
            onChange={(e) =>
              dispatchForm({
                type: "SET_FIELD",
                field: "notes",
                value: e.target.value,
              })
            }
            placeholder="Additional notes…"
            rows={3}
            disabled={submitting}
            className={TEXTAREA_CLASS}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function NewMemberPage() {
  const { push } = useRouter();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const [search, dispatchSearch] = useReducer(contactSearchReducer, {
    query: "",
    results: [],
    showDropdown: false,
    searching: false,
  });

  const [form, dispatchForm] = useReducer(formReducer, {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    plan: "",
    status: "active",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: "",
    notes: "",
  });

  // Load membership plans from DB on mount
  useEffect(() => {
    async function load() {
      const { data } = await insforge.database
        .from("membership_plans")
        .select("id, label, price_monthly")
        .eq("active", true)
        .order("price_monthly");
      const rows = (data as Plan[] | null) ?? [];
      setPlans(rows);
      if (rows.length > 0 && rows[0])
        dispatchForm({ type: "SET_PLAN", value: rows[0].id });
    }
    void load();
  }, []);

  // Contact search with debounce
  useEffect(() => {
    const q = search.query.trim();

    if (q.length < 2) {
      dispatchSearch({ type: "CLEAR" });
      return;
    }

    const timer = setTimeout(async () => {
      dispatchSearch({ type: "SEARCH_START" });
      const { data } = await insforge.database
        .from("contacts")
        .select("id, first_name, last_name, email, phone")
        .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(8);
      dispatchSearch({
        type: "SEARCH_DONE",
        payload: (data as Contact[] | null) ?? [],
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [search.query]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        dispatchSearch({ type: "CLOSE_DROPDOWN" });
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function selectContact(c: Contact) {
    dispatchForm({
      type: "FILL_CONTACT",
      payload: {
        firstName: c.first_name ?? "",
        lastName: c.last_name ?? "",
        email: c.email ?? "",
        phone: c.phone ?? "",
      },
    });
    dispatchSearch({
      type: "SET_QUERY",
      payload:
        `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || (c.email ?? ""),
    });
    dispatchSearch({ type: "CLOSE_DROPDOWN" });
    dispatchSearch({ type: "CLEAR" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.firstName.trim()) {
      setError("First name is required.");
      return;
    }
    if (!form.lastName.trim()) {
      setError("Last name is required.");
      return;
    }

    setSubmitting(true);

    const { error: insertError } = await insforge.database
      .from("memberships")
      .insert([
        {
          first_name: form.firstName.trim(),
          last_name: form.lastName.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          plan: form.plan,
          status: form.status,
          start_date: form.startDate || null,
          end_date: form.endDate || null,
          notes: form.notes.trim() || null,
        },
      ]);

    setSubmitting(false);

    if (insertError) {
      setError(
        (insertError as { message?: string })?.message ??
          "Failed to create member.",
      );
      return;
    }

    push("/dashboard/members");
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      <form onSubmit={(e) => void handleSubmit(e)} noValidate>
        <PageHeader submitting={submitting} />

        {error && (
          <p className="mb-6 rounded-xl bg-red-100 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="space-y-6">
          <ContactSearchSection
            search={search}
            dispatchSearch={dispatchSearch}
            dropdownRef={dropdownRef}
            submitting={submitting}
            onSelectContact={selectContact}
          />
          <PersonalInfoSection
            form={form}
            dispatchForm={dispatchForm}
            submitting={submitting}
          />
          <MembershipDetailsSection
            form={form}
            dispatchForm={dispatchForm}
            plans={plans}
            submitting={submitting}
          />
        </div>
      </form>
    </div>
  );
}
