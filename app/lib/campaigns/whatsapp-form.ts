import { formatLongDate } from "@/lib/format-date";
import type {
  CampaignChannel,
  CampaignKind,
  CampaignLocale,
  CampaignTrigger,
} from "@/types/campaign";
import type {
  WhatsAppParamField,
  WhatsAppParamSource,
  WhatsAppTemplateRow,
  WhatsAppTemplateUnsupportedReason,
} from "@/lib/whatsapp/types";
import {
  templateChoiceIssue,
  type TemplateChoiceIssue,
} from "./whatsapp-eligibility";
import { resolveParams } from "./whatsapp-params";

/**
 * What the WhatsApp step of the campaign form decides, over plain values so a
 * test can reach it. Nothing here knows about React or the database.
 */

/**
 * The kinds a template cannot be. An A/B test varies the subject, which a
 * template does not have; an RSS campaign needs the post's link in the message
 * and Meta takes a button's URL fixed.
 */
const BLOCKED_ON_WHATSAPP: ReadonlySet<CampaignKind> = new Set([
  "split",
  "rss",
]);

export function kindAllowedForChannel(
  kind: CampaignKind,
  channel: CampaignChannel,
): boolean {
  return channel === "email" || !BLOCKED_ON_WHATSAPP.has(kind);
}

/**
 * The contact fields the form offers for `{{n}}`. The post fields exist in the
 * type because the automation can supply them, but the RSS kind is off on
 * WhatsApp, so nothing could fill them.
 */
export const PARAM_FIELDS = [
  "first_name",
  "last_name",
  "service",
  "session_type",
  "date",
  "time",
] as const satisfies readonly WhatsAppParamField[];

const VISIT_FIELDS: ReadonlySet<string> = new Set([
  "service",
  "session_type",
  "date",
  "time",
]);

/**
 * Whether the rule hands the message a visit to talk about. Only the booking
 * rules do (`after_booking`, `first_visit`): a one-off send, a segment entry
 * or a birthday has no visit, and a field about one is sent as a dash.
 */
export function visitFieldsExist(
  kind: CampaignKind,
  trigger: CampaignTrigger,
): boolean {
  return (
    kind === "automated" &&
    (trigger.event === "after_booking" || trigger.event === "first_visit")
  );
}

/** Whether `field` will have a value when this campaign sends. */
export function fieldAvailable(
  field: WhatsAppParamField,
  kind: CampaignKind,
  trigger: CampaignTrigger,
): boolean {
  if (field === "first_name" || field === "last_name") return true;
  if (VISIT_FIELDS.has(field)) return visitFieldsExist(kind, trigger);
  return false;
}

/** The positions whose field has no value, so they would reach Meta as a dash. */
export function unavailableParams(
  params: WhatsAppParamSource[],
  kind: CampaignKind,
  trigger: CampaignTrigger,
): number[] {
  const out: number[] = [];
  params.forEach((source, index) => {
    if (
      source.kind === "field" &&
      !fieldAvailable(source.field, kind, trigger)
    ) {
      out.push(index);
    }
  });
  return out;
}

/**
 * The sources as the template needs them: what the admin set is kept, missing
 * `{{n}}` start as an empty fixed text, extra ones are cut. The same array
 * comes back when it already fits, so a state update can see nothing changed.
 */
export function fitParams(
  params: WhatsAppParamSource[],
  count: number,
): WhatsAppParamSource[] {
  if (params.length === count) return params;
  return Array.from(
    { length: count },
    (_, i): WhatsAppParamSource => params[i] ?? { kind: "static", value: "" },
  );
}

export type TemplateChoices = {
  /** Approved, supported and in the campaign's language. */
  eligible: WhatsAppTemplateRow[];
  /** How many of the others there are, by the first reason that rules each out. */
  excluded: Partial<Record<TemplateChoiceIssue, number>>;
  /** Why the unsupported ones are, without repeats. */
  unsupportedReasons: WhatsAppTemplateUnsupportedReason[];
};

/** Splits the account's templates into what can be chosen and why the rest cannot. */
export function partitionTemplates(
  templates: WhatsAppTemplateRow[],
  sendLocale: CampaignLocale,
): TemplateChoices {
  const eligible: WhatsAppTemplateRow[] = [];
  const excluded: TemplateChoices["excluded"] = {};
  const reasons = new Set<WhatsAppTemplateUnsupportedReason>();
  for (const template of templates) {
    const issue = templateChoiceIssue(template, sendLocale);
    if (issue === null) {
      eligible.push(template);
      continue;
    }
    excluded[issue] = (excluded[issue] ?? 0) + 1;
    if (template.unsupported_reason) reasons.add(template.unsupported_reason);
  }
  return { eligible, excluded, unsupportedReasons: [...reasons] };
}

const SAMPLE = {
  es: {
    firstName: "Ana",
    lastName: "García",
    service: "Drenaje linfático",
    sessionType: "Sesión individual",
  },
  en: {
    firstName: "Anna",
    lastName: "Smith",
    service: "Lymphatic drainage",
    sessionType: "Single session",
  },
} as const;

/**
 * The values a sample recipient would give each `{{n}}`, as Meta would get
 * them: a field with no value in this campaign is a dash here too, so the
 * preview does not promise what the send will not deliver.
 */
export function sampleParams(
  sources: WhatsAppParamSource[],
  locale: CampaignLocale,
  kind: CampaignKind,
  trigger: CampaignTrigger,
  today: Date,
): string[] {
  const sample = SAMPLE[locale];
  const day = new Date(today);
  day.setDate(day.getDate() + 1);
  const iso = [
    day.getFullYear(),
    String(day.getMonth() + 1).padStart(2, "0"),
    String(day.getDate()).padStart(2, "0"),
  ].join("-");
  const vars = visitFieldsExist(kind, trigger)
    ? {
        service: sample.service,
        session_type: sample.sessionType,
        date: formatLongDate(iso, locale),
        time: "10:30",
      }
    : {};
  return resolveParams(
    sources,
    {
      id: "sample",
      email: null,
      firstName: sample.firstName,
      lastName: sample.lastName,
      language: locale,
    },
    vars,
  );
}
