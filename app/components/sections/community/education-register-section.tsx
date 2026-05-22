"use client";

import { useRef, useEffect, useReducer, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import gsap from "gsap";
import Image from "next/image";
import Link from "next/link";
import { Calendar, Clock, Lock, Users, type LucideIcon } from "lucide-react";
import { Button } from "@components/ui/button";
import { Checkbox } from "@components/ui/input";
import { Accordion } from "@components/ui/accordion";
import { contact } from "@/constants/contact";
import { insforge } from "@/lib/insforge";
import { useAuth } from "@/components/auth-provider";
import { useLocale, useTranslations } from "next-intl";

type Session = {
  id: string;
  title: string;
  description: string | null;
  date: string | null;
  duration_minutes: number | null;
  location: string | null;
  max_participants: number | null;
  speaker: string | null;
  speaker_role: string | null;
  price_cents: number | null;
};

type Stage = "form" | "member-blocker" | "success";
type FormFields = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

type RegisterState = {
  session: Session | null;
  stage: Stage;
  loading: boolean;
  checking: boolean;
  consent: boolean;
  consentError: string | undefined;
  form: FormFields;
};

type RegisterAction =
  | { type: "SET_SESSION"; session: Session }
  | { type: "SET_STAGE"; stage: Stage }
  | { type: "SUBMIT_START" }
  | { type: "SUBMIT_SUCCESS" }
  | { type: "SUBMIT_MEMBER_BLOCKER" }
  | { type: "CONFIRM_START" }
  | { type: "CONFIRM_SUCCESS" }
  | { type: "SET_CONSENT"; value: boolean }
  | { type: "SET_CONSENT_ERROR"; error: string }
  | { type: "SET_FIELD"; field: keyof FormFields; value: string };

function registerReducer(
  state: RegisterState,
  action: RegisterAction,
): RegisterState {
  switch (action.type) {
    case "SET_SESSION":
      return { ...state, session: action.session };
    case "SET_STAGE":
      return { ...state, stage: action.stage };
    case "SUBMIT_START":
      return { ...state, checking: true };
    case "SUBMIT_SUCCESS":
      return { ...state, checking: false, stage: "success" };
    case "SUBMIT_MEMBER_BLOCKER":
      return { ...state, checking: false, stage: "member-blocker" };
    case "CONFIRM_START":
      return { ...state, loading: true };
    case "CONFIRM_SUCCESS":
      return { ...state, loading: false, stage: "success" };
    case "SET_CONSENT":
      return { ...state, consent: action.value, consentError: undefined };
    case "SET_CONSENT_ERROR":
      return { ...state, consentError: action.error };
    case "SET_FIELD":
      return {
        ...state,
        form: { ...state.form, [action.field]: action.value },
      };
  }
}

const initialState: RegisterState = {
  session: null,
  stage: "form",
  loading: false,
  checking: false,
  consent: false,
  consentError: undefined,
  form: { firstName: "", lastName: "", email: "", phone: "" },
};

function formatSessionDate(iso: string | null, locale: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(locale === "es" ? "es-ES" : "en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Atlantic/Canary",
  });
}

function formatSessionTimeRange(
  iso: string | null,
  durationMinutes: number | null,
  locale: string,
): string {
  if (!iso) return "—";
  const intl = locale === "es" ? "es-ES" : "en-GB";
  const start = new Date(iso);
  const startStr = start.toLocaleTimeString(intl, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Atlantic/Canary",
  });
  if (durationMinutes) {
    const end = new Date(start.getTime() + durationMinutes * 60_000);
    const endStr = end.toLocaleTimeString(intl, {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Atlantic/Canary",
    });
    return `${startStr} – ${endStr}`;
  }
  return startStr;
}

function formatPrice(
  priceCents: number | null,
  labels: { membersOnly: string; free: string },
): string {
  if (priceCents === null) return labels.membersOnly;
  if (priceCents === 0) return labels.free;
  return `€${(priceCents / 100).toFixed(2)}`;
}

const inputClass =
  "bg-sand-100 text-petroleum-700 placeholder:text-petroleum-300 border border-sand-300 rounded-xl px-4 py-3 text-sm outline-none transition-all duration-200 focus:border-petroleum-400 focus:ring-2 focus:ring-petroleum-200";

const whatToBringKeys = ["card", "notebook", "questions"] as const;

function Field({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-petroleum-500 text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

type SessionDetail = { id: string; icon: LucideIcon; value: string };

function SessionInfoPanel({
  session,
  sessionDetails,
  displayTitle,
}: {
  session: Session | null;
  sessionDetails: SessionDetail[];
  displayTitle: string;
}) {
  const t = useTranslations("community.education.register");
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-petroleum-700 text-4xl md:text-5xl">
          {displayTitle}.
        </h1>
        {session?.speaker && (
          <p className="text-petroleum-400 mt-2 text-sm">
            {session.speaker}
            {session.speaker_role ? ` · ${session.speaker_role}` : ""}
          </p>
        )}
      </div>

      <div className="relative h-52 overflow-hidden rounded-2xl md:h-64">
        <Image
          src="/images/menu/education-programs.webp"
          alt={t("imageAlt")}
          fill
          sizes="(max-width: 767px) 100vw, 50vw"
          className="object-cover"
        />
      </div>

      {sessionDetails.length > 0 && (
        <div className="flex flex-col gap-3">
          {sessionDetails.map(({ id, icon: Icon, value }) => (
            <div key={id} className="flex items-center gap-3">
              <Icon className="text-petroleum-400 shrink-0" size={15} />
              <p className="text-petroleum-500 text-sm">{value}</p>
            </div>
          ))}
        </div>
      )}

      {session?.description && (
        <p className="text-petroleum-500 text-sm leading-relaxed">
          {session.description}
        </p>
      )}

      <div>
        <p className="text-petroleum-400 mb-3 text-xs tracking-widest uppercase">
          {t("whatToBring")}
        </p>
        <ul className="flex flex-col gap-2">
          {whatToBringKeys.map((key) => (
            <li
              key={key}
              className="text-petroleum-500 flex items-center gap-2 text-sm"
            >
              <span className="bg-petroleum-200 size-1 shrink-0 rounded-full" />
              {t(`items.${key}`)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function MemberBlockerModal({ onBack }: { onBack: () => void }) {
  const t = useTranslations("community.education.register.memberBlocker");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex flex-col gap-1">
          <h3 className="font-display text-petroleum-700 text-xl">
            {t("heading")}
          </h3>
          <p className="text-petroleum-400 text-sm">{t("body")}</p>
        </div>
        <div className="flex flex-col gap-2">
          <Button variant="solid" size="md" href="/sign-in" className="w-full">
            {t("signIn")}
          </Button>
          <Button variant="ghost" size="md" onClick={onBack} className="w-full">
            {t("continue")}
          </Button>
        </div>
      </div>
    </div>
  );
}

type GuestFormProps = {
  form: FormFields;
  consent: boolean;
  consentError: string | undefined;
  checking: boolean;
  onField: (field: keyof FormFields, value: string) => void;
  onConsent: (value: boolean) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
};

function GuestRegistrationForm({
  form,
  consent,
  consentError,
  checking,
  onField,
  onConsent,
  onSubmit,
}: GuestFormProps) {
  const td = useTranslations("community.education.register.details");
  const tdp = useTranslations("community.education.register.dataProtection");
  return (
    <div className="bg-sand-100 rounded-2xl p-8">
      <h2 className="font-display text-petroleum-700 mb-6 text-2xl">
        {td("title")}
      </h2>
      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label={td("firstName")} id="first-name">
            <input
              id="first-name"
              name="firstName"
              type="text"
              required
              autoComplete="given-name"
              placeholder={td("firstNamePlaceholder")}
              value={form.firstName}
              onChange={(e) => onField("firstName", e.target.value)}
              disabled={checking}
              className={inputClass}
            />
          </Field>
          <Field label={td("lastName")} id="last-name">
            <input
              id="last-name"
              name="lastName"
              type="text"
              required
              autoComplete="family-name"
              placeholder={td("lastNamePlaceholder")}
              value={form.lastName}
              onChange={(e) => onField("lastName", e.target.value)}
              disabled={checking}
              className={inputClass}
            />
          </Field>
        </div>

        <Field label={td("email")} id="email">
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder={td("emailPlaceholder")}
            value={form.email}
            onChange={(e) => onField("email", e.target.value)}
            disabled={checking}
            className={inputClass}
          />
        </Field>

        <Field label={td("phone")} id="phone">
          <input
            id="phone"
            name="phone"
            type="tel"
            required
            autoComplete="tel"
            placeholder={td("phonePlaceholder")}
            value={form.phone}
            onChange={(e) => onField("phone", e.target.value)}
            disabled={checking}
            className={inputClass}
          />
        </Field>

        {/* Consentimiento — RGPD art. 7 / LOPDGDD art. 6 */}
        <Checkbox
          name="consent"
          checked={consent}
          onChange={(e) => onConsent(e.target.checked)}
          disabled={checking}
          error={consentError}
          label={
            <span className="text-petroleum-400 text-sm">
              {td("consent")}{" "}
              <Link
                href="/terms"
                className="text-petroleum-500 hover:text-petroleum-800 underline underline-offset-2 transition-colors"
                target="_blank"
              >
                {td("terms")}
              </Link>{" "}
              {td("consentAnd")}{" "}
              <Link
                href="/privacy"
                className="text-petroleum-500 hover:text-petroleum-800 underline underline-offset-2 transition-colors"
                target="_blank"
              >
                {td("privacy")}
              </Link>
              .
            </span>
          }
        />

        <Button
          variant="solid"
          size="md"
          type="submit"
          disabled={checking}
          className="w-full"
        >
          {checking ? td("submitting") : td("submit")}
        </Button>

        {/* Información RGPD art. 13 */}
        <Accordion className="border-sand-500 rounded-2xl border px-6">
          <Accordion.Header iconClassName="text-petroleum-400">
            <span className="text-petroleum-400 w-full text-center text-xs tracking-wide uppercase">
              {tdp("heading")}
            </span>
          </Accordion.Header>
          <Accordion.Content>
            <p className="text-petroleum-400 pb-3 text-xs leading-relaxed">
              <strong className="font-medium">{tdp("controller")}</strong>{" "}
              {tdp("controllerValue")}
              <br />
              <strong className="font-medium">{tdp("purpose")}</strong>{" "}
              {tdp("purposeValue")}
              <br />
              <strong className="font-medium">{tdp("legalBasis")}</strong>{" "}
              {tdp("legalBasisValue")}
              <br />
              <strong className="font-medium">{tdp("rights")}</strong>{" "}
              {tdp("rightsValue")}{" "}
              <a
                href={`mailto:${contact.email}`}
                className="underline underline-offset-2"
              >
                {contact.email}
              </a>
              . {tdp("rightsFull")}{" "}
              <Link
                href="/privacy"
                className="underline underline-offset-2"
                target="_blank"
              >
                {tdp("privacy")}
              </Link>
              .
            </p>
          </Accordion.Content>
        </Accordion>
      </form>
    </div>
  );
}

function EducationRegisterContent() {
  const { get } = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const locale = useLocale();
  const t = useTranslations("community.education.register");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [state, dispatch] = useReducer(registerReducer, initialState);
  const { session, stage, loading, checking, consent, consentError, form } =
    state;

  useEffect(() => {
    const id = get("id");
    if (!id) return;
    void insforge.database
      .from("education_sessions")
      .select(
        "id, title, description, date, duration_minutes, location, max_participants, speaker, speaker_role, price_cents",
      )
      .eq("id", id)
      .single()
      .then(({ data }) => {
        if (data) dispatch({ type: "SET_SESSION", session: data as Session });
      });
  }, [get]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      if (wrapperRef.current) {
        gsap.from(Array.from(wrapperRef.current.children), {
          opacity: 0,
          y: 30,
          stagger: 0.1,
          duration: 0.7,
          ease: "power3.out",
          delay: 0.1,
        });
      }
    });
    return () => ctx.revert();
  }, []);

  const displayTitle = session?.title ?? t("title");
  const displayDate = session ? formatSessionDate(session.date, locale) : "";

  const sessionDetails: SessionDetail[] = session
    ? [
        {
          id: "date",
          icon: Calendar,
          value: formatSessionDate(session.date, locale),
        },
        {
          id: "time",
          icon: Clock,
          value: formatSessionTimeRange(
            session.date,
            session.duration_minutes,
            locale,
          ),
        },
        {
          id: "access",
          icon: Lock,
          value: formatPrice(session.price_cents, {
            membersOnly: t("membersOnly"),
            free: t("free"),
          }),
        },
        {
          id: "seats",
          icon: Users,
          value: session.max_participants
            ? t("limitedTo", { seats: session.max_participants })
            : t("openSeats"),
        },
      ]
    : [];

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!consent) {
      dispatch({
        type: "SET_CONSENT_ERROR",
        error: t("details.consentError"),
      });
      return;
    }
    dispatch({ type: "SUBMIT_START" });

    const { data: roleData } = await insforge.database.rpc("check_email_role", {
      p_email: form.email,
    });

    if (roleData === "member") {
      dispatch({ type: "SUBMIT_MEMBER_BLOCKER" });
      return;
    }

    const { data: contactId } = await insforge.database.rpc("upsert_contact", {
      p_email: form.email,
      p_first_name: form.firstName,
      p_last_name: form.lastName,
      p_phone: form.phone,
      p_language: locale,
    });

    await insforge.database.rpc("register_for_education", {
      p_session_id: session?.id ?? "",
      p_contact_id: (contactId as string) ?? undefined,
    });

    dispatch({ type: "SUBMIT_SUCCESS" });
  };

  const handleConfirm = async () => {
    if (!user || !session) return;
    dispatch({ type: "CONFIRM_START" });
    await insforge.database.rpc("register_for_education", {
      p_session_id: session.id,
      p_user_id: user.id,
    });
    dispatch({ type: "CONFIRM_SUCCESS" });
  };

  return (
    <section className="bg-sand-50 min-h-dvh">
      <div className="mx-auto max-w-4xl px-5 pt-36 pb-24 md:pt-52">
        <div ref={wrapperRef} className="flex flex-col gap-12">
          <div className="grid grid-cols-1 gap-12 md:grid-cols-2 md:gap-16">
            <SessionInfoPanel
              session={session}
              sessionDetails={sessionDetails}
              displayTitle={displayTitle}
            />

            <div>
              {stage === "success" ? (
                <div className="bg-sand-100 flex flex-col gap-4 rounded-2xl p-8">
                  <p className="font-display text-petroleum-700 text-2xl">
                    {t("success.title")}
                  </p>
                  <p className="text-petroleum-400 text-sm leading-relaxed">
                    {t("success.bodyPrefix")}{" "}
                    <strong className="text-petroleum-500 font-medium">
                      {displayTitle}
                    </strong>
                    {displayDate
                      ? ` ${t("success.bodyOn")} ${displayDate}`
                      : ""}
                    .
                  </p>
                  <Link
                    href="/community/education-programs"
                    className="text-petroleum-500 hover:text-petroleum-700 mt-2 text-sm underline underline-offset-4 transition-colors"
                  >
                    {t("success.back")}
                  </Link>
                </div>
              ) : !authLoading && user ? (
                <div className="bg-sand-100 flex flex-col gap-6 rounded-2xl p-8">
                  <div>
                    <h2 className="font-display text-petroleum-700 text-2xl">
                      {t("confirm.heading")}
                    </h2>
                    <p className="text-petroleum-400 mt-2 text-sm">
                      {t("confirm.registeringAs")}{" "}
                      <span className="text-petroleum-500 font-medium">
                        {user.email}
                      </span>
                    </p>
                  </div>
                  <Button
                    variant="solid"
                    size="md"
                    onClick={() => void handleConfirm()}
                    disabled={loading || !session}
                    className="w-full"
                  >
                    {loading ? t("confirm.submitting") : t("confirm.submit")}
                  </Button>
                </div>
              ) : (
                <GuestRegistrationForm
                  form={form}
                  consent={consent}
                  consentError={consentError}
                  checking={checking}
                  onField={(field, value) =>
                    dispatch({ type: "SET_FIELD", field, value })
                  }
                  onConsent={(value) =>
                    dispatch({ type: "SET_CONSENT", value })
                  }
                  onSubmit={(e) => void handleSubmit(e)}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {stage === "member-blocker" && (
        <MemberBlockerModal
          onBack={() => dispatch({ type: "SET_STAGE", stage: "form" })}
        />
      )}
    </section>
  );
}

export default function EducationRegisterSection() {
  return (
    <Suspense>
      <EducationRegisterContent />
    </Suspense>
  );
}
