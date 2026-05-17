"use client";

import { useState, useEffect, useRef } from "react";
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

// ─── Page ─────────────────────────────────────────────────────

export default function NewMemberPage() {
  const { push } = useRouter();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Plans (loaded from DB)
  const [plans, setPlans] = useState<Plan[]>([]);

  // Contact search
  const [contactSearch, setContactSearch] = useState("");
  const [contactResults, setContactResults] = useState<Contact[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [contactSearching, setContactSearching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Form fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [plan, setPlan] = useState("");
  const [status, setStatus] = useState("active");
  const [startDate, setStartDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");

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
      if (rows.length > 0 && rows[0]) setPlan(rows[0].id);
    }
    void load();
  }, []);

  // Contact search with debounce
  useEffect(() => {
    const q = contactSearch.trim();

    async function clear() {
      setContactResults([]);
      setShowDropdown(false);
    }

    async function search() {
      setContactSearching(true);
      const { data } = await insforge.database
        .from("contacts")
        .select("id, first_name, last_name, email, phone")
        .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(8);
      setContactResults((data as Contact[] | null) ?? []);
      setContactSearching(false);
      setShowDropdown(true);
    }

    if (q.length < 2) {
      void clear();
      return;
    }

    const timer = setTimeout(() => void search(), 300);
    return () => clearTimeout(timer);
  }, [contactSearch]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function selectContact(c: Contact) {
    setFirstName(c.first_name ?? "");
    setLastName(c.last_name ?? "");
    setEmail(c.email ?? "");
    setPhone(c.phone ?? "");
    setContactSearch(
      `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || (c.email ?? ""),
    );
    setShowDropdown(false);
    setContactResults([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!firstName.trim()) {
      setError("First name is required.");
      return;
    }
    if (!lastName.trim()) {
      setError("Last name is required.");
      return;
    }

    setSubmitting(true);

    const { error: insertError } = await insforge.database
      .from("memberships")
      .insert([
        {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          plan,
          status,
          start_date: startDate || null,
          end_date: endDate || null,
          notes: notes.trim() || null,
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
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-display text-petroleum-700 text-3xl">
            New Member
          </h1>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="md" href="/dashboard/members">
              Cancel
            </Button>
            <Button
              type="submit"
              variant="solid"
              size="md"
              disabled={submitting}
            >
              {submitting ? "Creating…" : "Create Member"}
            </Button>
          </div>
        </div>

        {error && (
          <p className="mb-6 rounded-xl bg-red-100 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="space-y-6">
          {/* Contact search */}
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
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  onFocus={() => {
                    if (contactResults.length > 0) setShowDropdown(true);
                  }}
                  placeholder="Search by name or email…"
                  className={INPUT_CLASS}
                  disabled={submitting}
                />
                {contactSearching && (
                  <div className="absolute top-1/2 right-3 -translate-y-1/2">
                    <div className="border-petroleum-400 size-4 animate-spin rounded-full border-2 border-t-transparent" />
                  </div>
                )}
              </div>

              {showDropdown && contactResults.length > 0 && (
                <div className="border-sand-200 absolute z-20 mt-1 w-full overflow-hidden rounded-xl border bg-white shadow-lg">
                  {contactResults.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectContact(c)}
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

              {showDropdown &&
                !contactSearching &&
                contactResults.length === 0 &&
                contactSearch.trim().length >= 2 && (
                  <div className="border-sand-200 absolute z-20 mt-1 w-full rounded-xl border bg-white px-4 py-3 text-sm shadow-lg">
                    <span className="text-petroleum-400">
                      No contacts found.
                    </span>
                  </div>
                )}
            </div>
          </div>

          {/* Personal info */}
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
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
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
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
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
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
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
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+34 600 000 000"
                    disabled={submitting}
                    className={INPUT_CLASS}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Membership details */}
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
                    value={plan}
                    onChange={(e) => setPlan(e.target.value)}
                    disabled={submitting || plans.length === 0}
                    className={SELECT_CLASS}
                  >
                    {plans.length === 0 && (
                      <option value="">Loading plans…</option>
                    )}
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label} — €{p.price_monthly}/mo
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
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
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
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
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
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
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
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes…"
                  rows={3}
                  disabled={submitting}
                  className={TEXTAREA_CLASS}
                />
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
