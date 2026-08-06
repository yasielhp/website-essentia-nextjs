"use client";

import { useEffect, useReducer, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { insforge } from "@/lib/insforge";
import {
  dashboardUserSchema,
  parseErrors,
  type FormErrors,
} from "@/lib/schemas";
import { normalizeEmail, normalizePhone } from "@/utils/contact";
import { Button } from "@/components/ui/button";
import { INPUT_CLASS } from "@/constants/form-styles";
import { PasswordInput } from "@/components/ui/input";
import { setUserPassword } from "@/actions/set-user-password";
import { removeUserAccess } from "@/actions/remove-user-access";
import { updateUserProfile } from "@/actions/update-user-profile";
import { getAccessToken } from "@/lib/client-session";
import { OptionSelect, type SelectOption } from "@/components/ui/option-select";
import { toStoredGender, type GenderValue } from "@/constants/gender";
import { useGenderOptions } from "@/hooks/use-gender-options";
import {
  connectStaffCalendar,
  disconnectStaffCalendar,
} from "@/services/calendar.client";
import {
  IconTrash,
  IconCheck,
  IconCalendarConnect,
} from "@/components/ui/icons";

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
  gender: GenderValue | null;
  role: SystemRole;
};

// ─── State ────────────────────────────────────────────────────

type UserErrors = FormErrors<typeof dashboardUserSchema>;

type State = {
  loading: boolean;
  fieldErrors: UserErrors;
  notFound: boolean;
  saving: boolean;
  confirmRemove: boolean;
  removing: boolean;
  error: string | null;
  firstName: string;
  lastName: string;
  email: string;
  originalEmail: string;
  phone: string;
  gender: GenderValue;
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
  | { type: "SET_GENDER"; gender: GenderValue }
  | { type: "SET_ROLE"; role: SystemRole }
  | { type: "SET_FIELD_ERRORS"; errors: UserErrors };

const initial: State = {
  loading: true,
  fieldErrors: {},
  notFound: false,
  saving: false,
  confirmRemove: false,
  removing: false,
  error: null,
  firstName: "",
  lastName: "",
  email: "",
  originalEmail: "",
  phone: "",
  gender: "",
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
        originalEmail: action.profile.email ?? "",
        phone: action.profile.phone ?? "",
        gender: action.profile.gender ?? "",
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
      return {
        ...state,
        [action.field]: action.value,
        fieldErrors: { ...state.fieldErrors, [action.field]: undefined },
      };
    case "SET_FIELD_ERRORS":
      return { ...state, fieldErrors: action.errors, saving: false };
    case "SET_GENDER":
      return { ...state, gender: action.gender };
    case "SET_ROLE":
      return { ...state, role: action.role };
  }
}

// ─── Constants ────────────────────────────────────────────────

/**
 * Only system roles: this screen edits an existing `profiles` row, and a
 * profile cannot be turned into a contact. Same labels and order as the
 * creation form.
 */
const ROLE_VALUES: SystemRole[] = ["staff", "partner", "admin"];

// ─── Page ─────────────────────────────────────────────────────

export default function EditUserPage() {
  const t = useTranslations("dashboard.users.detail");
  const tForm = useTranslations("dashboard.users.form");
  const tCommon = useTranslations("dashboard.common");
  const genderOptions = useGenderOptions();
  const roles: SelectOption<SystemRole>[] = ROLE_VALUES.map((value) => ({
    value,
    label: tForm(`roles.${value}.label`),
    desc: tForm(`roles.${value}.desc`),
  }));
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
        .select(
          "id, first_name, last_name, full_name, email, phone, gender, role",
        )
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

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    dispatch({ type: "SET_ERROR", msg: null });

    const errors = parseErrors(dashboardUserSchema, {
      firstName: state.firstName,
      lastName: state.lastName,
      email: normalizeEmail(state.email) ?? "",
      phone: state.phone,
      gender: state.gender,
      role: state.role,
    });
    if (Object.keys(errors).length > 0) {
      dispatch({ type: "SET_FIELD_ERRORS", errors });
      return;
    }

    const trimFirst = state.firstName.trim();
    if (!trimFirst) {
      dispatch({ type: "SET_ERROR", msg: "El nombre es obligatorio." });
      return;
    }

    dispatch({ type: "SET_SAVING", value: true });

    const { error } = await updateUserProfile(getAccessToken(), {
      userId: id,
      email: normalizeEmail(state.email) ?? "",
      firstName: state.firstName,
      lastName: state.lastName,
      phone: normalizePhone(state.phone) ?? "",
      gender: toStoredGender(state.gender),
      role: state.role,
      currentEmail: state.originalEmail,
    });

    if (error) {
      dispatch({ type: "SET_ERROR", msg: error });
      dispatch({ type: "SET_SAVING", value: false });
      return;
    }

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
      setPwError(t("password.mismatch"));
      return;
    }
    if (pwNew.length < 8) {
      setPwError(t("password.tooShort"));
      return;
    }
    setPwLoading(true);
    const { error } = await setUserPassword(getAccessToken(), id, pwNew);
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
    const { error } = await removeUserAccess(getAccessToken(), id);
    if (error) {
      dispatch({ type: "SET_ERROR", msg: error });
      dispatch({ type: "SET_REMOVING", value: false });
      return;
    }
    push("/dashboard/users");
  }

  if (notFound) {
    return (
      <div className="text-petroleum-400 flex flex-col items-center justify-center py-24">
        <p className="text-sm">{t("notFound")}</p>
        <button
          onClick={() => back()}
          className="hover:text-petroleum-700 mt-4 text-xs underline"
        >
          {t("goBack")}
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
            {t("title")}
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
              {t("removeAccess")}
            </Button>
            <Button variant="outline" size="md" href="/dashboard/users">
              {tCommon("cancel")}
            </Button>
            <Button
              type="submit"
              variant="solid"
              size="md"
              disabled={saving || loading}
            >
              {saving ? t("saving") : t("save")}
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
              {t("sections.role")}
            </h2>
            {loading ? (
              <div className="bg-sand-100 h-20 animate-pulse rounded-xl" />
            ) : (
              <OptionSelect
                id="role"
                value={state.role}
                options={roles}
                onChange={(nextRole) =>
                  dispatch({ type: "SET_ROLE", role: nextRole })
                }
                disabled={saving}
                ariaLabel={tForm("fields.role")}
              />
            )}
          </div>

          {/* Details */}
          <div className="border-sand-200 rounded-2xl border bg-white p-6">
            <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
              {t("sections.details")}
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="firstName"
                    className="text-petroleum-500 text-xs font-medium"
                  >
                    {tForm("fields.firstName")}{" "}
                    <span className="text-red-400">*</span>
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
                  {state.fieldErrors.firstName && (
                    <p className="text-xs text-red-500">
                      {state.fieldErrors.firstName}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="lastName"
                    className="text-petroleum-500 text-xs font-medium"
                  >
                    {tForm("fields.lastName")}
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
                  {state.fieldErrors.lastName && (
                    <p className="text-xs text-red-500">
                      {state.fieldErrors.lastName}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="email"
                  className="text-petroleum-500 text-xs font-medium"
                >
                  {tForm("fields.email")}
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
                {state.fieldErrors.email && (
                  <p className="text-xs text-red-500">
                    {state.fieldErrors.email}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="phone"
                  className="text-petroleum-500 text-xs font-medium"
                >
                  {tForm("fields.phone")}
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
                {state.fieldErrors.phone && (
                  <p className="text-xs text-red-500">
                    {state.fieldErrors.phone}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="gender"
                  className="text-petroleum-500 text-xs font-medium"
                >
                  {tForm("fields.gender")}
                </label>
                {loading ? (
                  <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
                ) : (
                  <OptionSelect
                    id="gender"
                    value={state.gender}
                    options={genderOptions}
                    onChange={(next) =>
                      dispatch({ type: "SET_GENDER", gender: next })
                    }
                    disabled={saving}
                    ariaLabel={tForm("fields.gender")}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Password */}
          {!loading && (
            <div className="border-sand-200 rounded-2xl border bg-white p-6">
              <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
                {t("sections.password")}
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
                    {t("password.new")}
                  </label>
                  <PasswordInput
                    id="pw-new"
                    value={pwNew}
                    onChange={(e) => setPwNew(e.target.value)}
                    placeholder={t("password.placeholder")}
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
                    {t("password.confirm")}
                  </label>
                  <PasswordInput
                    id="pw-confirm"
                    value={pwConfirm}
                    onChange={(e) => setPwConfirm(e.target.value)}
                    placeholder={t("password.placeholder")}
                    disabled={pwLoading || saving}
                    autoComplete="new-password"
                    inputClassName={INPUT_CLASS}
                  />
                </div>

                <div className="flex items-center justify-end gap-4">
                  {pwOk && (
                    <p className="text-sm font-medium text-green-700">
                      {t("password.updated")}
                    </p>
                  )}
                  <Button
                    type="button"
                    variant="solid"
                    size="md"
                    onClick={() => void handleChangePw()}
                    disabled={pwLoading || saving || !pwNew || !pwConfirm}
                  >
                    {pwLoading ? t("saving") : t("password.change")}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Services — only when role is Staff */}
          {!loading && state.role === "staff" && (
            <div className="border-sand-200 rounded-2xl border bg-white p-6">
              <h2 className="text-petroleum-500 mb-1 text-sm font-semibold">
                {t("sections.services")}
              </h2>
              <p className="text-petroleum-400 mb-4 text-xs">
                {t("servicesHint")}
              </p>
              <div className="space-y-2">
                {availableServices.map((svc) => {
                  const assigned = assignments.find(
                    (a) => a.service_id === svc.id,
                  );
                  const isOn = !!assigned;
                  const calEmail = assigned?.google_calendar_email ?? null;
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
                        <div className="border-petroleum-100 border-t px-4 pt-3 pb-3">
                          <p className="text-petroleum-400 mb-2 text-xs font-medium">
                            {t("calendar.label")}
                          </p>
                          {calEmail ? (
                            <div className="flex items-center gap-3">
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                                <span className="size-1.5 rounded-full bg-green-500" />
                                {t("calendar.connected")}
                              </span>
                              <span className="text-petroleum-400 max-w-[200px] truncate text-xs">
                                {calEmail}
                              </span>
                              <button
                                type="button"
                                onClick={async () => {
                                  await disconnectStaffCalendar(id, svc.id);
                                  setAssignments((prev) =>
                                    prev.map((a) =>
                                      a.service_id === svc.id
                                        ? { ...a, google_calendar_email: "" }
                                        : a,
                                    ),
                                  );
                                }}
                                className="text-petroleum-300 text-xs transition-colors hover:text-red-500"
                              >
                                {t("calendar.disconnect")}
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                void connectStaffCalendar(
                                  id,
                                  svc.id,
                                  `/dashboard/users/${id}`,
                                )
                              }
                              className="bg-petroleum-700 hover:bg-petroleum-600 inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium text-white transition-colors"
                            >
                              <IconCalendarConnect />
                              {t("calendar.connect")}
                            </button>
                          )}
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
                {t("removeDialog.title")}
              </h3>
              <p className="text-petroleum-400 text-sm">
                {t("removeDialog.body")}
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
                {removing
                  ? t("removeDialog.removing")
                  : t("removeDialog.confirm")}
              </Button>
              <Button
                variant="outline"
                size="md"
                onClick={() => dispatch({ type: "CLOSE_REMOVE" })}
                disabled={removing}
                className="w-full"
              >
                {tCommon("cancel")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
