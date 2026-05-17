"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────

type Service = { id: string; title: string };

type Tier = {
  id: string;
  label: string | null;
  duration_minutes: number | null;
  price_eur: number | null;
  color: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────

function tierLabel(t: Tier): string {
  const parts: string[] = [];
  if (t.label) parts.push(t.label);
  if (t.duration_minutes != null) parts.push(`${t.duration_minutes} min`);
  if (t.price_eur != null) parts.push(`€${t.price_eur}`);
  return parts.join(" · ") || "Standard";
}

// ─── Styles ───────────────────────────────────────────────────

const INPUT_CLASS =
  "border-sand-200 bg-white text-petroleum-700 placeholder:text-petroleum-300 focus:border-petroleum-400 focus:ring-petroleum-100 rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 w-full disabled:opacity-60";

const SELECT_CLASS =
  "border-sand-200 bg-white text-petroleum-700 focus:border-petroleum-400 focus:ring-petroleum-100 rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 w-full disabled:opacity-60";

// ─── Page ─────────────────────────────────────────────────────

export default function NewBookingPage() {
  const { push } = useRouter();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Services (loaded from DB — active only)
  const [services, setServices] = useState<Service[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);

  // Tiers for selected service
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [tiersLoading, setTiersLoading] = useState(false);

  // Form values
  const [serviceId, setServiceId] = useState("");
  const [tierId, setTierId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // Derived from selected tier
  const selectedTier = tiers.find((t) => t.id === tierId) ?? null;
  const selectedService = services.find((s) => s.id === serviceId) ?? null;

  // Load active services on mount
  useEffect(() => {
    async function load() {
      setServicesLoading(true);
      const { data } = await insforge.database
        .from("service_settings")
        .select("id, title")
        .eq("active", true)
        .order("title");
      setServices((data as Service[] | null) ?? []);
      setServicesLoading(false);
    }
    void load();
  }, []);

  // Load tiers when service changes
  useEffect(() => {
    async function load() {
      if (!serviceId) {
        setTiers([]);
        setTierId("");
        return;
      }
      setTiersLoading(true);
      setTierId("");
      const { data } = await insforge.database
        .from("service_tiers")
        .select("id, label, duration_minutes, price_eur, color")
        .eq("service_id", serviceId)
        .eq("active", true)
        .order("sort_order");
      const rows = (data as Tier[] | null) ?? [];
      setTiers(rows);
      if (rows.length === 1) setTierId(rows[0]!.id);
      setTiersLoading(false);
    }
    void load();
  }, [serviceId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!serviceId) {
      setError("Please select a service.");
      return;
    }
    if (!firstName.trim()) {
      setError("First name is required.");
      return;
    }
    if (!email.trim()) {
      setError("Email is required.");
      return;
    }

    setSubmitting(true);

    const durationText =
      selectedTier?.duration_minutes != null
        ? `${selectedTier.duration_minutes} min`
        : null;

    const { error: insertError } = await insforge.database
      .from("bookings")
      .insert([
        {
          service_id: serviceId,
          service_title: selectedService?.title ?? serviceId,
          tier_id: tierId || null,
          price_eur: selectedTier?.price_eur ?? null,
          duration: durationText,
          date: date || null,
          time: time || null,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          status: "pending",
        },
      ]);

    setSubmitting(false);

    if (insertError) {
      setError(
        (insertError as { message?: string })?.message ??
          "Failed to create booking.",
      );
      return;
    }

    push("/dashboard/bookings");
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      <form onSubmit={(e) => void handleSubmit(e)} noValidate>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-display text-petroleum-700 text-3xl">
            New Booking
          </h1>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="md" href="/dashboard/bookings">
              Cancel
            </Button>
            <Button
              type="submit"
              variant="solid"
              size="md"
              disabled={submitting}
            >
              {submitting ? "Creating…" : "Create Booking"}
            </Button>
          </div>
        </div>

        {error && (
          <p className="mb-6 rounded-xl bg-red-100 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="space-y-6">
          {/* Service & Schedule */}
          <div className="border-sand-200 rounded-2xl border bg-white p-6">
            <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
              Service & Schedule
            </h2>
            <div className="space-y-4">
              {/* Service selector */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="service"
                  className="text-petroleum-500 text-xs font-medium"
                >
                  Service <span className="text-red-400">*</span>
                </label>
                {servicesLoading ? (
                  <div className="border-sand-200 bg-sand-50 h-12 animate-pulse rounded-xl border" />
                ) : (
                  <select
                    id="service"
                    value={serviceId}
                    onChange={(e) => setServiceId(e.target.value)}
                    disabled={submitting}
                    className={SELECT_CLASS}
                  >
                    <option value="">Select a service…</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Tier selector — only shown when service has tiers */}
              {serviceId && (
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="tier"
                    className="text-petroleum-500 text-xs font-medium"
                  >
                    Duration & price
                  </label>
                  {tiersLoading ? (
                    <div className="border-sand-200 bg-sand-50 h-12 animate-pulse rounded-xl border" />
                  ) : tiers.length === 0 ? (
                    <p className="text-petroleum-300 border-sand-200 rounded-xl border border-dashed px-4 py-3 text-sm">
                      No tiers configured for this service — add them in
                      Settings → Services.
                    </p>
                  ) : (
                    <select
                      id="tier"
                      value={tierId}
                      onChange={(e) => setTierId(e.target.value)}
                      disabled={submitting}
                      className={SELECT_CLASS}
                    >
                      <option value="">Select a tier…</option>
                      {tiers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {tierLabel(t)}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Selected tier summary */}
                  {selectedTier && (
                    <div className="bg-sand-50 flex items-center gap-4 rounded-xl px-4 py-2.5">
                      {selectedTier.duration_minutes != null && (
                        <span className="text-petroleum-500 text-sm">
                          <span className="text-petroleum-400 mr-1 text-xs">
                            Duration
                          </span>
                          {selectedTier.duration_minutes} min
                        </span>
                      )}
                      {selectedTier.price_eur != null && (
                        <span className="text-petroleum-500 text-sm">
                          <span className="text-petroleum-400 mr-1 text-xs">
                            Price
                          </span>
                          €{selectedTier.price_eur}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Date + time */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="date"
                    className="text-petroleum-500 text-xs font-medium"
                  >
                    Date
                  </label>
                  <input
                    id="date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    disabled={submitting}
                    className={INPUT_CLASS}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="time"
                    className="text-petroleum-500 text-xs font-medium"
                  >
                    Time
                  </label>
                  <input
                    id="time"
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    disabled={submitting}
                    className={INPUT_CLASS}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Client */}
          <div className="border-sand-200 rounded-2xl border bg-white p-6">
            <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
              Client
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
                    Last name
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
      </form>
    </div>
  );
}
