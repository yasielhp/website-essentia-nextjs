"use client";

import { useReducer, useEffect, useCallback } from "react";
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
};

type PaxEntry = {
  id: string;
  serviceId: string;
  tierId: string;
  tiers: Tier[];
  tiersLoading: boolean;
};

// ─── State ────────────────────────────────────────────────────

type State = {
  services: Service[];
  servicesLoading: boolean;
  guestFirstName: string;
  guestLastName: string;
  guestPhone: string;
  roomNumber: string;
  hotelReservationNumber: string;
  date: string;
  time: string;
  paxRows: PaxEntry[];
  submitting: boolean;
  error: string | null;
  submitted: boolean;
};

type GuestField =
  | "guestFirstName"
  | "guestLastName"
  | "guestPhone"
  | "roomNumber"
  | "hotelReservationNumber"
  | "date"
  | "time";

type Action =
  | { type: "SERVICES_LOADED"; payload: Service[] }
  | { type: "SET_GUEST"; field: GuestField; value: string }
  | { type: "ADD_PAX" }
  | { type: "REMOVE_PAX"; id: string }
  | { type: "SET_PAX_SERVICE"; id: string; serviceId: string }
  | { type: "PAX_TIERS_LOADING"; id: string }
  | { type: "PAX_TIERS_LOADED"; id: string; tiers: Tier[] }
  | { type: "SET_PAX_TIER"; id: string; tierId: string }
  | { type: "SUBMIT_START" }
  | { type: "SUBMIT_END" }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SUBMITTED" };

function makePax(): PaxEntry {
  return {
    id: crypto.randomUUID(),
    serviceId: "",
    tierId: "",
    tiers: [],
    tiersLoading: false,
  };
}

const initial: State = {
  services: [],
  servicesLoading: true,
  guestFirstName: "",
  guestLastName: "",
  guestPhone: "",
  roomNumber: "",
  hotelReservationNumber: "",
  date: "",
  time: "",
  paxRows: [makePax()],
  submitting: false,
  error: null,
  submitted: false,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SERVICES_LOADED":
      return { ...state, services: action.payload, servicesLoading: false };

    case "SET_GUEST":
      return { ...state, [action.field]: action.value };

    case "ADD_PAX":
      return { ...state, paxRows: [...state.paxRows, makePax()] };

    case "REMOVE_PAX":
      return {
        ...state,
        paxRows:
          state.paxRows.length > 1
            ? state.paxRows.filter((r) => r.id !== action.id)
            : state.paxRows,
      };

    case "SET_PAX_SERVICE":
      return {
        ...state,
        paxRows: state.paxRows.map((r) =>
          r.id === action.id
            ? { ...r, serviceId: action.serviceId, tierId: "", tiers: [] }
            : r,
        ),
      };

    case "PAX_TIERS_LOADING":
      return {
        ...state,
        paxRows: state.paxRows.map((r) =>
          r.id === action.id ? { ...r, tiersLoading: true } : r,
        ),
      };

    case "PAX_TIERS_LOADED":
      return {
        ...state,
        paxRows: state.paxRows.map((r) => {
          if (r.id !== action.id) return r;
          const autoTier = action.tiers.length === 1 ? action.tiers[0]!.id : "";
          return {
            ...r,
            tiers: action.tiers,
            tiersLoading: false,
            tierId: autoTier,
          };
        }),
      };

    case "SET_PAX_TIER":
      return {
        ...state,
        paxRows: state.paxRows.map((r) =>
          r.id === action.id ? { ...r, tierId: action.tierId } : r,
        ),
      };

    case "SUBMIT_START":
      return { ...state, submitting: true, error: null };

    case "SUBMIT_END":
      return { ...state, submitting: false };

    case "SET_ERROR":
      return { ...state, error: action.payload };

    case "SUBMITTED":
      return { ...state, submitting: false, submitted: true };
  }
}

// ─── Helpers ──────────────────────────────────────────────────

function tierLabel(t: Tier): string {
  const parts: string[] = [];
  if (t.label) parts.push(t.label);
  if (t.duration_minutes != null) parts.push(`${t.duration_minutes} min`);
  if (t.price_eur != null) parts.push(`€${t.price_eur}`);
  return parts.join(" · ") || "Estándar";
}

function IconPlus() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Pax row sub-component ─────────────────────────────────────

function PaxRowItem({
  entry,
  index,
  services,
  servicesLoading,
  submitting,
  canRemove,
  onServiceChange,
  onTierChange,
  onRemove,
}: {
  entry: PaxEntry;
  index: number;
  services: Service[];
  servicesLoading: boolean;
  submitting: boolean;
  canRemove: boolean;
  onServiceChange: (serviceId: string) => void;
  onTierChange: (tierId: string) => void;
  onRemove: () => void;
}) {
  const selectedTier = entry.tiers.find((t) => t.id === entry.tierId) ?? null;

  return (
    <div className="border-sand-100 rounded-xl border p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-petroleum-400 text-xs font-medium">
          Pax {index + 1}
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            disabled={submitting}
            className="text-petroleum-300 transition-colors hover:text-red-500"
            aria-label={`Eliminar pax ${index + 1}`}
          >
            <IconTrash />
          </button>
        )}
      </div>

      <div className="space-y-3">
        {servicesLoading ? (
          <div className="border-sand-200 bg-sand-50 h-12 animate-pulse rounded-xl border" />
        ) : (
          <select
            value={entry.serviceId}
            onChange={(e) => onServiceChange(e.target.value)}
            disabled={submitting}
            className={SELECT_CLASS}
            aria-label={`Tratamiento pax ${index + 1}`}
          >
            <option value="">Selecciona un tratamiento…</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        )}

        {entry.serviceId &&
          (entry.tiersLoading ? (
            <div className="border-sand-200 bg-sand-50 h-12 animate-pulse rounded-xl border" />
          ) : entry.tiers.length === 0 ? (
            <p className="text-petroleum-300 text-sm">
              Sin modalidades configuradas.
            </p>
          ) : entry.tiers.length > 1 ? (
            <select
              value={entry.tierId}
              onChange={(e) => onTierChange(e.target.value)}
              disabled={submitting}
              className={SELECT_CLASS}
              aria-label={`Modalidad pax ${index + 1}`}
            >
              <option value="">Selecciona modalidad…</option>
              {entry.tiers.map((t) => (
                <option key={t.id} value={t.id}>
                  {tierLabel(t)}
                </option>
              ))}
            </select>
          ) : null)}

        {selectedTier && (
          <div className="bg-sand-50 flex items-center gap-4 rounded-lg px-3 py-2">
            {selectedTier.duration_minutes != null && (
              <span className="text-petroleum-500 text-sm">
                <span className="text-petroleum-400 mr-1 text-xs">
                  Duración
                </span>
                {selectedTier.duration_minutes} min
              </span>
            )}
            {selectedTier.price_eur != null && (
              <span className="text-petroleum-500 text-sm">
                <span className="text-petroleum-400 mr-1 text-xs">Precio</span>€
                {selectedTier.price_eur}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function BaobabBookingPage() {
  const { push } = useRouter();
  const [state, dispatch] = useReducer(reducer, initial);
  const {
    services,
    servicesLoading,
    guestFirstName,
    guestLastName,
    guestPhone,
    roomNumber,
    hotelReservationNumber,
    date,
    time,
    paxRows,
    submitting,
    error,
    submitted,
  } = state;

  useEffect(() => {
    async function load() {
      const { data } = await insforge.database
        .from("service_settings")
        .select("id, title")
        .eq("active", true)
        .order("title");
      dispatch({
        type: "SERVICES_LOADED",
        payload: (data as Service[] | null) ?? [],
      });
    }
    void load();
  }, []);

  const loadTiers = useCallback(async (paxId: string, serviceId: string) => {
    dispatch({ type: "PAX_TIERS_LOADING", id: paxId });
    const { data } = await insforge.database
      .from("service_tiers")
      .select("id, label, duration_minutes, price_eur")
      .eq("service_id", serviceId)
      .eq("active", true)
      .order("sort_order");
    dispatch({
      type: "PAX_TIERS_LOADED",
      id: paxId,
      tiers: (data as Tier[] | null) ?? [],
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!guestFirstName.trim()) {
      dispatch({
        type: "SET_ERROR",
        payload: "El nombre del huésped es obligatorio.",
      });
      return;
    }
    if (!roomNumber.trim()) {
      dispatch({
        type: "SET_ERROR",
        payload: "El número de habitación es obligatorio.",
      });
      return;
    }
    if (!date || !time) {
      dispatch({
        type: "SET_ERROR",
        payload: "La fecha y hora son obligatorias.",
      });
      return;
    }
    if (paxRows.some((r) => !r.serviceId)) {
      dispatch({
        type: "SET_ERROR",
        payload: "Selecciona un tratamiento para cada pax.",
      });
      return;
    }

    dispatch({ type: "SUBMIT_START" });

    const rows = paxRows.map((pax) => {
      const service = services.find((s) => s.id === pax.serviceId);
      const tier = pax.tiers.find((t) => t.id === pax.tierId) ?? null;
      return {
        service_id: pax.serviceId,
        service_title: service?.title ?? pax.serviceId,
        tier_id: pax.tierId || null,
        price_eur: tier?.price_eur ?? null,
        duration:
          tier?.duration_minutes != null
            ? `${tier.duration_minutes} min`
            : null,
        date,
        time,
        first_name: guestFirstName.trim(),
        last_name: guestLastName.trim() || null,
        phone: guestPhone.trim() || null,
        room_number: roomNumber.trim(),
        hotel_reservation_number: hotelReservationNumber.trim() || null,
        source: "partner",
        status: "confirmed",
        payment_status: null,
      };
    });

    const { error: insertError } = await insforge.database
      .from("bookings")
      .insert(rows);

    if (insertError) {
      dispatch({ type: "SUBMIT_END" });
      dispatch({
        type: "SET_ERROR",
        payload:
          (insertError as { message?: string })?.message ??
          "Error al crear las reservas.",
      });
      return;
    }

    dispatch({ type: "SUBMITTED" });
  }

  // ── Success screen ──────────────────────────────────────────

  if (submitted) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-6 flex size-16 items-center justify-center rounded-full bg-green-100">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 13l4 4L19 7"
              stroke="#16a34a"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h2 className="font-display text-petroleum-700 mb-2 text-2xl">
          Reserva confirmada
        </h2>
        <p className="text-petroleum-400 mb-8 max-w-sm text-sm">
          {paxRows.length === 1
            ? "El tratamiento ha sido"
            : `Los ${paxRows.length} tratamientos han sido`}{" "}
          registrados correctamente para la habitación {roomNumber}.
        </p>
        <div className="flex gap-3">
          <Button
            variant="outline"
            size="md"
            onClick={() => push("/dashboard/bookings")}
          >
            Ver reservas
          </Button>
          <Button
            variant="solid"
            size="md"
            onClick={() => push("/dashboard/bookings/baobab")}
          >
            Nueva reserva
          </Button>
        </div>
      </div>
    );
  }

  // ── Form ────────────────────────────────────────────────────

  return (
    <div className="px-6 py-8 lg:px-10">
      <form onSubmit={(e) => void handleSubmit(e)} noValidate>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-petroleum-700 text-3xl">
              Reserva Baobab Suites
            </h1>
            <p className="text-petroleum-400 mt-1 text-sm">
              Reserva para huéspedes del hotel
            </p>
          </div>
          <Button type="submit" variant="solid" size="md" disabled={submitting}>
            {submitting ? "Guardando…" : "Confirmar reserva"}
          </Button>
        </div>

        {error && (
          <p className="mb-6 rounded-xl bg-red-100 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="space-y-6">
          {/* Hotel info */}
          <div className="border-sand-200 rounded-2xl border bg-white p-6">
            <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
              Datos del hotel
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="room"
                  className="text-petroleum-500 text-xs font-medium"
                >
                  Habitación <span className="text-red-400">*</span>
                </label>
                <input
                  id="room"
                  type="text"
                  value={roomNumber}
                  onChange={(e) =>
                    dispatch({
                      type: "SET_GUEST",
                      field: "roomNumber",
                      value: e.target.value,
                    })
                  }
                  placeholder="Ej. AK201"
                  disabled={submitting}
                  className={INPUT_CLASS}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="reservation"
                  className="text-petroleum-500 text-xs font-medium"
                >
                  Nº reserva hotel
                </label>
                <input
                  id="reservation"
                  type="text"
                  value={hotelReservationNumber}
                  onChange={(e) =>
                    dispatch({
                      type: "SET_GUEST",
                      field: "hotelReservationNumber",
                      value: e.target.value,
                    })
                  }
                  placeholder="Ej. 83943"
                  disabled={submitting}
                  className={INPUT_CLASS}
                />
              </div>
            </div>
          </div>

          {/* Guest info */}
          <div className="border-sand-200 rounded-2xl border bg-white p-6">
            <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
              Datos del huésped
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="firstName"
                    className="text-petroleum-500 text-xs font-medium"
                  >
                    Nombre <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="firstName"
                    type="text"
                    value={guestFirstName}
                    onChange={(e) =>
                      dispatch({
                        type: "SET_GUEST",
                        field: "guestFirstName",
                        value: e.target.value,
                      })
                    }
                    placeholder="María"
                    disabled={submitting}
                    className={INPUT_CLASS}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="lastName"
                    className="text-petroleum-500 text-xs font-medium"
                  >
                    Apellidos
                  </label>
                  <input
                    id="lastName"
                    type="text"
                    value={guestLastName}
                    onChange={(e) =>
                      dispatch({
                        type: "SET_GUEST",
                        field: "guestLastName",
                        value: e.target.value,
                      })
                    }
                    placeholder="García López"
                    disabled={submitting}
                    className={INPUT_CLASS}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="phone"
                  className="text-petroleum-500 text-xs font-medium"
                >
                  Teléfono
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={guestPhone}
                  onChange={(e) =>
                    dispatch({
                      type: "SET_GUEST",
                      field: "guestPhone",
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

          {/* Date & time */}
          <div className="border-sand-200 rounded-2xl border bg-white p-6">
            <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
              Fecha y hora
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="date"
                  className="text-petroleum-500 text-xs font-medium"
                >
                  Fecha <span className="text-red-400">*</span>
                </label>
                <input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) =>
                    dispatch({
                      type: "SET_GUEST",
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
                  Hora <span className="text-red-400">*</span>
                </label>
                <input
                  id="time"
                  type="time"
                  value={time}
                  onChange={(e) =>
                    dispatch({
                      type: "SET_GUEST",
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

          {/* Treatments / pax */}
          <div className="border-sand-200 rounded-2xl border bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-petroleum-500 text-sm font-semibold">
                Tratamientos ({paxRows.length} pax)
              </h2>
              <button
                type="button"
                onClick={() => dispatch({ type: "ADD_PAX" })}
                disabled={submitting}
                className="text-petroleum-500 hover:text-petroleum-700 flex items-center gap-1.5 text-sm font-medium transition-colors"
              >
                <IconPlus />
                Añadir pax
              </button>
            </div>

            <div className="space-y-4">
              {paxRows.map((entry, index) => (
                <PaxRowItem
                  key={entry.id}
                  entry={entry}
                  index={index}
                  services={services}
                  servicesLoading={servicesLoading}
                  submitting={submitting}
                  canRemove={paxRows.length > 1}
                  onServiceChange={(serviceId) => {
                    dispatch({
                      type: "SET_PAX_SERVICE",
                      id: entry.id,
                      serviceId,
                    });
                    if (serviceId) void loadTiers(entry.id, serviceId);
                  }}
                  onTierChange={(tierId) =>
                    dispatch({ type: "SET_PAX_TIER", id: entry.id, tierId })
                  }
                  onRemove={() =>
                    dispatch({ type: "REMOVE_PAX", id: entry.id })
                  }
                />
              ))}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
