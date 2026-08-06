"use client";

import { useEffect, useReducer, useState } from "react";
import { useTranslations } from "next-intl";
import { notifySuccess } from "@/lib/feedback";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { useRole } from "@/context/role-context";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "@/components/ui/image-upload";
import { PasswordInput } from "@/components/ui/input";
import { setUserPassword } from "@/actions/set-user-password";
import { getAccessToken } from "@/lib/client-session";
import {
  connectStaffCalendar,
  disconnectStaffCalendar,
  fetchStaffCalendarConfigs,
  fetchStaffServices,
} from "@/services/calendar.client";
import { accountProfileSchema, parseErrors } from "@/lib/schemas";
import { useFieldError } from "@/hooks/use-field-error";

const INPUT_CLASS =
  "border-sand-200 bg-white text-petroleum-700 placeholder:text-petroleum-300 focus:border-petroleum-400 focus:ring-petroleum-100 rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 w-full disabled:opacity-60";

type PageState = {
  loading: boolean;
  saving: boolean;
  error: string | null;
  firstName: string;
  lastName: string;
  phone: string;
  avatarUrl: string;
};

type PageAction =
  | {
      type: "LOAD_SUCCESS";
      payload: {
        firstName: string;
        lastName: string;
        phone: string;
        avatarUrl: string;
      };
    }
  | { type: "SET_SAVING"; value: boolean }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "SET_FIRST_NAME"; value: string }
  | { type: "SET_LAST_NAME"; value: string }
  | { type: "SET_PHONE"; value: string }
  | { type: "SET_AVATAR_URL"; value: string };

const initialState: PageState = {
  loading: true,
  saving: false,
  error: null,
  firstName: "",
  lastName: "",
  phone: "",
  avatarUrl: "",
};

function reducer(state: PageState, action: PageAction): PageState {
  switch (action.type) {
    case "LOAD_SUCCESS":
      return { ...state, loading: false, ...action.payload };
    case "SET_SAVING":
      return { ...state, saving: action.value };
    case "SET_ERROR":
      return { ...state, error: action.error };
    case "SET_FIRST_NAME":
      return { ...state, firstName: action.value };
    case "SET_LAST_NAME":
      return { ...state, lastName: action.value };
    case "SET_PHONE":
      return { ...state, phone: action.value };
    case "SET_AVATAR_URL":
      return { ...state, avatarUrl: action.value };
  }
}

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
  const [email, setEmail] = useState(svc.google_calendar_email);
  const [disconnecting, setDisconnecting] = useState(false);

  const justConnected = justConnectedServiceId === svc.service_id && !!email;

  async function handleDisconnect() {
    setDisconnecting(true);
    await disconnectStaffCalendar(staffId, svc.service_id);
    setEmail(null);
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
          <span className="text-petroleum-400 max-w-[200px] truncate text-xs">
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
    void (async () => {
      const [configs, assignedServices] = await Promise.all([
        fetchStaffCalendarConfigs(userId),
        fetchStaffServices(userId),
      ]);

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
  const tUsers = useTranslations("dashboard.users.form");
  const tValidation = useTranslations("dashboard.validation");
  const fieldError = useFieldError();
  const { user } = useAuth();
  const { role } = useRole();
  const [state, dispatch] = useReducer(reducer, initialState);

  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwOk, setPwOk] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  const { loading, saving, error, firstName, lastName, phone, avatarUrl } =
    state;

  useEffect(() => {
    if (!user) return;

    async function load() {
      if (!user) return;
      const { data } = await insforge.database
        .from("profiles")
        .select("first_name, last_name, full_name, phone, avatar_url")
        .eq("id", user.id)
        .single();

      const profile = data as {
        first_name: string | null;
        last_name: string | null;
        full_name: string | null;
        phone: string | null;
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
          avatarUrl: profile?.avatar_url ?? "",
        },
      });
    }

    void load();
  }, [user]);

  async function handleChangePw(e: React.FormEvent) {
    e.preventDefault();
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
    const { error } = await setUserPassword(getAccessToken(), user!.id, pwNew);
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
        avatar_url: avatarUrl || null,
      })
      .eq("id", user!.id);

    dispatch({ type: "SET_SAVING", value: false });
    notifySuccess(tToasts("accountSaved"));
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
          <form onSubmit={(e) => void handleSave(e)} noValidate>
            <div className="border-sand-200 rounded-2xl border bg-white p-6">
              <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
                {t("sections.profile")}
              </h2>

              {error && (
                <p className="mb-4 rounded-xl bg-red-100 px-4 py-3 text-sm text-red-600">
                  {error}
                </p>
              )}

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="firstName"
                      className="text-petroleum-500 text-xs font-medium"
                    >
                      {tUsers("fields.firstName")}{" "}
                      <span className="text-red-400">*</span>
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
                        placeholder={tUsers("fields.firstNamePlaceholder")}
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
                      {tUsers("fields.lastName")}
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
                        placeholder={tUsers("fields.lastNamePlaceholder")}
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
                    {tUsers("fields.email")}
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={user?.email ?? ""}
                    disabled
                    readOnly
                    className={INPUT_CLASS}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="phone"
                    className="text-petroleum-500 text-xs font-medium"
                  >
                    {tUsers("fields.phone")}
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
                      placeholder={tUsers("fields.phonePlaceholder")}
                      disabled={saving}
                      className={INPUT_CLASS}
                    />
                  )}
                </div>
              </div>

              <div className="mt-5 flex justify-end">
                <Button
                  type="submit"
                  variant="solid"
                  size="md"
                  disabled={saving || loading}
                  className="gap-1.5"
                >
                  {saving ? t("saving") : t("saveChanges")}
                </Button>
              </div>
            </div>
          </form>

          {/* Google Calendar — solo para staff */}
          {!loading && user && role === "staff" && (
            <GoogleCalendarSection userId={user.id} />
          )}

          {/* Security */}
          <div className="border-sand-200 rounded-2xl border bg-white p-6">
            <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
              {t("sections.security")}
            </h2>
            <form
              onSubmit={(e) => void handleChangePw(e)}
              className="space-y-4"
              noValidate
            >
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
                  disabled={pwLoading}
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
                  disabled={pwLoading}
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
                  type="submit"
                  variant="solid"
                  size="md"
                  disabled={pwLoading || !pwNew || !pwConfirm}
                >
                  {pwLoading ? t("saving") : t("password.change")}
                </Button>
              </div>
            </form>
          </div>
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
