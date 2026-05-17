"use client";

import { useReducer, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";

const SERVICES = [
  { id: "contrast-therapy", title: "Contrast Therapy" },
  { id: "breathing-sessions", title: "Breathing Sessions" },
  { id: "red-light-therapy", title: "Red Light Therapy" },
  { id: "manual-therapies", title: "Manual Therapies" },
  { id: "functional-well-being", title: "Functional Well-being" },
  { id: "hyperbaric-chambers", title: "Hyperbaric Chambers" },
  { id: "intravenous-therapy", title: "Intravenous Therapy" },
  { id: "regenerative-medicine", title: "Regenerative Medicine" },
];

const INPUT_CLASS =
  "border-sand-200 bg-white text-petroleum-700 placeholder:text-petroleum-300 focus:border-petroleum-400 focus:ring-petroleum-100 rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 w-full disabled:opacity-60";

const SELECT_CLASS =
  "border-sand-200 bg-white text-petroleum-700 focus:border-petroleum-400 focus:ring-petroleum-100 rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 w-full disabled:opacity-60";

function IconCheck() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path
        d="M20 6L9 17l-5-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
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
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DeleteDialog({
  deleting,
  onConfirm,
  onCancel,
}: {
  deleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex flex-col gap-1">
          <h3 className="font-display text-petroleum-700 text-xl">
            Delete booking?
          </h3>
          <p className="text-petroleum-400 text-sm">
            This booking will be permanently deleted.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Button
            variant="danger"
            size="md"
            onClick={onConfirm}
            disabled={deleting}
            className="w-full"
          >
            {deleting ? "Deleting…" : "Yes, delete"}
          </Button>
          <Button
            variant="outline"
            size="md"
            onClick={onCancel}
            disabled={deleting}
            className="w-full"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── State & Reducer ──────────────────────────────────────────

type BookingRow = {
  id: string;
  service_id: string;
  date: string | null;
  time: string | null;
  duration: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  status: string;
};

type PageState = {
  loading: boolean;
  notFound: boolean;
  saving: boolean;
  deleting: boolean;
  deleteOpen: boolean;
  error: string | null;
  serviceId: string;
  date: string;
  time: string;
  duration: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status: string;
};

type PageAction =
  | { type: "LOADED"; payload: BookingRow }
  | { type: "LOAD_NOT_FOUND" }
  | {
      type: "SET_FIELD";
      field: keyof Omit<
        PageState,
        "loading" | "notFound" | "saving" | "deleting" | "deleteOpen" | "error"
      >;
      value: string;
    }
  | { type: "SAVE_START" }
  | { type: "SAVE_END" }
  | { type: "DELETE_START" }
  | { type: "DELETE_OPEN"; open: boolean }
  | { type: "SET_ERROR"; payload: string | null };

const pageInitial: PageState = {
  loading: true,
  notFound: false,
  saving: false,
  deleting: false,
  deleteOpen: false,
  error: null,
  serviceId: "",
  date: "",
  time: "",
  duration: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  status: "pending",
};

function pageReducer(state: PageState, action: PageAction): PageState {
  switch (action.type) {
    case "LOADED":
      return {
        ...state,
        loading: false,
        serviceId: action.payload.service_id ?? "",
        date: action.payload.date ?? "",
        time: action.payload.time ?? "",
        duration: action.payload.duration ?? "",
        firstName: action.payload.first_name ?? "",
        lastName: action.payload.last_name ?? "",
        email: action.payload.email ?? "",
        phone: action.payload.phone ?? "",
        status: action.payload.status ?? "pending",
      };
    case "LOAD_NOT_FOUND":
      return { ...state, loading: false, notFound: true };
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "SAVE_START":
      return { ...state, saving: true };
    case "SAVE_END":
      return { ...state, saving: false };
    case "DELETE_START":
      return { ...state, deleting: true };
    case "DELETE_OPEN":
      return { ...state, deleteOpen: action.open };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    default:
      return state;
  }
}

// ─── Page ─────────────────────────────────────────────────────

export default function EditBookingPage() {
  const { id } = useParams<{ id: string }>();
  const { push, back } = useRouter();

  const [state, dispatch] = useReducer(pageReducer, pageInitial);

  const {
    loading,
    notFound,
    saving,
    deleting,
    deleteOpen,
    error,
    serviceId,
    date,
    time,
    duration,
    firstName,
    lastName,
    email,
    phone,
    status,
  } = state;

  useEffect(() => {
    async function load() {
      const { data } = await insforge.database
        .from("bookings")
        .select(
          "id, service_id, date, time, duration, first_name, last_name, email, phone, status",
        )
        .eq("id", id)
        .limit(1);

      const booking = (data as BookingRow[] | null)?.[0];

      if (!booking) {
        dispatch({ type: "LOAD_NOT_FOUND" });
        return;
      }

      dispatch({ type: "LOADED", payload: booking });
    }

    void load();
  }, [id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    dispatch({ type: "SET_ERROR", payload: null });

    if (!serviceId) {
      dispatch({ type: "SET_ERROR", payload: "Please select a service." });
      return;
    }
    if (!firstName.trim()) {
      dispatch({ type: "SET_ERROR", payload: "First name is required." });
      return;
    }

    dispatch({ type: "SAVE_START" });

    const serviceTitle =
      SERVICES.find((s) => s.id === serviceId)?.title ?? serviceId;

    const { error: updateError } = await insforge.database
      .from("bookings")
      .update({
        service_id: serviceId,
        service_title: serviceTitle,
        date: date || null,
        time: time || null,
        duration: duration.trim() || null,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        status,
      })
      .eq("id", id);

    dispatch({ type: "SAVE_END" });

    if (updateError) {
      dispatch({
        type: "SET_ERROR",
        payload:
          (updateError as { message?: string })?.message ??
          "Failed to save booking.",
      });
      return;
    }

    push("/dashboard/bookings");
  }

  async function handleDelete() {
    dispatch({ type: "DELETE_START" });
    await insforge.database.from("bookings").delete().eq("id", id);
    push("/dashboard/bookings");
  }

  if (notFound) {
    return (
      <div className="text-petroleum-400 flex flex-col items-center justify-center py-24">
        <p className="text-sm">Booking not found.</p>
        <button
          onClick={() => back()}
          className="hover:text-petroleum-700 mt-4 text-xs underline"
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      <form onSubmit={(e) => void handleSave(e)} noValidate>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-display text-petroleum-700 text-3xl">
            Edit Booking
          </h1>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline-danger"
              size="md"
              onClick={() => dispatch({ type: "DELETE_OPEN", open: true })}
              disabled={loading}
              className="gap-1.5"
            >
              <IconTrash />
              Delete
            </Button>
            <Button
              type="submit"
              variant="solid"
              size="md"
              disabled={saving || loading}
              className="gap-1.5"
            >
              <IconCheck />
              {saving ? "Saving…" : "Save"}
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
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="service"
                  className="text-petroleum-500 text-xs font-medium"
                >
                  Service <span className="text-red-400">*</span>
                </label>
                {loading ? (
                  <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
                ) : (
                  <select
                    id="service"
                    value={serviceId}
                    onChange={(e) =>
                      dispatch({
                        type: "SET_FIELD",
                        field: "serviceId",
                        value: e.target.value,
                      })
                    }
                    disabled={saving}
                    className={SELECT_CLASS}
                  >
                    <option value="">Select a service…</option>
                    {SERVICES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="date"
                    className="text-petroleum-500 text-xs font-medium"
                  >
                    Date
                  </label>
                  {loading ? (
                    <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
                  ) : (
                    <input
                      id="date"
                      type="date"
                      value={date}
                      onChange={(e) =>
                        dispatch({
                          type: "SET_FIELD",
                          field: "date",
                          value: e.target.value,
                        })
                      }
                      disabled={saving}
                      className={INPUT_CLASS}
                    />
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="time"
                    className="text-petroleum-500 text-xs font-medium"
                  >
                    Time
                  </label>
                  {loading ? (
                    <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
                  ) : (
                    <input
                      id="time"
                      type="time"
                      value={time}
                      onChange={(e) =>
                        dispatch({
                          type: "SET_FIELD",
                          field: "time",
                          value: e.target.value,
                        })
                      }
                      disabled={saving}
                      className={INPUT_CLASS}
                    />
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="duration"
                    className="text-petroleum-500 text-xs font-medium"
                  >
                    Duration
                  </label>
                  {loading ? (
                    <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
                  ) : (
                    <input
                      id="duration"
                      type="text"
                      value={duration}
                      onChange={(e) =>
                        dispatch({
                          type: "SET_FIELD",
                          field: "duration",
                          value: e.target.value,
                        })
                      }
                      placeholder="e.g. 60 min"
                      disabled={saving}
                      className={INPUT_CLASS}
                    />
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="status"
                  className="text-petroleum-500 text-xs font-medium"
                >
                  Status
                </label>
                {loading ? (
                  <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
                ) : (
                  <select
                    id="status"
                    value={status}
                    onChange={(e) =>
                      dispatch({
                        type: "SET_FIELD",
                        field: "status",
                        value: e.target.value,
                      })
                    }
                    disabled={saving}
                    className={SELECT_CLASS}
                  >
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                )}
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
                  {loading ? (
                    <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
                  ) : (
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
                      disabled={saving}
                      className={INPUT_CLASS}
                    />
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="lastName"
                    className="text-petroleum-500 text-xs font-medium"
                  >
                    Last name
                  </label>
                  {loading ? (
                    <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
                  ) : (
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
                      disabled={saving}
                      className={INPUT_CLASS}
                    />
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="email"
                  className="text-petroleum-500 text-xs font-medium"
                >
                  Email
                </label>
                {loading ? (
                  <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
                ) : (
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
                    disabled={saving}
                    className={INPUT_CLASS}
                  />
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="phone"
                  className="text-petroleum-500 text-xs font-medium"
                >
                  Phone
                </label>
                {loading ? (
                  <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
                ) : (
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
                    disabled={saving}
                    className={INPUT_CLASS}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </form>

      {deleteOpen && (
        <DeleteDialog
          deleting={deleting}
          onConfirm={() => void handleDelete()}
          onCancel={() => dispatch({ type: "DELETE_OPEN", open: false })}
        />
      )}
    </div>
  );
}
