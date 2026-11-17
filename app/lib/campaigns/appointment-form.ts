import type { CampaignKind, CampaignTrigger } from "@/types/campaign";

/**
 * What the appointment-notice screens decide, over plain values: the limits of
 * the hours, how a trigger reads, what to call an appointment in a report, and
 * which kind switches a saved campaign may make. The schema reads the limits
 * from here, so the form and the server cannot disagree about them.
 */

export type AppointmentEvent = "before_visit" | "after_visit";

export const APPOINTMENT_HOURS = {
  /** Up to two weeks before a booking starts. */
  before_visit: { min: 1, max: 336, shortcuts: [72, 48, 24, 2] },
  /** Up to thirty days after a booking ends. */
  after_visit: { min: 1, max: 720, shortcuts: [2, 24, 72] },
} as const satisfies Record<
  AppointmentEvent,
  { min: number; max: number; shortcuts: readonly number[] }
>;

/** What a new notice starts at on either side. */
const DEFAULT_HOURS = 24;

export function isAppointmentEvent(
  event: string | undefined,
): event is AppointmentEvent {
  return event === "before_visit" || event === "after_visit";
}

/** The error key for hours the event does not allow, or null. */
export function appointmentHoursIssue(
  event: AppointmentEvent,
  hours: number | undefined,
): "hoursOutOfRange" | null {
  const { min, max } = APPOINTMENT_HOURS[event];
  return typeof hours === "number" &&
    Number.isInteger(hours) &&
    hours >= min &&
    hours <= max
    ? null
    : "hoursOutOfRange";
}

/**
 * The trigger after the admin picks the other side. The hours stay when they
 * still fit it (48 h before is as sensible as 48 h after); otherwise a day.
 * Nothing else of the previous trigger is kept: a notice has no days or tier.
 */
export function withAppointmentEvent(
  trigger: CampaignTrigger,
  event: AppointmentEvent,
): CampaignTrigger {
  const keep =
    isAppointmentEvent(trigger.event) &&
    appointmentHoursIssue(event, trigger.hours) === null;
  return { event, hours: keep ? trigger.hours : DEFAULT_HOURS };
}

/** Valid hours of an appointment trigger, or null. */
function validHours(
  trigger: CampaignTrigger,
): { event: AppointmentEvent; hours: number } | null {
  const { event, hours } = trigger;
  if (!isAppointmentEvent(event)) return null;
  if (appointmentHoursIssue(event, hours) !== null) return null;
  return { event, hours: hours as number };
}

/**
 * The sentence that says when it goes out, as a message key and its value, or
 * null while the hours are not valid (a phrase for an hour count the server
 * would refuse would promise something that cannot be saved).
 */
export function appointmentSentence(
  trigger: CampaignTrigger,
): { key: "sentenceBefore" | "sentenceAfter"; hours: number } | null {
  const valid = validHours(trigger);
  if (!valid) return null;
  return {
    key: valid.event === "before_visit" ? "sentenceBefore" : "sentenceAfter",
    hours: valid.hours,
  };
}

/** The short form for a summary row or a list: "48 h before the appointment". */
export function appointmentShort(
  trigger: CampaignTrigger,
): { key: "shortBefore" | "shortAfter"; hours: number } | null {
  const valid = validHours(trigger);
  if (!valid) return null;
  return {
    key: valid.event === "before_visit" ? "shortBefore" : "shortAfter",
    hours: valid.hours,
  };
}

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() !== "" ? value.trim() : null;

/**
 * Which appointment a notice was about, from what the rule stored on the
 * recipient's row (`vars`): the service, then the date and the time. A client
 * may get several notices from one campaign, and this is what tells them apart.
 * Null when the row says nothing about it.
 */
export function appointmentLabel(
  vars: Record<string, unknown> | null | undefined,
): string | null {
  if (!vars || typeof vars !== "object") return null;
  const service = text(vars.service);
  const date = text(vars.date);
  const time = text(vars.time);
  const when = [date, time].filter(Boolean).join(" ");
  const parts = [service, when || null].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * Whether a saved campaign may become `next`. An appointment notice counts
 * bookings and needs another consent, so a saved campaign cannot turn into one
 * or stop being one; the other kinds can still be switched among themselves.
 */
export function kindSwitchAllowed(
  saved: CampaignKind | null | undefined,
  next: CampaignKind,
): boolean {
  if (!saved || saved === next) return true;
  return saved !== "appointment" && next !== "appointment";
}
