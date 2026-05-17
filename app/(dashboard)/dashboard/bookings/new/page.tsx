"use client";

import { useReducer, useEffect } from "react";
import { useRouter } from "next/navigation";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";
import { INPUT_CLASS, SELECT_CLASS } from "@/constants/form-styles";

// ─── Types ────────────────────────────────────────────────────

type Service = { id: string; title: string };

type Tier = {
  id: string;
  label: string | null;
  duration_minutes: number | null;
  price_eur: number | null;
  color: string | null;
};

// ─── Async state ──────────────────────────────────────────────

type AsyncState = {
  submitting: boolean;
  error: string | null;
  services: Service[];
  servicesLoading: boolean;
  tiers: Tier[];
  tiersLoading: boolean;
};

type AsyncAction =
  | { type: "SERVICES_LOADING" }
  | { type: "SERVICES_LOADED"; payload: Service[] }
  | { type: "TIERS_LOADING" }
  | { type: "TIERS_LOADED"; payload: Tier[] }
  | { type: "SUBMIT_START" }
  | { type: "SUBMIT_END" }
  | { type: "SET_ERROR"; payload: string | null };

const asyncInitial: AsyncState = {
  submitting: false,
  error: null,
  services: [],
  servicesLoading: true,
  tiers: [],
  tiersLoading: false,
};

function asyncReducer(state: AsyncState, action: AsyncAction): AsyncState {
  switch (action.type) {
    case "SERVICES_LOADING":
      return { ...state, servicesLoading: true };
    case "SERVICES_LOADED":
      return { ...state, services: action.payload, servicesLoading: false };
    case "TIERS_LOADING":
      return { ...state, tiersLoading: true };
    case "TIERS_LOADED":
      return { ...state, tiers: action.payload, tiersLoading: false };
    case "SUBMIT_START":
      return { ...state, submitting: true };
    case "SUBMIT_END":
      return { ...state, submitting: false };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    default:
      return state;
  }
}

// ─── Form state ───────────────────────────────────────────────

type FormState = {
  serviceId: string;
  tierId: string;
  date: string;
  time: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

type FormAction =
  | { type: "SET_FIELD"; field: keyof FormState; value: string }
  | { type: "RESET_TIER" }
  | { type: "RESET_TIERS_FOR_SERVICE" };

const formInitial: FormState = {
  serviceId: "",
  tierId: "",
  date: "",
  time: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
};

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "RESET_TIER":
      return { ...state, tierId: "" };
    case "RESET_TIERS_FOR_SERVICE":
      return { ...state, tierId: "" };
    default:
      return state;
  }
}

// ─── Helpers ──────────────────────────────────────────────────

function tierLabel(t: Tier): string {
  const parts: string[] = [];
  if (t.label) parts.push(t.label);
  if (t.duration_minutes != null) parts.push(`${t.duration_minutes} min`);
  if (t.price_eur != null) parts.push(`€${t.price_eur}`);
  return parts.join(" · ") || "Standard";
}

// ─── Page ─────────────────────────────────────────────────────

export default function NewBookingPage() {
  const { push } = useRouter();

  const [async_, dispatchAsync] = useReducer(asyncReducer, asyncInitial);
  const [form, dispatchForm] = useReducer(formReducer, formInitial);

  const { submitting, error, services, servicesLoading, tiers, tiersLoading } =
    async_;
  const { serviceId, tierId, date, time, firstName, lastName, email, phone } =
    form;

  // Derived from selected tier
  const selectedTier = tiers.find((t) => t.id === tierId) ?? null;
  const selectedService = services.find((s) => s.id === serviceId) ?? null;

  // Load active services on mount
  useEffect(() => {
    async function load() {
      dispatchAsync({ type: "SERVICES_LOADING" });
      const { data } = await insforge.database
        .from("service_settings")
        .select("id, title")
        .eq("active", true)
        .order("title");
      dispatchAsync({
        type: "SERVICES_LOADED",
        payload: (data as Service[] | null) ?? [],
      });
    }
    void load();
  }, []);

  // Load tiers when service changes
  useEffect(() => {
    async function load() {
      if (!serviceId) {
        dispatchAsync({ type: "TIERS_LOADED", payload: [] });
        dispatchForm({ type: "RESET_TIER" });
        return;
      }
      dispatchAsync({ type: "TIERS_LOADING" });
      dispatchForm({ type: "RESET_TIERS_FOR_SERVICE" });
      const { data } = await insforge.database
        .from("service_tiers")
        .select("id, label, duration_minutes, price_eur, color")
        .eq("service_id", serviceId)
        .eq("active", true)
        .order("sort_order");
      const rows = (data as Tier[] | null) ?? [];
      dispatchAsync({ type: "TIERS_LOADED", payload: rows });
      if (rows.length === 1) {
        dispatchForm({
          type: "SET_FIELD",
          field: "tierId",
          value: rows[0]!.id,
        });
      }
    }
    void load();
  }, [serviceId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    dispatchAsync({ type: "SET_ERROR", payload: null });

    if (!serviceId) {
      dispatchAsync({
        type: "SET_ERROR",
        payload: "Please select a service.",
      });
      return;
    }
    if (!firstName.trim()) {
      dispatchAsync({
        type: "SET_ERROR",
        payload: "First name is required.",
      });
      return;
    }
    if (!email.trim()) {
      dispatchAsync({ type: "SET_ERROR", payload: "Email is required." });
      return;
    }

    dispatchAsync({ type: "SUBMIT_START" });

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

    dispatchAsync({ type: "SUBMIT_END" });

    if (insertError) {
      dispatchAsync({
        type: "SET_ERROR",
        payload:
          (insertError as { message?: string })?.message ??
          "Failed to create booking.",
      });
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
                    onChange={(e) =>
                      dispatchForm({
                        type: "SET_FIELD",
                        field: "serviceId",
                        value: e.target.value,
                      })
                    }
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
                      No tiers configured for this service. Add them in
                      Settings, Services.
                    </p>
                  ) : (
                    <select
                      id="tier"
                      value={tierId}
                      onChange={(e) =>
                        dispatchForm({
                          type: "SET_FIELD",
                          field: "tierId",
                          value: e.target.value,
                        })
                      }
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
                    onChange={(e) =>
                      dispatchForm({
                        type: "SET_FIELD",
                        field: "date",
                        value: e.target.value,
                      })
                    }
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
                    onChange={(e) =>
                      dispatchForm({
                        type: "SET_FIELD",
                        field: "time",
                        value: e.target.value,
                      })
                    }
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
                    Last name
                  </label>
                  <input
                    id="lastName"
                    type="text"
                    value={lastName}
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
                  value={phone}
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
      </form>
    </div>
  );
}
