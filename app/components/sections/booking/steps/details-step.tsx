"use client";

import Link from "next/link";
import { Checkbox } from "@components/ui/input";
import { Accordion } from "@components/ui/accordion";
import { contact } from "@/constants/contact";
import type { DetailsState } from "@/types";

const inputClass =
  "bg-sand-100 text-petroleum-700 placeholder:text-petroleum-100 border rounded-xl px-4 py-3 text-sm outline-none transition-all duration-200 focus:ring-2 w-full";
const inputOk = "border-sand-300 focus:border-petroleum-400 focus:ring-petroleum-100";
const inputErr = "border-red-300 focus:border-red-400 focus:ring-red-100";

export type DetailsErrors = Partial<Record<keyof DetailsState, string>>;

function Field({
  label,
  id,
  required,
  error,
  children,
}: {
  label: string;
  id: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-petroleum-500 text-sm font-medium">
        {label}
        {required && <span className="ml-0.5 text-red-400">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

export function DetailsStep({
  details,
  errors = {},
  onChange,
  onClearError,
}: {
  details: DetailsState;
  errors?: DetailsErrors;
  onChange: (d: DetailsState) => void;
  onClearError?: (key: keyof DetailsState) => void;
}) {
  const set =
    (key: keyof DetailsState) => (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ ...details, [key]: e.target.value });
      onClearError?.(key);
    };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="First name" id="first-name" required error={errors.firstName}>
          <input
            id="first-name"
            type="text"
            autoComplete="given-name"
            placeholder="Jane"
            value={details.firstName}
            onChange={set("firstName")}
            className={`${inputClass} ${errors.firstName ? inputErr : inputOk}`}
          />
        </Field>
        <Field label="Last name" id="last-name" required error={errors.lastName}>
          <input
            id="last-name"
            type="text"
            autoComplete="family-name"
            placeholder="Smith"
            value={details.lastName}
            onChange={set("lastName")}
            className={`${inputClass} ${errors.lastName ? inputErr : inputOk}`}
          />
        </Field>
      </div>
      <Field label="Email" id="email" required error={errors.email}>
        <input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="jane@example.com"
          value={details.email}
          onChange={set("email")}
          className={`${inputClass} ${errors.email ? inputErr : inputOk}`}
        />
      </Field>
      <Field label="Phone" id="phone" required error={errors.phone}>
        <input
          id="phone"
          type="tel"
          autoComplete="tel"
          placeholder="+34 600 000 000"
          value={details.phone}
          onChange={set("phone")}
          className={`${inputClass} ${errors.phone ? inputErr : inputOk}`}
        />
      </Field>

      <div className="flex flex-col gap-1">
        <Checkbox
          name="consent"
          checked={details.consent}
          onChange={(e) => {
            onChange({ ...details, consent: e.target.checked });
            onClearError?.("consent");
          }}
          label={
            <span className="text-petroleum-400 text-sm">
              I accept the{" "}
              <Link
                href="/terms"
                className="text-petroleum-500 hover:text-petroleum-700 underline underline-offset-2 transition-colors"
                target="_blank"
              >
                Terms
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy"
                className="text-petroleum-500 hover:text-petroleum-700 underline underline-offset-2 transition-colors"
                target="_blank"
              >
                Privacy Policy
              </Link>
              .
            </span>
          }
        />
        {errors.consent && (
          <p className="text-xs text-red-500">{errors.consent}</p>
        )}
      </div>

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
            session booking
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
    </div>
  );
}
