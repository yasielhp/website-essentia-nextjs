"use client";

import { useRef, useEffect, useState } from "react";
import gsap from "gsap";
import Link from "next/link";
import { Button } from "@components/ui/button";
import { contact } from "@/constants/contact";

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
      <label htmlFor={id} className="text-petroleum-600 text-sm font-medium">
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
      <div className="mx-auto max-w-5xl px-5 pt-32 pb-24">
        <div ref={wrapperRef} className="flex flex-col gap-16">
          {/* ── Header ── */}
          <div className="md:max-w-xl">
            <h1 className="font-display text-petroleum-700 text-4xl md:text-5xl">
              Get in touch.
            </h1>
            <p className="text-petroleum-400 mt-4 leading-relaxed">
              Whether you want to learn more about membership, book a session,
              or just ask a question — we&apos;d love to hear from you.
            </p>
          </div>

          {/* ── Two columns ── */}
          <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
            {/* ── Form ── */}
            {submitted ? (
              <div className="flex flex-col justify-center gap-4">
                <div className="bg-sand-100 rounded-2xl p-8">
                  <p className="font-display text-petroleum-700 text-2xl">
                    Message received.
                  </p>
                  <p className="text-petroleum-400 mt-3 text-sm leading-relaxed">
                    Thank you for reaching out. A member of our team will get
                    back to you within one business day.
                  </p>
                  <button
                    onClick={() => setSubmitted(false)}
                    className="text-petroleum-500 hover:text-petroleum-700 mt-6 text-sm underline underline-offset-4 transition-colors"
                  >
                    Send another message
                  </button>
                </div>
              </div>
            ) : (
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

                <Field label="I&apos;m interested in" id="interest">
                  <select
                    id="interest"
                    name="interest"
                    required
                    defaultValue=""
                    className={inputClass}
                  >
                    <option value="" disabled>
                      Select a topic
                    </option>
                    <option value="membership">Membership</option>
                    <option value="wellness">Wellness programmes</option>
                    <option value="medicine">Medicine protocols</option>
                    <option value="community">Community & events</option>
                    <option value="other">Something else</option>
                  </select>
                </Field>

                <Field label="Message" id="message">
                  <textarea
                    id="message"
                    name="message"
                    required
                    rows={5}
                    placeholder="Tell us a bit about what you&apos;re looking for..."
                    className={[inputClass, "resize-none"].join(" ")}
                  />
                </Field>

                <Button
                  variant="solid"
                  size="md"
                  type="submit"
                  disabled={loading}
                  className="self-start"
                >
                  {loading ? "Sending…" : "Send message"}
                </Button>
              </form>
            )}

            {/* ── Info ── */}
            <div className="flex flex-col gap-10 md:pt-2">
              {/* Address */}
              <div className="flex flex-col gap-2">
                <p className="text-petroleum-400 text-xs tracking-widest uppercase">
                  Location
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
                  Contact
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
              </div>

              {/* Hours */}
              <div className="flex flex-col gap-2">
                <p className="text-petroleum-400 text-xs tracking-widest uppercase">
                  Hours
                </p>
                <div className="text-petroleum-700 flex flex-col gap-1 text-sm">
                  <span>Monday – Friday: 7:00 – 21:00</span>
                  <span>Saturday – Sunday: 8:00 – 20:00</span>
                </div>
              </div>

              {/* Social */}
              <div className="flex flex-col gap-3">
                <p className="text-petroleum-400 text-xs tracking-widest uppercase">
                  Follow us
                </p>
                <div className="flex gap-4">
                  {contact.socialMedia.map((social) => (
                    <Link
                      key={social.name}
                      href={social.url}
                      target="_blank"
                      className="text-petroleum-500 hover:text-petroleum-700 text-sm transition-colors"
                    >
                      {social.name}
                    </Link>
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
