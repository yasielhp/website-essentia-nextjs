"use client";

import { useEffect, useReducer, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";
import { INPUT_CLASS } from "@/constants/form-styles";
import { PasswordInput } from "@/components/ui/input";
import { setUserPassword } from "@/actions/set-user-password";

type SystemRole = "admin" | "staff" | "partner";

type ServiceRow = { id: string; title: string };
type Assignment = { service_id: string; google_calendar_email: string };

type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: SystemRole;
};

// ─── State ────────────────────────────────────────────────────

type State = {
  loading: boolean;
  notFound: boolean;
  saving: boolean;
  confirmRemove: boolean;
  removing: boolean;
  error: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: SystemRole;
};

type Action =
  | { type: "LOADED"; profile: Profile }
  | { type: "NOT_FOUND" }
  | { type: "SET_SAVING"; value: boolean }
  | { type: "SET_REMOVING"; value: boolean }
  | { type: "OPEN_REMOVE" }
  | { type: "CLOSE_REMOVE" }
  | { type: "SET_ERROR"; msg: string | null }
  | {
      type: "SET_FIELD";
      field: "firstName" | "lastName" | "email" | "phone";
      value: string;
    }
  | { type: "SET_ROLE"; role: SystemRole };

const initial: State = {
  loading: true,
  notFound: false,
  saving: false,
  confirmRemove: false,
  removing: false,
  error: null,
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  role: "staff",
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "LOADED":
      return {
        ...state,
        loading: false,
        firstName:
          action.profile.first_name ??
          action.profile.full_name?.split(" ")[0] ??
          "",
        lastName:
          action.profile.last_name ??
          action.profile.full_name?.split(" ").slice(1).join(" ") ??
          "",
        email: action.profile.email ?? "",
        phone: action.profile.phone ?? "",
        role: action.profile.role,
      };
    case "NOT_FOUND":
      return { ...state, loading: false, notFound: true };
    case "SET_SAVING":
      return { ...state, saving: action.value };
    case "SET_REMOVING":
      return { ...state, removing: action.value };
    case "OPEN_REMOVE":
      return { ...state, confirmRemove: true };
    case "CLOSE_REMOVE":
      return { ...state, confirmRemove: false };
    case "SET_ERROR":
      return { ...state, error: action.msg };
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "SET_ROLE":
      return { ...state, role: action.role };
  }
}

// ─── Constants ────────────────────────────────────────────────

const ROLES: { value: SystemRole; label: string; desc: string }[] = [
  { value: "admin", label: "Admin", desc: "Full access" },
  { value: "staff", label: "Staff", desc: "Dashboard access" },
  { value: "partner", label: "Partner", desc: "Hotel bookings only" },
];

// ─── Icons ────────────────────────────────────────────────────

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
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path
        d="M5 12l5 5L19 7"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function EditUserPage() {
  const { id } = useParams<{ id: string }>();
  const { push, back } = useRouter();
  const [state, dispatch] = useReducer(reducer, initial);
  const { loading, notFound, saving, removing, confirmRemove, error } = state;

  const [availableServices, setAvailableServices] = useState<ServiceRow[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwOk, setPwOk] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await insforge.database
        .from("profiles")
        .select("id, first_name, last_name, full_name, email, phone, role")
        .eq("id", id)
        .in("role", ["admin", "staff", "partner"])
        .limit(1);

      const profile = (data as Profile[] | null)?.[0];
      if (!profile) {
        dispatch({ type: "NOT_FOUND" });
        return;
      }
      dispatch({ type: "LOADED", profile });

      const [svcs, assigned] = await Promise.all([
        insforge.database
          .from("service_settings")
          .select("id, title")
          .eq("active", true)
          .order("title"),
        insforge.database
          .from("staff_services")
          .select("service_id, google_calendar_email")
          .eq("staff_id", id),
      ]);

      setAvailableServices((svcs.data as ServiceRow[] | null) ?? []);
      setAssignments(
        (
          (assigned.data as
            | { service_id: string; google_calendar_email: string | null }[]
            | null) ?? []
        ).map((r) => ({
          service_id: r.service_id,
          google_calendar_email: r.google_calendar_email ?? "",
        })),
      );
    }
    void load();
  }, [id]);

  function toggleService(serviceId: string) {
    setAssignments((prev) => {
      const exists = prev.find((a) => a.service_id === serviceId);
      if (exists) return prev.filter((a) => a.service_id !== serviceId);
      return [...prev, { service_id: serviceId, google_calendar_email: "" }];
    });
  }

  function setCalendarEmail(serviceId: string, value: string) {
    setAssignments((prev) =>
      prev.map((a) =>
        a.service_id === serviceId ? { ...a, google_calendar_email: value } : a,
      ),
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    dispatch({ type: "SET_ERROR", msg: null });

    const trimFirst = state.firstName.trim();
    if (!trimFirst) {
      dispatch({ type: "SET_ERROR", msg: "El nombre es obligatorio." });
      return;
    }

    dispatch({ type: "SET_SAVING", value: true });

    const fullName = [trimFirst, state.lastName.trim()]
      .filter(Boolean)
      .join(" ");

    await insforge.database
      .from("profiles")
      .update({
        role: state.role,
        first_name: trimFirst,
        last_name: state.lastName.trim() || null,
        full_name: fullName,
        email: state.email.trim() || null,
        phone: state.phone.trim() || null,
      })
      .eq("id", id);

    // Sync staff_services: delete all then re-insert
    await insforge.database.from("staff_services").delete().eq("staff_id", id);
    if (state.role === "staff" && assignments.length > 0) {
      await insforge.database.from("staff_services").insert(
        assignments.map((a) => ({
          staff_id: id,
          service_id: a.service_id,
          google_calendar_email: a.google_calendar_email || null,
        })),
      );
    }

    dispatch({ type: "SET_SAVING", value: false });
    push("/dashboard/users");
  }

  async function handleChangePw() {
    setPwError(null);
    setPwOk(false);
    if (pwNew !== pwConfirm) {
      setPwError("Las contraseñas no coinciden.");
      return;
    }
    if (pwNew.length < 8) {
      setPwError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    setPwLoading(true);
    const { error } = await setUserPassword(id, pwNew);
    if (error) {
      setPwError(error);
      setPwLoading(false);
      return;
    }
    setPwNew("");
    setPwConfirm("");
    setPwOk(true);
    setPwLoading(false);
  }

  async function handleRemove() {
    dispatch({ type: "SET_REMOVING", value: true });
    await insforge.database
      .from("profiles")
      .update({ role: "contact" })
      .eq("id", id);
    push("/dashboard/users");
  }

  if (notFound) {
    return (
      <div className="text-petroleum-400 flex flex-col items-center justify-center py-24">
        <p className="text-sm">User not found.</p>
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
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-display text-petroleum-700 text-3xl">
            Edit User
          </h1>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline-danger"
              size="md"
              onClick={() => dispatch({ type: "OPEN_REMOVE" })}
              disabled={loading}
              className="gap-1.5"
            >
              <IconTrash />
              Remove access
            </Button>
            <Button variant="outline" size="md" href="/dashboard/users">
              Cancel
            </Button>
            <Button
              type="submit"
              variant="solid"
              size="md"
              disabled={saving || loading}
            >
              {saving ? "Saving…" : "Save"}
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
            {loading ? (
              <div className="bg-sand-100 h-20 animate-pulse rounded-xl" />
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {ROLES.map((r) => {
                  const selected = state.role === r.value;
                  return (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() =>
                        dispatch({ type: "SET_ROLE", role: r.value })
                      }
                      disabled={saving}
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
            )}
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
                  {loading ? (
                    <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
                  ) : (
                    <input
                      id="firstName"
                      type="text"
                      value={state.firstName}
                      onChange={(e) =>
                        dispatch({
                          type: "SET_FIELD",
                          field: "firstName",
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
                      value={state.lastName}
                      onChange={(e) =>
                        dispatch({
                          type: "SET_FIELD",
                          field: "lastName",
                          value: e.target.value,
                        })
                      }
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
                    value={state.email}
                    onChange={(e) =>
                      dispatch({
                        type: "SET_FIELD",
                        field: "email",
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
                    value={state.phone}
                    onChange={(e) =>
                      dispatch({
                        type: "SET_FIELD",
                        field: "phone",
                        value: e.target.value,
                      })
                    }
                    disabled={saving}
                    className={INPUT_CLASS}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Password */}
          {!loading && (
            <div className="border-sand-200 rounded-2xl border bg-white p-6">
              <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
                Password
              </h2>
              <div className="space-y-4">
                {pwError && (
                  <p className="rounded-xl bg-red-100 px-4 py-3 text-sm text-red-600">
                    {pwError}
                  </p>
                )}

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="pw-new"
                    className="text-petroleum-500 text-xs font-medium"
                  >
                    New password
                  </label>
                  <PasswordInput
                    id="pw-new"
                    value={pwNew}
                    onChange={(e) => setPwNew(e.target.value)}
                    placeholder="••••••••"
                    disabled={pwLoading || saving}
                    autoComplete="new-password"
                    inputClassName={INPUT_CLASS}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="pw-confirm"
                    className="text-petroleum-500 text-xs font-medium"
                  >
                    Confirm password
                  </label>
                  <PasswordInput
                    id="pw-confirm"
                    value={pwConfirm}
                    onChange={(e) => setPwConfirm(e.target.value)}
                    placeholder="••••••••"
                    disabled={pwLoading || saving}
                    autoComplete="new-password"
                    inputClassName={INPUT_CLASS}
                  />
                </div>

                <div className="flex items-center justify-end gap-4">
                  {pwOk && (
                    <p className="text-sm font-medium text-green-700">
                      Password updated.
                    </p>
                  )}
                  <Button
                    type="button"
                    variant="solid"
                    size="md"
                    onClick={() => void handleChangePw()}
                    disabled={pwLoading || saving || !pwNew || !pwConfirm}
                  >
                    {pwLoading ? "Saving…" : "Change password"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Services — only when role is Staff */}
          {!loading && state.role === "staff" && (
            <div className="border-sand-200 rounded-2xl border bg-white p-6">
              <h2 className="text-petroleum-500 mb-1 text-sm font-semibold">
                Services
              </h2>
              <p className="text-petroleum-400 mb-4 text-xs">
                Selecciona los servicios que puede gestionar este miembro del
                staff.
              </p>
              <div className="space-y-2">
                {availableServices.map((svc) => {
                  const assigned = assignments.find(
                    (a) => a.service_id === svc.id,
                  );
                  const isOn = !!assigned;
                  return (
                    <div
                      key={svc.id}
                      className={`rounded-xl border transition-colors ${isOn ? "border-petroleum-200 bg-petroleum-50/40" : "border-sand-200"}`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleService(svc.id)}
                        disabled={saving}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left"
                      >
                        <span
                          className={`flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                            isOn
                              ? "border-petroleum-500 bg-petroleum-500 text-white"
                              : "border-sand-300 bg-white"
                          }`}
                        >
                          {isOn && <IconCheck />}
                        </span>
                        <span
                          className={`text-sm font-medium ${isOn ? "text-petroleum-700" : "text-petroleum-500"}`}
                        >
                          {svc.title}
                        </span>
                      </button>

                      {isOn && (
                        <div className="border-petroleum-100 border-t px-4 pt-2 pb-3">
                          <label className="text-petroleum-400 mb-1.5 block text-xs font-medium">
                            Google Calendar email
                          </label>
                          <input
                            type="email"
                            value={assigned?.google_calendar_email ?? ""}
                            onChange={(e) =>
                              setCalendarEmail(svc.id, e.target.value)
                            }
                            placeholder="staff@essentia.com"
                            disabled={saving}
                            className={INPUT_CLASS}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </form>

      {/* Remove confirmation dialog */}
      {confirmRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5">
          <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex flex-col gap-1">
              <h3 className="font-display text-petroleum-700 text-xl">
                Remove system access?
              </h3>
              <p className="text-petroleum-400 text-sm">
                This user will lose dashboard access. Their account will remain
                as a contact.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                variant="danger"
                size="md"
                onClick={() => void handleRemove()}
                disabled={removing}
                className="w-full"
              >
                {removing ? "Removing…" : "Yes, remove access"}
              </Button>
              <Button
                variant="outline"
                size="md"
                onClick={() => dispatch({ type: "CLOSE_REMOVE" })}
                disabled={removing}
                className="w-full"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
