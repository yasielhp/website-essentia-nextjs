"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Check, X } from "lucide-react";
import { Button } from "@components/ui/button";
import { bookableServices, type BookableService } from "./services-data";

// ─── Constants ────────────────────────────────────────────────

const STEPS = ["Service", "Date & time", "Your details", "Confirm"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ─── Helpers ──────────────────────────────────────────────────

function isAvailableDay(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  if (d <= today) return false;
  const max = new Date(today);
  max.setDate(today.getDate() + 60);
  if (d > max) return false;
  const dow = d.getDay();
  return dow !== 0 && dow !== 6;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getCalendarDays(year: number, month: number): (Date | null)[] {
  const firstDow = new Date(year, month, 1).getDay();
  const offset = firstDow === 0 ? 6 : firstDow - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: (Date | null)[] = [];
  for (let i = 0; i < offset; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(new Date(year, month, d));
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

function getTimeSlots(
  date: Date,
  service: BookableService,
): { time: string; booked: boolean }[] {
  const base =
    service.category === "medicine"
      ? ["09:00", "10:30", "12:00", "14:00", "15:30", "17:00"]
      : ["09:00", "10:00", "11:00", "12:00", "15:00", "16:00", "17:00", "18:00"];
  const seed = date.getDate() + date.getMonth();
  return base.map((time, i) => ({ time, booked: (seed + i) % 5 === 0 }));
}

// ─── Step indicator ───────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((step, i) => (
        <div key={step} className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div
              className={[
                "flex size-6 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                i < current
                  ? "bg-petroleum-700 text-sand-50"
                  : i === current
                    ? "border-2 border-petroleum-700 text-petroleum-700"
                    : "border border-petroleum-200 text-petroleum-300",
              ].join(" ")}
            >
              {i < current ? <Check size={10} /> : i + 1}
            </div>
            <span
              className={[
                "hidden text-sm transition-colors sm:block",
                i <= current ? "text-petroleum-700" : "text-petroleum-300",
              ].join(" ")}
            >
              {step}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={[
                "h-px w-6 transition-colors",
                i < current ? "bg-petroleum-700" : "bg-petroleum-200",
              ].join(" ")}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Step 1: Service ──────────────────────────────────────────

function ServiceCard({
  service,
  selected,
  onSelect,
}: {
  service: BookableService;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={[
        "group relative flex flex-col overflow-hidden rounded-2xl text-left transition-all duration-200",
        selected
          ? "ring-2 ring-petroleum-700 shadow-md"
          : "ring-1 ring-sand-200 hover:ring-petroleum-300 hover:shadow-sm",
      ].join(" ")}
    >
      <div className="relative h-28 w-full overflow-hidden">
        <Image
          src={service.image}
          alt={service.title}
          fill
          sizes="(max-width: 640px) 50vw, 33vw"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {selected && (
          <div className="bg-petroleum-700 absolute top-2 right-2 flex size-6 items-center justify-center rounded-full">
            <Check className="text-sand-50" size={12} />
          </div>
        )}
      </div>
      <div className="bg-sand-50 flex flex-col gap-1 p-3">
        <p className="text-petroleum-700 text-sm font-medium leading-snug">
          {service.title}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-petroleum-400 text-xs">{service.duration}</span>
          <span className="text-petroleum-200 text-xs">·</span>
          <span className="text-petroleum-600 text-xs font-medium">
            {service.price}
          </span>
        </div>
      </div>
    </button>
  );
}

function ServiceStep({
  selected,
  onSelect,
}: {
  selected: BookableService | null;
  onSelect: (s: BookableService | null) => void;
}) {
  const wellness = bookableServices.filter((s) => s.category === "wellness");
  const medicine = bookableServices.filter((s) => s.category === "medicine");

  return (
    <div className="flex flex-col gap-8">
      {selected && (
        <div className="bg-sand-100 flex items-center justify-between rounded-xl px-4 py-3">
          <div className="flex items-center gap-3">
            <Check className="text-petroleum-700 shrink-0" size={14} />
            <p className="text-petroleum-700 text-sm font-medium">
              {selected.title} selected
            </p>
          </div>
          <button
            onClick={() => onSelect(null)}
            className="text-petroleum-400 hover:text-petroleum-700 flex items-center gap-1 text-xs transition-colors"
          >
            <X size={13} />
            Clear
          </button>
        </div>
      )}

      <div className="flex flex-col gap-6">
        <div>
          <p className="text-petroleum-400 mb-3 text-xs tracking-widest uppercase">
            Wellness
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {wellness.map((s) => (
              <ServiceCard
                key={s.id}
                service={s}
                selected={selected?.id === s.id}
                onSelect={() => onSelect(selected?.id === s.id ? null : s)}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="text-petroleum-400 mb-3 text-xs tracking-widest uppercase">
            Medicine
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {medicine.map((s) => (
              <ServiceCard
                key={s.id}
                service={s}
                selected={selected?.id === s.id}
                onSelect={() => onSelect(selected?.id === s.id ? null : s)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Step 2: Date & time ──────────────────────────────────────

function CalendarView({
  selected,
  onSelect,
}: {
  selected: Date | null;
  onSelect: (d: Date) => void;
}) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const days = getCalendarDays(viewYear, viewMonth);

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button
          onClick={prevMonth}
          className="text-petroleum-400 hover:text-petroleum-700 rounded-lg p-1 transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <p className="text-petroleum-700 text-sm font-medium">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </p>
        <button
          onClick={nextMonth}
          className="text-petroleum-400 hover:text-petroleum-700 rounded-lg p-1 transition-colors"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {DAY_NAMES.map((d) => (
          <div
            key={d}
            className="text-petroleum-300 py-1 text-center text-xs font-medium"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day, i) => {
          if (!day) return <div key={i} />;
          const available = isAvailableDay(day);
          const isSelected = selected ? isSameDay(day, selected) : false;
          const isToday = isSameDay(day, today);
          return (
            <button
              key={i}
              disabled={!available}
              onClick={() => available && onSelect(day)}
              className={[
                "flex aspect-square items-center justify-center rounded-full text-sm transition-all",
                isSelected
                  ? "bg-petroleum-700 text-sand-50 font-semibold"
                  : available
                    ? "text-petroleum-700 hover:bg-petroleum-100 cursor-pointer"
                    : "text-petroleum-200 cursor-not-allowed",
                isToday && !isSelected ? "underline underline-offset-2" : "",
              ].join(" ")}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DateTimeStep({
  service,
  selectedDate,
  selectedTime,
  onSelectDate,
  onSelectTime,
}: {
  service: BookableService;
  selectedDate: Date | null;
  selectedTime: string | null;
  onSelectDate: (d: Date) => void;
  onSelectTime: (t: string) => void;
}) {
  const slots = selectedDate ? getTimeSlots(selectedDate, service) : [];

  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
      <div className="bg-sand-100 rounded-2xl p-5">
        <CalendarView
          selected={selectedDate}
          onSelect={(d) => {
            onSelectDate(d);
            onSelectTime("");
          }}
        />
      </div>

      <div className="flex flex-col gap-4">
        {selectedDate ? (
          <>
            <p className="text-petroleum-400 text-sm">
              Available times for{" "}
              <span className="text-petroleum-700 font-medium">
                {selectedDate.toLocaleDateString("en-GB", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </span>
            </p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {slots.map(({ time, booked }) => (
                <button
                  key={time}
                  disabled={booked}
                  onClick={() => !booked && onSelectTime(time)}
                  className={[
                    "rounded-xl border py-2.5 text-sm transition-all",
                    booked
                      ? "border-petroleum-100 text-petroleum-200 cursor-not-allowed line-through"
                      : selectedTime === time
                        ? "border-petroleum-700 bg-petroleum-700 text-sand-50 font-medium"
                        : "border-petroleum-200 text-petroleum-600 hover:border-petroleum-400 cursor-pointer",
                  ].join(" ")}
                >
                  {time}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="flex h-full min-h-32 items-center justify-center">
            <p className="text-petroleum-300 text-sm">
              Select a date to see available times.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Step 3: Details ──────────────────────────────────────────

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

type DetailsState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  notes: string;
};

function DetailsStep({
  details,
  onChange,
}: {
  details: DetailsState;
  onChange: (d: DetailsState) => void;
}) {
  const set =
    (key: keyof DetailsState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange({ ...details, [key]: e.target.value });

  return (
    <div className="flex flex-col gap-5 md:max-w-lg">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="First name" id="first-name">
          <input
            id="first-name"
            type="text"
            required
            autoComplete="given-name"
            placeholder="Jane"
            value={details.firstName}
            onChange={set("firstName")}
            className={inputClass}
          />
        </Field>
        <Field label="Last name" id="last-name">
          <input
            id="last-name"
            type="text"
            required
            autoComplete="family-name"
            placeholder="Smith"
            value={details.lastName}
            onChange={set("lastName")}
            className={inputClass}
          />
        </Field>
      </div>
      <Field label="Email" id="email">
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          placeholder="jane@example.com"
          value={details.email}
          onChange={set("email")}
          className={inputClass}
        />
      </Field>
      <Field label="Phone" id="phone">
        <input
          id="phone"
          type="tel"
          required
          autoComplete="tel"
          placeholder="+34 600 000 000"
          value={details.phone}
          onChange={set("phone")}
          className={inputClass}
        />
      </Field>
      <Field label="Notes (optional)" id="notes">
        <textarea
          id="notes"
          rows={3}
          placeholder="Any specific requirements or questions..."
          value={details.notes}
          onChange={set("notes")}
          className={[inputClass, "resize-none"].join(" ")}
        />
      </Field>
    </div>
  );
}

// ─── Step 4: Confirm ──────────────────────────────────────────

function ConfirmStep({
  service,
  date,
  time,
  details,
}: {
  service: BookableService;
  date: Date;
  time: string;
  details: DetailsState;
}) {
  return (
    <div className="flex flex-col gap-6 md:max-w-lg">
      <div className="bg-sand-100 flex flex-col gap-5 rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="relative size-16 shrink-0 overflow-hidden rounded-xl">
            <Image
              src={service.image}
              alt={service.title}
              fill
              sizes="64px"
              className="object-cover"
            />
          </div>
          <div>
            <p className="text-petroleum-700 font-medium">{service.title}</p>
            <p className="text-petroleum-400 text-sm">
              {service.duration} · {service.price}
            </p>
          </div>
        </div>

        <div className="border-sand-300 grid grid-cols-2 gap-3 border-t pt-4">
          {[
            {
              label: "Date",
              value: date.toLocaleDateString("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              }),
            },
            { label: "Time", value: time },
            {
              label: "Name",
              value: `${details.firstName} ${details.lastName}`,
            },
            { label: "Email", value: details.email },
            { label: "Phone", value: details.phone },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-petroleum-400 text-xs">{label}</p>
              <p className="text-petroleum-700 text-sm">{value}</p>
            </div>
          ))}
        </div>
      </div>

      <p className="text-petroleum-400 text-xs leading-relaxed">
        By confirming you agree to our{" "}
        <a
          href="/terms"
          className="underline underline-offset-2"
          target="_blank"
        >
          Terms
        </a>{" "}
        and{" "}
        <a
          href="/privacy"
          className="underline underline-offset-2"
          target="_blank"
        >
          Privacy Policy
        </a>
        . A confirmation email will be sent to {details.email}.
      </p>
    </div>
  );
}

// ─── Success ──────────────────────────────────────────────────

function SuccessState({
  service,
  date,
  time,
  email,
}: {
  service: BookableService;
  date: Date;
  time: string;
  email: string;
}) {
  return (
    <div className="flex flex-col items-center gap-6 py-16 text-center">
      <div className="bg-petroleum-700 flex size-16 items-center justify-center rounded-full">
        <Check className="text-sand-50" size={28} />
      </div>
      <div className="flex flex-col gap-2">
        <h2 className="font-display text-petroleum-700 text-3xl">
          Booking confirmed.
        </h2>
        <p className="text-petroleum-500">
          {service.title} on{" "}
          {date.toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}{" "}
          at {time}.
        </p>
        <p className="text-petroleum-400 mt-1 text-sm">
          A confirmation has been sent to {email}.
        </p>
      </div>
      <Button variant="solid" size="md" href="/">
        Back to home
      </Button>
    </div>
  );
}

// ─── Main content ─────────────────────────────────────────────

function BookingContent() {
  const searchParams = useSearchParams();
  const serviceParam = searchParams.get("service");

  const [step, setStep] = useState(0);
  const [selectedService, setSelectedService] =
    useState<BookableService | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [details, setDetails] = useState<DetailsState>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    notes: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (serviceParam) {
      const service = bookableServices.find((s) => s.id === serviceParam);
      if (service) setSelectedService(service);
    }
  }, [serviceParam]);

  const canProceed = [
    !!selectedService,
    !!(selectedDate && selectedTime),
    !!(
      details.firstName &&
      details.lastName &&
      details.email &&
      details.phone
    ),
    true,
  ][step];

  const handleConfirm = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 1200);
  };

  if (submitted && selectedService && selectedDate && selectedTime) {
    return (
      <SuccessState
        service={selectedService}
        date={selectedDate}
        time={selectedTime}
        email={details.email}
      />
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-petroleum-700 text-4xl md:text-5xl">
          Book a session.
        </h1>
        <p className="text-petroleum-400">
          Choose your service, pick a time, and we will take care of the rest.
        </p>
      </div>

      <StepIndicator current={step} />

      <div className="min-h-64">
        {step === 0 && (
          <ServiceStep
            selected={selectedService}
            onSelect={setSelectedService}
          />
        )}
        {step === 1 && selectedService && (
          <DateTimeStep
            service={selectedService}
            selectedDate={selectedDate}
            selectedTime={selectedTime}
            onSelectDate={setSelectedDate}
            onSelectTime={setSelectedTime}
          />
        )}
        {step === 2 && (
          <DetailsStep details={details} onChange={setDetails} />
        )}
        {step === 3 &&
          selectedService &&
          selectedDate &&
          selectedTime && (
            <ConfirmStep
              service={selectedService}
              date={selectedDate}
              time={selectedTime}
              details={details}
            />
          )}
      </div>

      <div className="flex items-center gap-3">
        {step > 0 && (
          <Button
            variant="outline"
            size="md"
            onClick={() => setStep((s) => s - 1)}
            disabled={loading}
          >
            Back
          </Button>
        )}
        {step < 3 ? (
          <Button
            variant="solid"
            size="md"
            onClick={() => setStep((s) => s + 1)}
            disabled={!canProceed}
          >
            Continue
          </Button>
        ) : (
          <Button
            variant="solid"
            size="md"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? "Confirming…" : "Confirm booking"}
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function BookingSection() {
  return (
    <section className="bg-sand-50 min-h-dvh">
      <div className="mx-auto max-w-4xl px-5 pt-32 pb-24 md:pt-48">
        <Suspense>
          <BookingContent />
        </Suspense>
      </div>
    </section>
  );
}
