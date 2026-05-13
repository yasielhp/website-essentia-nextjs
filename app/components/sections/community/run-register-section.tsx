"use client";

import { useRef, useEffect, useState } from "react";
import gsap from "gsap";
import Image from "next/image";
import Link from "next/link";
import { MapPin, Route, Lock, Calendar } from "lucide-react";
import { Button } from "@components/ui/button";
import { Checkbox } from "@components/ui/input";
import { Accordion } from "@components/ui/accordion";
import { contact } from "@/constants/contact";

const runDetails = {
  date: "Saturday, 24 May 2026",
  time: "7:30 am",
  distance: "12 km",
  access: "Members only",
  meetingPoint: "Baobab Suites lobby, Costa Adeje",
  route: "Fanabe coastal path",
  description:
    "This week we take the Fanabe coastal path — 10 km along the seafront promenade with uninterrupted Atlantic views from start to finish. Moderate pace, paved surface, suitable for all running levels. Ends with breakfast at the club.",
  whatToBring: [
    "Running shoes",
    "Water bottle",
    "Essentia membership card",
    "Layers — it can be cool at 7:30",
  ],
};

const details = [
  { icon: Calendar, value: `${runDetails.date} · ${runDetails.time}` },
  { icon: Route, value: runDetails.distance },
  { icon: Lock, value: runDetails.access },
  { icon: MapPin, value: runDetails.meetingPoint },
];

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

export default function RunRegisterSection() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [consent, setConsent] = useState(false);
  const [consentError, setConsentError] = useState<string | undefined>();

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

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!consent) {
      setConsentError("You must accept the terms and privacy policy to register.");
      return;
    }
    setConsentError(undefined);
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 1200);
  };

  return (
    <section className="bg-sand-50 min-h-dvh">
      <div className="mx-auto max-w-4xl px-5 pt-36 pb-24 md:pt-52">
        <div ref={wrapperRef} className="flex flex-col gap-12">
          {/* ── Header ── */}
          <div className="grid grid-cols-1 gap-12 md:grid-cols-2 md:gap-16">
            <div className="flex flex-col gap-8">
              <div>
                <h1 className="font-display text-petroleum-700 text-4xl md:text-5xl">
                  {runDetails.date}.
                </h1>
                <p className="text-petroleum-400 mt-2 text-sm">
                  {runDetails.time} · {runDetails.route}
                </p>
              </div>

              {/* Run image */}
              <div className="relative h-52 overflow-hidden rounded-2xl md:h-64">
                <Image
                  src="/images/menu/running-club.webp"
                  alt="Essentia Running Club"
                  fill
                  sizes="(max-width: 767px) 100vw, 50vw"
                  className="object-cover"
                />
              </div>

              {/* Details */}
              <div className="flex flex-col gap-3">
                {details.map(({ icon: Icon, value }) => (
                  <div key={value} className="flex items-center gap-3">
                    <Icon className="text-petroleum-400 shrink-0" size={15} />
                    <p className="text-petroleum-600 text-sm">{value}</p>
                  </div>
                ))}
              </div>

              {/* Description */}
              <p className="text-petroleum-500 text-sm leading-relaxed">
                {runDetails.description}
              </p>

              {/* What to bring */}
              <div>
                <p className="text-petroleum-400 mb-3 text-xs tracking-widest uppercase">
                  What to bring
                </p>
                <ul className="flex flex-col gap-2">
                  {runDetails.whatToBring.map((item) => (
                    <li
                      key={item}
                      className="text-petroleum-600 flex items-center gap-2 text-sm"
                    >
                      <span className="bg-petroleum-200 h-1 w-1 shrink-0 rounded-full" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* ── Form ── */}
            <div>
              {submitted ? (
                <div className="bg-sand-100 flex flex-col gap-4 rounded-2xl p-8">
                  <p className="font-display text-petroleum-700 text-2xl">
                    You&apos;re registered.
                  </p>
                  <p className="text-petroleum-400 text-sm leading-relaxed">
                    We&apos;ve received your registration for the{" "}
                    {runDetails.date} run. See you at {runDetails.time} at the
                    Baobab Suites lobby.
                  </p>
                  <Link
                    href="/community/running-club"
                    className="text-petroleum-500 hover:text-petroleum-700 mt-2 text-sm underline underline-offset-4 transition-colors"
                  >
                    Back to Running Club
                  </Link>
                </div>
              ) : (
                <div className="bg-sand-100 rounded-2xl p-8">
                  <h2 className="font-display text-petroleum-700 mb-6 text-2xl">
                    Your details.
                  </h2>
                  <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                      <Field label="First name" id="first-name">
                        <input
                          id="first-name"
                          name="firstName"
                          type="text"
                          required
                          autoComplete="given-name"
                          placeholder="Jane"
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
                        className={inputClass}
                      />
                    </Field>

                    {/* Consentimiento — RGPD art. 7 / LOPDGDD art. 6 */}
                    <Checkbox
                      name="consent"
                      checked={consent}
                      onChange={(e) => {
                        setConsent(e.target.checked);
                        if (consentError) setConsentError(undefined);
                      }}
                      disabled={loading}
                      error={consentError}
                      label={
                        <span className="text-petroleum-400 text-sm">
                          I accept the{" "}
                          <Link
                            href="/terms"
                            className="text-petroleum-600 underline underline-offset-2 hover:text-petroleum-800 transition-colors"
                            target="_blank"
                          >
                            Terms
                          </Link>{" "}
                          and{" "}
                          <Link
                            href="/privacy"
                            className="text-petroleum-600 underline underline-offset-2 hover:text-petroleum-800 transition-colors"
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
                      disabled={loading}
                      className="w-full"
                    >
                      {loading ? "Registering…" : "Confirm registration"}
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
                          <strong className="font-medium">Data controller:</strong>{" "}
                          Essentia Social Wellness Club<br />
                          <strong className="font-medium">Purpose:</strong> managing your run registration<br />
                          <strong className="font-medium">Legal basis:</strong> your consent (GDPR art. 6.1.a)<br />
                          <strong className="font-medium">Your rights:</strong> access, rectification, erasure, restriction, portability, and objection: write to{" "}
                          <a href={`mailto:${contact.email}`} className="underline underline-offset-2">
                            {contact.email}
                          </a>
                          . Full details in our{" "}
                          <Link href="/privacy" className="underline underline-offset-2" target="_blank">
                            Privacy Policy
                          </Link>
                          .
                        </p>
                      </Accordion.Content>
                    </Accordion>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
