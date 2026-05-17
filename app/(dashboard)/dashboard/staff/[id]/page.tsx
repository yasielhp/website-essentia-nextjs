"use client";

import { useEffect, useReducer, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "@/components/ui/image-upload";

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

function IconCalendar() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect
        x="3"
        y="4"
        width="18"
        height="18"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M16 2v4M8 2v4M3 10h18"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  google_calendar_email: string | null;
};

// ─── State ────────────────────────────────────────────────────

type PageState = {
  loading: boolean;
  notFound: boolean;
  saving: boolean;
  removing: boolean;
  removeOpen: boolean;
  error: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  avatarUrl: string;
  calendarEmail: string;
  calendarInputOpen: boolean;
  services: string[];
};

type PageAction =
  | {
      type: "LOAD_SUCCESS";
      payload: {
        firstName: string;
        lastName: string;
        email: string;
        phone: string;
        avatarUrl: string;
        calendarEmail: string;
        services: string[];
      };
    }
  | { type: "LOAD_NOT_FOUND" }
  | { type: "SET_SAVING"; value: boolean }
  | { type: "SET_REMOVING"; value: boolean }
  | { type: "OPEN_REMOVE_DIALOG" }
  | { type: "CLOSE_REMOVE_DIALOG" }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "SET_FIRST_NAME"; value: string }
  | { type: "SET_LAST_NAME"; value: string }
  | { type: "SET_EMAIL"; value: string }
  | { type: "SET_PHONE"; value: string }
  | { type: "SET_AVATAR_URL"; value: string }
  | { type: "SET_CALENDAR_EMAIL"; value: string }
  | { type: "SHOW_CALENDAR_INPUT" }
  | { type: "HIDE_CALENDAR_INPUT" }
  | { type: "TOGGLE_SERVICE"; serviceId: string };

const initialState: PageState = {
  loading: true,
  notFound: false,
  saving: false,
  removing: false,
  removeOpen: false,
  error: null,
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  avatarUrl: "",
  calendarEmail: "",
  calendarInputOpen: false,
  services: [],
};

function reducer(state: PageState, action: PageAction): PageState {
  switch (action.type) {
    case "LOAD_SUCCESS":
      return { ...state, loading: false, ...action.payload };
    case "LOAD_NOT_FOUND":
      return { ...state, loading: false, notFound: true };
    case "SET_SAVING":
      return { ...state, saving: action.value };
    case "SET_REMOVING":
      return { ...state, removing: action.value };
    case "OPEN_REMOVE_DIALOG":
      return { ...state, removeOpen: true };
    case "CLOSE_REMOVE_DIALOG":
      return { ...state, removeOpen: false };
    case "SET_ERROR":
      return { ...state, error: action.error };
    case "SET_FIRST_NAME":
      return { ...state, firstName: action.value };
    case "SET_LAST_NAME":
      return { ...state, lastName: action.value };
    case "SET_EMAIL":
      return { ...state, email: action.value };
    case "SET_PHONE":
      return { ...state, phone: action.value };
    case "SET_AVATAR_URL":
      return { ...state, avatarUrl: action.value };
    case "SET_CALENDAR_EMAIL":
      return { ...state, calendarEmail: action.value };
    case "SHOW_CALENDAR_INPUT":
      return { ...state, calendarInputOpen: true };
    case "HIDE_CALENDAR_INPUT":
      return { ...state, calendarInputOpen: false };
    case "TOGGLE_SERVICE":
      return {
        ...state,
        services: state.services.includes(action.serviceId)
          ? state.services.filter((s) => s !== action.serviceId)
          : [...state.services, action.serviceId],
      };
  }
}

// ─── RemoveDialog ─────────────────────────────────────────────

type RemoveDialogProps = {
  displayName: string;
  removing: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

function RemoveDialog({
  displayName,
  removing,
  onCancel,
  onConfirm,
}: RemoveDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex flex-col gap-1">
          <h3 className="font-display text-petroleum-700 text-xl">
            Remove from staff?
          </h3>
          <p className="text-petroleum-400 text-sm">
            <strong className="text-petroleum-600 font-medium">
              {displayName}
            </strong>{" "}
            will lose staff access. Their account will remain active as a
            regular contact.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Button
            variant="danger"
            size="md"
            onClick={onConfirm}
            disabled={removing}
            className="w-full"
          >
            {removing ? "Removing…" : "Yes, remove"}
          </Button>
          <Button
            variant="outline"
            size="md"
            onClick={onCancel}
            disabled={removing}
            className="w-full"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function StaffMemberPage() {
  const { id } = useParams<{ id: string }>();
  const { push, back } = useRouter();
  const [state, dispatch] = useReducer(reducer, initialState);

  const {
    loading,
    notFound,
    saving,
    removing,
    removeOpen,
    error,
    firstName,
    lastName,
    email,
    phone,
    avatarUrl,
    calendarEmail,
    calendarInputOpen,
    services,
  } = state;

  // useRef for tracking whether save is in-flight
  // (not read in render — used only inside async handlers)
  const savingRef = useRef(false);

  useEffect(() => {
    async function load() {
      const { data: profiles } = await insforge.database
        .from("profiles")
        .select(
          "id, first_name, last_name, full_name, email, phone, avatar_url, google_calendar_email",
        )
        .eq("id", id)
        .eq("role", "staff")
        .limit(1);

      const profile = (profiles as Profile[] | null)?.[0];

      if (!profile) {
        dispatch({ type: "LOAD_NOT_FOUND" });
        return;
      }

      const { data: staffServices } = await insforge.database
        .from("staff_services")
        .select("service_id")
        .eq("staff_id", id);

      // Derive first/last from full_name if dedicated columns are empty
      const derivedFirst =
        profile.first_name ??
        (profile.full_name ? profile.full_name.split(" ")[0] : "");
      const derivedLast =
        profile.last_name ??
        (profile.full_name
          ? profile.full_name.split(" ").slice(1).join(" ")
          : "");

      dispatch({
        type: "LOAD_SUCCESS",
        payload: {
          firstName: derivedFirst ?? "",
          lastName: derivedLast ?? "",
          email: profile.email ?? "",
          phone: profile.phone ?? "",
          avatarUrl: profile.avatar_url ?? "",
          calendarEmail: profile.google_calendar_email ?? "",
          services:
            (staffServices as { service_id: string }[] | null)?.map(
              (r) => r.service_id,
            ) ?? [],
        },
      });
    }

    void load();
  }, [id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    dispatch({ type: "SET_ERROR", error: null });

    const trimmedFirst = firstName.trim();
    if (!trimmedFirst) {
      dispatch({ type: "SET_ERROR", error: "First name is required." });
      return;
    }

    savingRef.current = true;
    dispatch({ type: "SET_SAVING", value: true });

    const fullName = [trimmedFirst, lastName.trim()].filter(Boolean).join(" ");

    await insforge.database
      .from("profiles")
      .update({
        first_name: trimmedFirst,
        last_name: lastName.trim() || null,
        full_name: fullName,
        email: email.trim() || null,
        phone: phone.trim() || null,
        avatar_url: avatarUrl || null,
        google_calendar_email: calendarEmail.trim() || null,
      })
      .eq("id", id);

    await insforge.database.from("staff_services").delete().eq("staff_id", id);

    if (services.length > 0) {
      await insforge.database
        .from("staff_services")
        .insert(services.map((service_id) => ({ staff_id: id, service_id })));
    }

    savingRef.current = false;
    dispatch({ type: "SET_SAVING", value: false });
    push("/dashboard/staff");
  }

  async function handleRemove() {
    dispatch({ type: "SET_REMOVING", value: true });
    await insforge.database
      .from("profiles")
      .update({ role: "contact" })
      .eq("id", id);
    push("/dashboard/staff");
  }

  async function handleConnectCalendar() {
    const trimmed = calendarEmail.trim();
    if (!trimmed) return;
    await insforge.database
      .from("profiles")
      .update({ google_calendar_email: trimmed })
      .eq("id", id);
    dispatch({ type: "HIDE_CALENDAR_INPUT" });
  }

  async function handleDisconnectCalendar() {
    await insforge.database
      .from("profiles")
      .update({ google_calendar_email: null })
      .eq("id", id);
    dispatch({ type: "SET_CALENDAR_EMAIL", value: "" });
  }

  const displayName =
    [firstName, lastName].filter(Boolean).join(" ") || "Staff Member";

  if (notFound) {
    return (
      <div className="text-petroleum-400 flex flex-col items-center justify-center py-24">
        <p className="text-sm">Staff member not found.</p>
        <button
          onClick={() => back()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") back();
          }}
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
          <div>
            <h1 className="font-display text-petroleum-700 text-3xl">
              Edit staff member
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline-danger"
              size="md"
              onClick={() => dispatch({ type: "OPEN_REMOVE_DIALOG" })}
              disabled={loading}
              className="gap-1.5"
            >
              <IconTrash />
              Remove
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

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left — details */}
          <div className="space-y-5 lg:col-span-2">
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
                    {loading ? (
                      <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
                    ) : (
                      <input
                        id="firstName"
                        type="text"
                        value={firstName}
                        onChange={(e) =>
                          dispatch({
                            type: "SET_FIRST_NAME",
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
                            type: "SET_LAST_NAME",
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
                        dispatch({ type: "SET_EMAIL", value: e.target.value })
                      }
                      placeholder="jane@essentia.com"
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
                        dispatch({ type: "SET_PHONE", value: e.target.value })
                      }
                      placeholder="+34 600 000 000"
                      disabled={saving}
                      className={INPUT_CLASS}
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="border-sand-200 rounded-2xl border bg-white p-6">
              <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
                Services assigned
              </h2>
              {loading ? (
                <div className="grid grid-cols-2 gap-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="bg-sand-100 h-9 animate-pulse rounded-xl"
                    />
                  ))}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {SERVICES.map((service) => {
                      const checked = services.includes(service.id);
                      return (
                        <label
                          key={service.id}
                          className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition-colors ${
                            checked
                              ? "border-petroleum-400 bg-petroleum-50 text-petroleum-700"
                              : "border-sand-200 text-petroleum-500 hover:border-sand-400 hover:bg-sand-50 bg-white"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              dispatch({
                                type: "TOGGLE_SERVICE",
                                serviceId: service.id,
                              })
                            }
                            disabled={saving}
                            className="accent-petroleum-700 size-3.5"
                          />
                          {service.title}
                        </label>
                      );
                    })}
                  </div>

                  {services.length > 0 && (
                    <div className="border-sand-100 mt-4 border-t pt-4">
                      {calendarEmail.trim() ? (
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <span className="size-2 shrink-0 rounded-full bg-green-500" />
                            <div className="min-w-0">
                              <p className="text-petroleum-700 text-sm font-medium">
                                Google Calendar connected
                              </p>
                              <p className="text-petroleum-400 truncate text-xs">
                                {calendarEmail}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleDisconnectCalendar()}
                            className="text-petroleum-400 shrink-0 text-xs transition-colors hover:text-red-500"
                          >
                            Disconnect
                          </button>
                        </div>
                      ) : calendarInputOpen ? (
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <div className="text-petroleum-400 pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2">
                              <IconCalendar />
                            </div>
                            <input
                              type="email"
                              value={calendarEmail}
                              onChange={(e) =>
                                dispatch({
                                  type: "SET_CALENDAR_EMAIL",
                                  value: e.target.value,
                                })
                              }
                              placeholder="jane@gmail.com"
                              autoFocus
                              className={INPUT_CLASS + " pl-10"}
                            />
                          </div>
                          <Button
                            type="button"
                            variant="solid"
                            size="sm"
                            onClick={() => void handleConnectCalendar()}
                          >
                            Save
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              dispatch({ type: "HIDE_CALENDAR_INPUT" })
                            }
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            dispatch({ type: "SHOW_CALENDAR_INPUT" })
                          }
                          className="border-sand-200 hover:border-petroleum-300 hover:bg-sand-50 text-petroleum-500 flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm transition-colors"
                        >
                          <IconCalendar />
                          Connect Google Calendar
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Right — sidebar */}
          <div className="space-y-5">
            <div className="border-sand-200 rounded-2xl border bg-white p-6">
              <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
                Photo
              </h2>
              {loading ? (
                <div className="bg-sand-100 h-36 animate-pulse rounded-xl" />
              ) : (
                <ImageUpload
                  bucket="events"
                  folder="staff"
                  value={avatarUrl}
                  onChange={(value) =>
                    dispatch({ type: "SET_AVATAR_URL", value })
                  }
                />
              )}
            </div>
          </div>
        </div>
      </form>

      {removeOpen && (
        <RemoveDialog
          displayName={displayName}
          removing={removing}
          onCancel={() => dispatch({ type: "CLOSE_REMOVE_DIALOG" })}
          onConfirm={() => void handleRemove()}
        />
      )}
    </div>
  );
}
