"use client";

import { useRef, useEffect, useReducer, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import gsap from "gsap";
import Image from "next/image";
import Link from "next/link";
import { MapPin, Route, Lock, Calendar, type LucideIcon } from "lucide-react";
import { Button } from "@components/ui/button";
import { Checkbox } from "@components/ui/input";
import { Accordion } from "@components/ui/accordion";
import { contact } from "@/constants/contact";
import { insforge } from "@/lib/insforge";
import { useAuth } from "@/components/auth-provider";

type Race = {
  id: string;
  title: string;
  description: string | null;
  date: string | null;
  location: string | null;
  distance_km: number | null;
  max_participants: number | null;
};

type Stage = "form" | "member-blocker" | "success";
type FormFields = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

type RegisterState = {
  race: Race | null;
  stage: Stage;
  loading: boolean;
  checking: boolean;
  consent: boolean;
  consentError: string | undefined;
  form: FormFields;
};

type RegisterAction =
  | { type: "SET_RACE"; race: Race }
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
    case "SET_RACE":
      return { ...state, race: action.race };
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
  race: null,
  stage: "form",
  loading: false,
  checking: false,
  consent: false,
  consentError: undefined,
  form: { firstName: "", lastName: "", email: "", phone: "" },
};

function formatRaceDate(iso: string | null): string {
  if (!iso) return "—";
  const datePart = iso.split("T")[0];
  const [y, m, d] = datePart.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatRaceTime(iso: string | null): string {
  if (!iso) return "";
  const match = iso.match(/[T ](\d{2}:\d{2})/);
  if (!match) return "";
  return match[1] === "00:00" ? "" : match[1];
}

const inputClass =
  "bg-sand-100 text-petroleum-700 placeholder:text-petroleum-300 border border-sand-300 rounded-xl px-4 py-3 text-sm outline-none transition-all duration-200 focus:border-petroleum-400 focus:ring-2 focus:ring-petroleum-200";

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
      <label htmlFor={id} className="text-petroleum-600 text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

type RaceDetail = { id: string; icon: LucideIcon; value: string };

function RaceInfoPanel({
  race,
  raceDetails,
  displayDate,
  raceTime,
}: {
  race: Race | null;
  raceDetails: RaceDetail[];
  displayDate: string;
  raceTime: string;
}) {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-petroleum-700 text-4xl md:text-5xl">
          {displayDate || "Register for this run"}.
        </h1>
        {raceTime && (
          <p className="text-petroleum-400 mt-2 text-sm">{raceTime}</p>
        )}
      </div>

      <div className="relative h-52 overflow-hidden rounded-2xl md:h-64">
        <Image
          src="/images/community/running-club-next.webp"
          alt="Essentia Running Club"
          fill
          sizes="(max-width: 767px) 100vw, 50vw"
          className="object-cover"
        />
      </div>

      {raceDetails.length > 0 && (
        <div className="flex flex-col gap-3">
          {raceDetails.map(({ id, icon: Icon, value }) => (
            <div key={id} className="flex items-center gap-3">
              <Icon className="text-petroleum-400 shrink-0" size={15} />
              <p className="text-petroleum-600 text-sm">{value}</p>
            </div>
          ))}
        </div>
      )}

      {race?.description && (
        <p className="text-petroleum-500 text-sm leading-relaxed">
          {race.description}
        </p>
      )}
    </div>
  );
}

function MemberBlockerModal({ onBack }: { onBack: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex flex-col gap-1">
          <h3 className="font-display text-petroleum-700 text-xl">
            Active membership found
          </h3>
          <p className="text-petroleum-400 text-sm">
            This email is linked to an active Essentia membership. Sign in to
            register with your member benefits.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Button variant="solid" size="md" href="/sign-in" className="w-full">
            Sign in to my account
          </Button>
          <Button variant="ghost" size="md" onClick={onBack} className="w-full">
            Continue as guest
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
  return (
    <div className="bg-sand-100 rounded-2xl p-8">
      <h2 className="font-display text-petroleum-700 mb-6 text-2xl">
        Your details.
      </h2>
      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="First name" id="first-name">
            <input
              id="first-name"
              name="firstName"
              type="text"
              required
              autoComplete="given-name"
              placeholder="Jane"
              value={form.firstName}
              onChange={(e) => onField("firstName", e.target.value)}
              disabled={checking}
              className={inputClass}
            />
          </Field>
          <Field label="Last name" id="last-name">
            <input
              id="last-name"
              name="lastName"
              type="text"
              required
              autoComplete="family-name"
              placeholder="Smith"
              value={form.lastName}
              onChange={(e) => onField("lastName", e.target.value)}
              disabled={checking}
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Email" id="email">
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="jane@example.com"
            value={form.email}
            onChange={(e) => onField("email", e.target.value)}
            disabled={checking}
            className={inputClass}
          />
        </Field>

        <Field label="Phone" id="phone">
          <input
            id="phone"
            name="phone"
            type="tel"
            required
            autoComplete="tel"
            placeholder="+34 600 000 000"
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
              I accept the{" "}
              <Link
                href="/terms"
                className="text-petroleum-600 hover:text-petroleum-800 underline underline-offset-2 transition-colors"
                target="_blank"
              >
                Terms
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy"
                className="text-petroleum-600 hover:text-petroleum-800 underline underline-offset-2 transition-colors"
                target="_blank"
              >
                Privacy Policy
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
          {checking ? "Checking…" : "Confirm registration"}
        </Button>

        {/* Información RGPD art. 13 */}
        <Accordion className="border-sand-500 rounded-2xl border px-6">
          <Accordion.Header iconClassName="text-petroleum-400">
            <span className="text-petroleum-400 w-full text-center text-xs tracking-wide uppercase">
              Data protection information
            </span>
          </Accordion.Header>
          <Accordion.Content>
            <p className="text-petroleum-400 pb-3 text-xs leading-relaxed">
              <strong className="font-medium">Data controller:</strong> Essentia
              Social Wellness Club
              <br />
              <strong className="font-medium">Purpose:</strong> managing your
              run registration
              <br />
              <strong className="font-medium">Legal basis:</strong> your consent
              (GDPR art. 6.1.a)
              <br />
              <strong className="font-medium">Your rights:</strong> access,
              rectification, erasure, restriction, portability, and objection:
              write to{" "}
              <a
                href={`mailto:${contact.email}`}
                className="underline underline-offset-2"
              >
                {contact.email}
              </a>
              . Full details in our{" "}
              <Link
                href="/privacy"
                className="underline underline-offset-2"
                target="_blank"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </Accordion.Content>
        </Accordion>
      </form>
    </div>
  );
}

function RunRegisterContent() {
  const { get } = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [state, dispatch] = useReducer(registerReducer, initialState);
  const { race, stage, loading, checking, consent, consentError, form } = state;

  useEffect(() => {
    const id = get("id");
    if (!id) return;
    void insforge.database
      .from("races")
      .select(
        "id, title, description, date, location, distance_km, max_participants",
      )
      .eq("id", id)
      .single()
      .then(({ data }) => {
        if (data) dispatch({ type: "SET_RACE", race: data as Race });
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

  const raceTime = formatRaceTime(race?.date ?? null);
  const displayDate = race ? formatRaceDate(race.date) : "";

  const raceDetails: RaceDetail[] = race
    ? [
        { id: "date", icon: Calendar, value: formatRaceDate(race.date) },
        {
          id: "distance",
          icon: Route,
          value: race.distance_km ? `${race.distance_km} km` : "—",
        },
        { id: "access", icon: Lock, value: "Members only" },
        { id: "location", icon: MapPin, value: race.location ?? "—" },
      ]
    : [];

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!consent) {
      dispatch({
        type: "SET_CONSENT_ERROR",
        error: "You must accept the terms and privacy policy to register.",
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
    });

    await insforge.database.rpc("register_for_race", {
      p_race_id: race?.id ?? "",
      p_contact_id: (contactId as string) ?? undefined,
    });

    dispatch({ type: "SUBMIT_SUCCESS" });
  };

  const handleConfirm = async () => {
    if (!user || !race) return;
    dispatch({ type: "CONFIRM_START" });
    await insforge.database.rpc("register_for_race", {
      p_race_id: race.id,
      p_user_id: user.id,
    });
    dispatch({ type: "CONFIRM_SUCCESS" });
  };

  return (
    <section className="bg-sand-50 min-h-dvh">
      <div className="mx-auto max-w-4xl px-5 pt-36 pb-24 md:pt-52">
        <div ref={wrapperRef} className="flex flex-col gap-12">
          <div className="grid grid-cols-1 gap-12 md:grid-cols-2 md:gap-16">
            <RaceInfoPanel
              race={race}
              raceDetails={raceDetails}
              displayDate={displayDate}
              raceTime={raceTime}
            />

            <div>
              {stage === "success" ? (
                <div className="bg-sand-100 flex flex-col gap-4 rounded-2xl p-8">
                  <p className="font-display text-petroleum-700 text-2xl">
                    You&apos;re registered.
                  </p>
                  <p className="text-petroleum-400 text-sm leading-relaxed">
                    We&apos;ve received your registration for the{" "}
                    <strong className="text-petroleum-600 font-medium">
                      {displayDate || race?.title || "next run"}
                    </strong>{" "}
                    run.
                    {raceTime
                      ? ` See you at ${raceTime} at ${race?.location ?? "the meeting point"}.`
                      : ""}
                  </p>
                  <Link
                    href="/community/running-club"
                    className="text-petroleum-500 hover:text-petroleum-700 mt-2 text-sm underline underline-offset-4 transition-colors"
                  >
                    Back to Running Club
                  </Link>
                </div>
              ) : !authLoading && user ? (
                <div className="bg-sand-100 flex flex-col gap-6 rounded-2xl p-8">
                  <div>
                    <h2 className="font-display text-petroleum-700 text-2xl">
                      Confirm your registration.
                    </h2>
                    <p className="text-petroleum-400 mt-2 text-sm">
                      Registering as{" "}
                      <span className="text-petroleum-600 font-medium">
                        {user.email}
                      </span>
                    </p>
                  </div>
                  <Button
                    variant="solid"
                    size="md"
                    onClick={() => void handleConfirm()}
                    disabled={loading || !race}
                    className="w-full"
                  >
                    {loading ? "Confirming…" : "Confirm registration"}
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

export default function RunRegisterSection() {
  return (
    <Suspense>
      <RunRegisterContent />
    </Suspense>
  );
}
