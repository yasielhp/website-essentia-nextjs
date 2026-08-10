"use client";

import { useEffect, useReducer, useState, Suspense } from "react";
import { useTranslations } from "next-intl";
import { notifySuccess } from "@/lib/feedback";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { PasswordSection } from "./password-section";
import { ProfileForm } from "./profile-form";
import { initialState, reducer } from "./state";
import { useRole } from "@/context/role-context";
import { insforge } from "@/lib/insforge";
import { ImageUpload } from "@/components/ui/image-upload";
import {
  connectStaffCalendar,
  disconnectStaffCalendar,
  fetchStaffCalendarConfigs,
  fetchStaffServices,
} from "@/services/calendar.client";
import { accountProfileSchema, parseErrors } from "@/lib/schemas";
import { useFieldError } from "@/hooks/use-field-error";
import { setPreferredLanguage } from "@/actions/preferred-language";

type ServiceCalConfig = {
  service_id: string;
  service_title: string;
  google_calendar_email: string | null;
};

function CalendarServiceRow({
  staffId,
  svc,
  justConnectedServiceId,
}: {
  staffId: string;
  svc: ServiceCalConfig;
  justConnectedServiceId: string | null;
}) {
  const t = useTranslations("dashboard.account.calendar");
  // Derived from the prop rather than copied into state: a copy taken on the
  // first render kept showing the old address after the parent refetched.
  // `disconnected` records only what this row itself did.
  const [disconnected, setDisconnected] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const email = disconnected ? null : svc.google_calendar_email;

  const justConnected = justConnectedServiceId === svc.service_id && !!email;

  async function handleDisconnect() {
    setDisconnecting(true);
    await disconnectStaffCalendar(staffId, svc.service_id);
    setDisconnected(true);
    setDisconnecting(false);
  }

  return (
    <div className="border-sand-200 rounded-xl border p-4">
      <p className="text-petroleum-700 mb-3 text-sm font-medium">
        {svc.service_title}
      </p>
      {email ? (
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
            <span className="size-1.5 rounded-full bg-green-500" />
            {t("connected")}
          </span>
          <span className="text-petroleum-400 max-w-50 truncate text-xs">
            {email}
          </span>
          <button
            type="button"
            onClick={() => void handleDisconnect()}
            disabled={disconnecting}
            className="text-petroleum-300 text-xs transition-colors hover:text-red-500"
          >
            {disconnecting ? t("disconnecting") : t("disconnect")}
          </button>
          {justConnected && (
            <span className="text-xs font-medium text-green-700">
              {t("justConnected")}
            </span>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() =>
            void connectStaffCalendar(
              staffId,
              svc.service_id,
              `/dashboard/account?service_id=${svc.service_id}`,
            )
          }
          className="bg-petroleum-700 hover:bg-petroleum-600 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white transition-colors"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path
              d="M8 7H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M8 7h8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {t("connect")}
        </button>
      )}
    </div>
  );
}

function GoogleCalendarSection({ userId }: { userId: string }) {
  const t = useTranslations("dashboard.account");
  const searchParams = useSearchParams();
  const [services, setServices] = useState<ServiceCalConfig[]>([]);
  const [loadingCal, setLoadingCal] = useState(true);
  const justConnectedServiceId =
    searchParams.get("calendar_connected") === "1"
      ? searchParams.get("service_id")
      : null;

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const [configs, assignedServices] = await Promise.all([
        fetchStaffCalendarConfigs(userId),
        fetchStaffServices(userId),
      ]);

      if (cancelled) return;

      const configMap = new Map(
        configs.map((c) => [c.service_id, c.google_calendar_email]),
      );

      setServices(
        assignedServices.map((s) => ({
          service_id: s.id,
          service_title: s.title,
          google_calendar_email: configMap.get(s.id) ?? null,
        })),
      );
      setLoadingCal(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loadingCal) {
    return (
      <div className="border-sand-200 rounded-2xl border bg-white p-6">
        <div className="bg-sand-100 mb-4 h-4 w-40 animate-pulse rounded" />
        <div className="space-y-3">
          <div className="bg-sand-100 h-20 animate-pulse rounded-xl" />
          <div className="bg-sand-100 h-20 animate-pulse rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="border-sand-200 rounded-2xl border bg-white p-6">
      <h2 className="text-petroleum-500 mb-1 text-sm font-semibold">
        {t("sections.calendar")}
      </h2>
      <p className="text-petroleum-400 mb-4 text-xs">{t("calendar.hint")}</p>
      {services.length === 0 ? (
        <p className="text-petroleum-300 text-sm">{t("calendar.noServices")}</p>
      ) : (
        <div className="space-y-3">
          {services.map((svc) => (
            <CalendarServiceRow
              key={svc.service_id}
              staffId={userId}
              svc={svc}
              justConnectedServiceId={justConnectedServiceId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function DashboardAccountPage() {
  const tToasts = useTranslations("dashboard.toasts");
  const t = useTranslations("dashboard.account");
  const { refresh } = useRouter();
  const tValidation = useTranslations("dashboard.validation");
  const fieldError = useFieldError();
  const { user } = useAuth();
  const { role } = useRole();
  const [state, dispatch] = useReducer(reducer, initialState);

  const { loading, firstName, lastName, phone, language, avatarUrl } = state;

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    async function load() {
      if (!user) return;
      const { data } = await insforge.database
        .from("profiles")
        .select(
          "first_name, last_name, full_name, phone, avatar_url, preferred_language",
        )
        .eq("id", user.id)
        .single();

      if (cancelled) return;

      const profile = data as {
        first_name: string | null;
        last_name: string | null;
        full_name: string | null;
        phone: string | null;
        preferred_language: string | null;
        avatar_url: string | null;
      } | null;

      const derivedFirst =
        profile?.first_name ??
        (profile?.full_name ? profile.full_name.split(" ")[0] : "");
      const derivedLast =
        profile?.last_name ??
        (profile?.full_name
          ? profile.full_name.split(" ").slice(1).join(" ")
          : "");

      dispatch({
        type: "LOAD_SUCCESS",
        payload: {
          firstName: derivedFirst ?? "",
          lastName: derivedLast ?? "",
          phone: profile?.phone ?? "",
          language: profile?.preferred_language ?? "en",
          avatarUrl: profile?.avatar_url ?? "",
        },
      });
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [user]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    dispatch({ type: "SET_ERROR", error: null });

    const errs = parseErrors(accountProfileSchema, {
      firstName: firstName.trim(),
      lastName: lastName.trim() || undefined,
      phone: phone.trim() || undefined,
    });
    if (Object.keys(errs).length > 0) {
      dispatch({
        type: "SET_ERROR",
        error:
          fieldError(errs.firstName ?? errs.phone) || tValidation("fixErrors"),
      });
      return;
    }

    dispatch({ type: "SET_SAVING", value: true });
    const trimmedFirst = firstName.trim();
    const fullName = [trimmedFirst, lastName.trim()].filter(Boolean).join(" ");

    await insforge.database
      .from("profiles")
      .update({
        first_name: trimmedFirst,
        last_name: lastName.trim() || null,
        full_name: fullName,
        phone: phone.trim() || null,
        preferred_language: language,
        avatar_url: avatarUrl || null,
      })
      .eq("id", user!.id);

    dispatch({ type: "SET_SAVING", value: false });
    await setPreferredLanguage(language);
    notifySuccess(tToasts("accountSaved"));
    refresh();
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      <div className="mb-8">
        <h1 className="font-display text-petroleum-700 text-3xl">
          {t("title")}
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <ProfileForm
            state={state}
            dispatch={dispatch}
            email={user?.email ?? ""}
            onSubmit={(e) => void handleSave(e)}
          />

          {/* Staff and admins both: staff so their own bookings land on their
              calendar, admins so one calendar mirrors the whole centre. */}
          {!loading && user && (role === "staff" || role === "admin") && (
            <Suspense fallback={null}>
              {/* The boundary is what keeps `useSearchParams` inside this
                  section from opting the whole page out of prerendering. */}
              <GoogleCalendarSection userId={user.id} />
            </Suspense>
          )}

          <PasswordSection userId={user!.id} />
        </div>

        <div>
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
        </div>
      </div>
    </div>
  );
}
