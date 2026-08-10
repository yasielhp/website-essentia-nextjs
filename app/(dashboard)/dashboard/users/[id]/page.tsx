"use client";

import { useEffect, useReducer, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { notifySuccess } from "@/lib/feedback";
import { insforge } from "@/lib/insforge";
import { dashboardUserSchema, parseErrors } from "@/lib/schemas";
import { normalizeEmail, normalizePhone } from "@/utils/contact";
import { Button } from "@/components/ui/button";
import { removeUserAccess } from "@/actions/remove-user-access";
import { updateUserProfile } from "@/actions/update-user-profile";
import { getAccessToken } from "@/lib/client-session";
import { toStoredGender } from "@/constants/gender";
import { IconTrash } from "@/components/ui/icons";
import { StaffScheduleEditor } from "@/components/dashboard/users/staff-schedule-editor";
import { normaliseSchedule } from "@/utils/staff-schedule";
import type { WeeklySchedule } from "@/types/schedule";
import { PasswordSection } from "./password-section";
import { UserSidebar } from "./user-sidebar";
import { UserFields } from "./user-fields";
import { initial, reducer, type Profile } from "./form-state";

// ─── Page ─────────────────────────────────────────────────────

export default function EditUserPage() {
  const tToasts = useTranslations("dashboard.toasts");
  const t = useTranslations("dashboard.users.detail");
  const tCommon = useTranslations("dashboard.common");
  const tSchedule = useTranslations("dashboard.users.schedule");
  const { id } = useParams<{ id: string }>();
  const { push, back } = useRouter();
  const [state, dispatch] = useReducer(reducer, initial);
  const { loading, notFound, saving, removing, confirmRemove, error } = state;
  const { avatarUrl } = state;

  const [calendarEmail, setCalendarEmail] = useState<string | null>(null);
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
            <UserFields state={state} dispatch={dispatch} />

            {/* Password */}
            {!loading && <PasswordSection userId={id} saving={saving} />}

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

          <UserSidebar
            userId={id}
            role={state.role}
            loading={loading}
            avatarUrl={avatarUrl}
            onAvatarChange={(value) =>
              dispatch({ type: "SET_AVATAR_URL", value })
            }
            calendarEmail={calendarEmail}
            onDisconnected={() => setCalendarEmail(null)}
          />
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
