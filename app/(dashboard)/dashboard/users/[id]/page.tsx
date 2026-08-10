"use client";

import { useEffect, useReducer, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { notifySuccess } from "@/lib/feedback";
import { insforge } from "@/lib/insforge";
import {
  dashboardUserSchema,
  parseErrors,
  type FormErrors,
} from "@/lib/schemas";
import { normalizeEmail, normalizePhone } from "@/utils/contact";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "@/components/ui/image-upload";
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
  connectAccountCalendar,
  disconnectAccountCalendar,
  resyncAccountCalendar,
} from "@/services/calendar.client";
import { IconTrash, IconCalendarConnect } from "@/components/ui/icons";
import { EmailInput } from "@/components/ui/email-input";
import {
  StaffScheduleEditor,
  normaliseSchedule,
} from "@/components/dashboard/users/staff-schedule-editor";
import type { WeeklySchedule } from "@/types/schedule";

type SystemRole = "admin" | "staff" | "partner";

type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
  phone: string | null;
  gender: GenderValue | null;
  job_title: string | null;
  preferred_language: string | null;
  role: SystemRole;
  google_connected_email: string | null;
  schedule: WeeklySchedule | null;
  slot_interval_minutes: number | null;
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
  language: string;
  role: SystemRole;
  avatarUrl: string;
  jobTitle: string;
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
      field:
        "firstName" | "lastName" | "email" | "phone" | "jobTitle" | "sortOrder";
      value: string;
    }
  | { type: "SET_GENDER"; gender: GenderValue }
  | { type: "SET_LANGUAGE"; language: string }
  | { type: "SET_AVATAR_URL"; value: string }
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
  language: "en",
  role: "staff",
  avatarUrl: "",
  jobTitle: "",
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
        jobTitle: action.profile.job_title ?? "",
        language: action.profile.preferred_language ?? "en",
        role: action.profile.role,
        avatarUrl: action.profile.avatar_url ?? "",
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
    case "SET_AVATAR_URL":
      return { ...state, avatarUrl: action.value };
    case "SET_LANGUAGE":
      return { ...state, language: action.language };
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
  const tToasts = useTranslations("dashboard.toasts");
  const t = useTranslations("dashboard.users.detail");
  const tForm = useTranslations("dashboard.users.form");
  const tCommon = useTranslations("dashboard.common");
  const tSchedule = useTranslations("dashboard.users.schedule");
  const tCalendar = useTranslations("dashboard.users.calendarBox");
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
  const { avatarUrl } = state;

  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [calendarEmail, setCalendarEmail] = useState<string | null>(null);
  const [resyncing, setResyncing] = useState(false);
  const [schedule, setSchedule] = useState<WeeklySchedule>(() =>
    normaliseSchedule(null),
  );
  const [slotInterval, setSlotInterval] = useState(30);
  // Saving overwrites the schedule, so it must not run before the stored one
  // has been read: the empty form would be written over the real hours.
  /**
   * Whether the schedule came back from the server.
   *
   * A ref, not state: nothing on screen depends on it. It exists so that
   * saving before the load finishes does not write an empty schedule over a
   * real one, and every render it forced was a render for nobody.
   */
  const scheduleLoadedRef = useRef(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwOk, setPwOk] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data } = await insforge.database
        .from("profiles")
        .select(
          "id, first_name, last_name, full_name, email, phone, gender, role, preferred_language, avatar_url, job_title, google_connected_email, schedule, slot_interval_minutes",
        )
        .eq("id", id)
        .in("role", ["admin", "staff", "partner"])
        .limit(1);

      if (cancelled) return;

      const profile = (data as Profile[] | null)?.[0];
      if (!profile) {
        dispatch({ type: "NOT_FOUND" });
        return;
      }
      dispatch({ type: "LOADED", profile });
      setCalendarEmail(profile.google_connected_email);
      setSchedule(normaliseSchedule(profile.schedule));
      setSlotInterval(profile.slot_interval_minutes ?? 30);
      scheduleLoadedRef.current = true;
    }
    void load();

    return () => {
      cancelled = true;
    };
  }, [id]);

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
      preferredLanguage: state.language,
      role: state.role,
      currentEmail: state.originalEmail,
      avatarUrl: state.avatarUrl || null,
      jobTitle: state.role === "staff" ? state.jobTitle.trim() : null,
      ...(state.role === "staff" && scheduleLoadedRef.current
        ? { schedule, slotIntervalMinutes: slotInterval }
        : {}),
    });

    if (error) {
      dispatch({ type: "SET_ERROR", msg: error });
      dispatch({ type: "SET_SAVING", value: false });
      return;
    }

    dispatch({ type: "SET_SAVING", value: false });
    notifySuccess(tToasts("userSaved"));
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
    try {
      const { error } = await setUserPassword(getAccessToken(), id, pwNew);
      if (error) {
        setPwError(error);
        return;
      }
      setPwNew("");
      setPwConfirm("");
      setPwOk(true);
    } finally {
      // A thrown action used to leave the form disabled with no way back.
      setPwLoading(false);
    }
    notifySuccess(tToasts("passwordChanged"));
  }

  async function handleRemove() {
    dispatch({ type: "SET_REMOVING", value: true });
    const { error } = await removeUserAccess(getAccessToken(), id);
    if (error) {
      dispatch({ type: "SET_ERROR", msg: error });
      dispatch({ type: "SET_REMOVING", value: false });
      return;
    }
    notifySuccess(tToasts("accessRemoved"));
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

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_20rem]">
          <div className="flex flex-col gap-6">
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
                    <EmailInput
                      id="email"
                      value={state.email}
                      onChange={(value) =>
                        dispatch({
                          type: "SET_FIELD",
                          field: "email",
                          value: value,
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

                {/* Only staff hold a job title: it names what they do. */}
                {state.role === "staff" && (
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="job-title"
                      className="text-petroleum-500 text-xs font-medium"
                    >
                      {tForm("fields.jobTitle")}
                    </label>
                    {loading ? (
                      <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
                    ) : (
                      <input
                        id="job-title"
                        type="text"
                        value={state.jobTitle}
                        onChange={(e) =>
                          dispatch({
                            type: "SET_FIELD",
                            field: "jobTitle",
                            value: e.target.value,
                          })
                        }
                        placeholder={tForm("fields.jobTitlePlaceholder")}
                        disabled={saving}
                        className={INPUT_CLASS}
                      />
                    )}
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="language"
                    className="text-petroleum-500 text-xs font-medium"
                  >
                    {tForm("fields.preferredLanguage")}
                  </label>
                  {loading ? (
                    <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
                  ) : (
                    <select
                      id="language"
                      value={state.language}
                      onChange={(e) =>
                        dispatch({
                          type: "SET_LANGUAGE",
                          language: e.target.value,
                        })
                      }
                      disabled={saving}
                      className={INPUT_CLASS}
                    >
                      <option value="en">English</option>
                      <option value="es">Español</option>
                    </select>
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

            {/* Schedule — whoever takes bookings has working days */}
            {!loading && state.role === "staff" && (
              <div className="border-sand-200 rounded-2xl border bg-white p-6">
                <h2 className="text-petroleum-500 mb-1 text-sm font-semibold">
                  {tSchedule("heading")}
                </h2>
                <p className="text-petroleum-400 mb-4 text-xs">
                  {tSchedule("hint")}
                </p>
                <StaffScheduleEditor
                  schedule={schedule}
                  interval={slotInterval}
                  onChange={setSchedule}
                  onIntervalChange={setSlotInterval}
                  disabled={saving}
                />
              </div>
            )}
          </div>

          {/* Photo, alongside the fields rather than between them */}
          <div className="flex flex-col gap-6 lg:sticky lg:top-24">
            {/* Photo — every role has one, same bucket the account page uses */}
            <div className="border-sand-200 rounded-2xl border bg-white p-6">
              <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
                {t("sections.photo")}
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

            {/* Google Calendar — theirs, checked when offering slots */}
            {!loading && state.role === "staff" && (
              <div className="border-sand-200 rounded-2xl border bg-white p-6">
                <h2 className="text-petroleum-500 mb-1 text-sm font-semibold">
                  {t("calendar.label")}
                </h2>
                <p className="text-petroleum-400 mb-4 text-xs">
                  {tCalendar("hint")}
                </p>
                {calendarEmail && (
                  <p className="text-petroleum-400 mb-3 truncate text-xs">
                    {calendarEmail}
                  </p>
                )}
                <div className="flex flex-col gap-2">
                  {calendarEmail ? (
                    <>
                      {/* Bookings made while the calendar was disconnected —
                          or whose sync failed — have no event yet. */}
                      <button
                        type="button"
                        disabled={resyncing}
                        onClick={async () => {
                          setResyncing(true);
                          const result = await resyncAccountCalendar(id);
                          setResyncing(false);
                          notifySuccess(
                            result
                              ? tCalendar("resynced", {
                                  synced: result.synced,
                                  failed: result.failed,
                                })
                              : tCalendar("resyncFailed"),
                          );
                        }}
                        className="border-sand-200 text-petroleum-700 hover:bg-sand-50 w-full rounded-xl border px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50"
                      >
                        {resyncing
                          ? tCalendar("resyncing")
                          : tCalendar("resync")}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await disconnectAccountCalendar(id);
                          setCalendarEmail(null);
                        }}
                        className="w-full rounded-xl border border-red-200 px-3 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                      >
                        {tCalendar("disconnect")}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        void connectAccountCalendar(
                          id,
                          `/dashboard/users/${id}`,
                        )
                      }
                      className="bg-petroleum-700 hover:bg-petroleum-600 inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-white transition-colors"
                    >
                      <IconCalendarConnect />
                      {tCalendar("connect")}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
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
