"use client";

import { useRef, useEffect, useState } from "react";
import gsap from "gsap";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@components/ui/button";
import { contact } from "@/constants/contact";
import { AnimatedIconLink } from "@components/ui/animated-text";

// ─── Input ────────────────────────────────────────────────────

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

const inputClass =
  "bg-sand-100 text-petroleum-700 placeholder:text-petroleum-300 border border-sand-300 rounded-xl px-4 py-3 text-sm outline-none transition-all duration-200 focus:border-petroleum-400 focus:ring-2 focus:ring-petroleum-200";

// ─── ContactSection ───────────────────────────────────────────

export default function ContactSection() {
  const t = useTranslations("contact");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

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
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 1200);
  };

  return (
    <section className="bg-sand-50 min-h-dvh">
      <div className="mx-auto max-w-4xl px-5 pt-32 pb-24 md:pt-52">
        <div ref={wrapperRef} className="flex flex-col gap-16">
          {/* ── Header ── */}
          <div className="md:max-w-xl">
            <h1 className="font-display text-petroleum-700 text-4xl md:text-5xl">
              {t("heading")}
            </h1>
            <p className="text-petroleum-400 mt-4 leading-relaxed">
              {t("subheading")}
            </p>
          </div>

          {/* ── Two columns ── */}
          <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
            {/* ── Form ── */}
            {submitted ? (
              <div className="flex flex-col justify-center gap-4">
                <div className="bg-sand-100 rounded-2xl p-8">
                  <p className="font-display text-petroleum-700 text-2xl">
                    {t("success.heading")}
                  </p>
                  <p className="text-petroleum-400 mt-3 text-sm leading-relaxed">
                    {t("success.body")}
                  </p>
                  <button
                    onClick={() => setSubmitted(false)}
                    className="text-petroleum-500 hover:text-petroleum-700 mt-6 text-sm underline underline-offset-4 transition-colors"
                  >
                    {t("success.sendAnother")}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <Field label={t("form.firstName")} id="first-name">
                    <input
                      id="first-name"
                      name="firstName"
                      type="text"
                      required
                      autoComplete="given-name"
                      placeholder={t("form.firstNamePlaceholder")}
                      className={inputClass}
                    />
                  </Field>
                  <Field label={t("form.lastName")} id="last-name">
                    <input
                      id="last-name"
                      name="lastName"
                      type="text"
                      required
                      autoComplete="family-name"
                      placeholder={t("form.lastNamePlaceholder")}
                      className={inputClass}
                    />
                  </Field>
                </div>

                <Field label={t("form.email")} id="email">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder={t("form.emailPlaceholder")}
                    className={inputClass}
                  />
                </Field>

                <Field label={t("form.interest")} id="interest">
                  <select
                    id="interest"
                    name="interest"
                    required
                    defaultValue=""
                    className={inputClass}
                  >
                    <option value="" disabled>
                      {t("form.interestPlaceholder")}
                    </option>
                    <option value="membership">
                      {t("form.interests.membership")}
                    </option>
                    <option value="wellness">
                      {t("form.interests.wellness")}
                    </option>
                    <option value="medicine">
                      {t("form.interests.medicine")}
                    </option>
                    <option value="community">
                      {t("form.interests.community")}
                    </option>
                    <option value="other">{t("form.interests.other")}</option>
                  </select>
                </Field>

                <Field label={t("form.message")} id="message">
                  <textarea
                    id="message"
                    name="message"
                    required
                    rows={5}
                    placeholder={t("form.messagePlaceholder")}
                    className={[inputClass, "resize-none"].join(" ")}
                  />
                </Field>

                <Button
                  variant="solid"
                  size="md"
                  type="submit"
                  disabled={loading}
                  className="w-full md:w-auto md:self-start"
                >
                  {loading ? t("form.submitting") : t("form.submit")}
                </Button>
              </form>
            )}

            {/* ── Info ── */}
            <div className="flex flex-col gap-10 md:pt-2">
              {/* Address */}
              <div className="flex flex-col gap-2">
                <p className="text-petroleum-400 text-xs tracking-widest uppercase">
                  {t("info.location")}
                </p>
                <Link
                  href="https://maps.app.goo.gl/63DC95GEfWDydgrg8"
                  target="_blank"
                  className="text-petroleum-700 hover:text-petroleum-500 text-sm leading-relaxed transition-colors"
                >
                  {contact.address}
                </Link>
              </div>

              {/* Email + Phone */}
              <div className="flex flex-col gap-2">
                <p className="text-petroleum-400 text-xs tracking-widest uppercase">
                  {t("info.contact")}
                </p>
                <Link
                  href={`mailto:${contact.email}`}
                  className="text-petroleum-700 hover:text-petroleum-500 text-sm transition-colors"
                >
                  {contact.email}
                </Link>
                <Link
                  href={`tel:${contact.phone}`}
                  className="text-petroleum-700 hover:text-petroleum-500 text-sm transition-colors"
                >
                  {contact.phone}
                </Link>
                {contact.phone2 && (
                  <Link
                    href={`tel:${contact.phone2}`}
                    className="text-petroleum-700 hover:text-petroleum-500 text-sm transition-colors"
                  >
                    {contact.phone2}
                  </Link>
                )}
              </div>

              {/* Social */}
              <div className="flex flex-col gap-3">
                <p className="text-petroleum-400 text-xs tracking-widest uppercase">
                  {t("info.followUs")}
                </p>
                <div className="flex gap-3">
                  {contact.socialMedia.map((social) => (
                    <AnimatedIconLink
                      key={social.name}
                      href={social.url as any}
                      target="_blank"
                      aria-label={social.name}
                      className="border-petroleum-500 text-petroleum-500 rounded-full border p-2 text-center"
                    >
                      <social.icon />
                    </AnimatedIconLink>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
