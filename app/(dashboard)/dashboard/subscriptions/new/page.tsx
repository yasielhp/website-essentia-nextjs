"use client";

import { useState, useEffect, useReducer } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { notifySuccess } from "@/lib/feedback";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";
import { OptionSelect, type SelectOption } from "@/components/ui/option-select";
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

function PageHeader({ submitting }: { submitting: boolean }) {
  const t = useTranslations("dashboard.subscriptions.form");
  const tCommon = useTranslations("dashboard.common");
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <h1 className="font-display text-petroleum-700 text-3xl">{t("title")}</h1>
      <div className="flex items-center gap-3">
        <Button variant="outline" size="md" href="/dashboard/subscriptions">
          {tCommon("cancel")}
        </Button>
        <Button type="submit" variant="solid" size="md" disabled={submitting}>
          {submitting ? t("creating") : t("createSubscription")}
        </Button>
      </div>
    </div>
  );
}

type FormState = {
  plan: string;
  status: string;
  startDate: string;
  endDate: string;
  notes: string;
};

type FormAction =
  | { type: "SET_FIELD"; field: keyof FormState; value: string }
  | { type: "SET_PLAN"; value: string };

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "SET_PLAN":
      return { ...state, plan: action.value };
    default:
      return state;
  }
}

/**
 * Picking who the subscription is for.
 *
 * This replaced a search box plus a full set of name and email inputs. Those
 * inputs invited typing a person who already exists as a contact, producing a
 * membership that pointed at nobody — the insert never stored `contact_id`, it
 * only copied the text. Choosing an existing contact is the whole step.
 */
function SubscriberSection({
  contacts,
  contactId,
  onChange,
  loading,
  submitting,
}: {
  contacts: Contact[];
  contactId: string;
  onChange: (id: string) => void;
  loading: boolean;
  submitting: boolean;
}) {
  const t = useTranslations("dashboard.subscriptions.form");
  const options: SelectOption<string>[] = contacts.map((c) => ({
    value: c.id,
    label: [c.first_name, c.last_name].filter(Boolean).join(" ") || "—",
    desc: c.email ?? undefined,
  }));

  return (
    <div className="border-sand-200 rounded-2xl border bg-white p-6">
      <h2 className="text-petroleum-500 mb-1 text-sm font-semibold">
        {t("sections.member")}
      </h2>
      <p className="text-petroleum-400 mb-4 text-xs">{t("memberHint")}</p>
      {loading ? (
        <div className="bg-sand-100 h-14 animate-pulse rounded-xl" />
      ) : (
        <OptionSelect
          id="contact"
          value={contactId}
          options={options}
          onChange={onChange}
          disabled={submitting}
          placeholder={t("fields.contactPlaceholder")}
          ariaLabel={t("fields.contact")}
        />
      )}
    </div>
  );
}

type SubscriptionDetailsSectionProps = {
  form: FormState;
  dispatchForm: React.Dispatch<FormAction>;
  plans: Plan[];
  submitting: boolean;
};

function SubscriptionDetailsSection({
  form,
  dispatchForm,
  plans,
  submitting,
}: SubscriptionDetailsSectionProps) {
  const t = useTranslations("dashboard.subscriptions.form");
  const tStatus = useTranslations("dashboard.subscriptions.status");
  return (
    <div className="border-sand-200 rounded-2xl border bg-white p-6">
      <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
        {t("sections.subscription")}
      </h2>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="plan"
              className="text-petroleum-500 text-xs font-medium"
            >
              {t("fields.plan")}
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
              {t("fields.status")}
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
              <option value="active">{tStatus("active")}</option>
              <option value="expired">{tStatus("expired")}</option>
              <option value="cancelled">{tStatus("cancelled")}</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="startDate"
              className="text-petroleum-500 text-xs font-medium"
            >
              {t("fields.startDate")}
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
              {t("fields.endDate")}
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
            {t("fields.notes")}
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
            placeholder={t("fields.notesPlaceholder")}
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

export default function NewSubscriptionPage() {
  const t = useTranslations("dashboard.subscriptions.form");
  const tToasts = useTranslations("dashboard.toasts");
  const { push } = useRouter();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);

  const [contactId, setContactId] = useState("");
  const [contacts, setContacts] = useState<Contact[] | null>(null);

  const [form, dispatchForm] = useReducer(formReducer, {
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

  // Contacts to choose from. Loaded whole rather than searched as you type:
  // the select filters in the browser, and the list is small enough that one
  // query beats a request per keystroke.
  useEffect(() => {
    async function load() {
      const { data } = await insforge.database
        .from("contacts")
        .select("id, first_name, last_name, email, phone")
        .eq("status", "member")
        .order("first_name");
      setContacts((data as Contact[] | null) ?? []);
    }
    void load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const contact = (contacts ?? []).find((c) => c.id === contactId);
    if (!contact) {
      setError(t("errors.contactRequired"));
      return;
    }

    setSubmitting(true);

    // The reset lives in a `finally`: a rejected insert — a dropped
    // connection, a 500 — skipped the line below and left the form disabled
    // behind a spinner that never stopped.
    try {
      const { error: insertError } = await insforge.database
        .from("memberships")
        .insert([
          {
            // Both the link and the copy: `contact_id` is the relationship, the
            // rest is what the subscriptions list reads directly off this row.
            contact_id: contact.id,
            first_name: contact.first_name ?? "",
            last_name: contact.last_name ?? "",
            email: contact.email ?? null,
            phone: contact.phone ?? null,
            plan: form.plan,
            status: form.status,
            start_date: form.startDate || null,
            end_date: form.endDate || null,
            notes: form.notes.trim() || null,
          },
        ]);

      if (insertError) {
        setError(
          (insertError as { message?: string })?.message ??
            t("errors.createFailed"),
        );
        return;
      }
    } finally {
      setSubmitting(false);
    }

    notifySuccess(tToasts("subscriptionCreated"));
    push("/dashboard/subscriptions");
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
          <SubscriberSection
            contacts={contacts ?? []}
            contactId={contactId}
            onChange={setContactId}
            loading={contacts === null}
            submitting={submitting}
          />
          <SubscriptionDetailsSection
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
