import { z } from "zod";
import { isValidPhone } from "@/utils/contact";
import type {
  CampaignAudience,
  CampaignChannel,
  CampaignContent,
  CampaignKind,
  CampaignLocale,
  CampaignLocaleContent,
  CampaignTrigger,
  EmailDoc,
  WhatsAppContent,
} from "@/types/campaign";
import { docIsEmpty } from "@/lib/campaigns/doc";
import { audienceLocales } from "@/lib/campaigns/languages";
import { whatsappBlocks } from "@/lib/campaigns/whatsapp-content";
import { APPOINTMENT_HOURS } from "@/lib/campaigns/appointment-form";
import { MAX_LIST_PEOPLE } from "@/lib/campaigns/segment-conditions";
import { kindAllowedForChannel } from "@/lib/campaigns/whatsapp-form";
import { countParams, paramIssues } from "@/lib/whatsapp/templates";
import {
  WHATSAPP_TEMPLATE_CATEGORIES,
  type WhatsAppParamSource,
} from "@/lib/whatsapp/types";

/**
 * Message KEYS, not sentences: this form is on the bilingual public site, and
 * the screen resolves them against `common.validation` through `useTranslations`.
 */
export const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(160, "emailInvalid")
    .pipe(z.email("emailInvalid")),
  /**
   * The upper bound is not a password policy — it is a doorstop. Without it a
   * multi-megabyte string reaches the hash on the other side, and hashing is
   * deliberately slow.
   */
  password: z.string().min(1, "passwordRequired").max(200, "passwordTooLong"),
});

/** The address on the "forgot my password" form. */
export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(160, "emailInvalid")
    .pipe(z.email("emailInvalid")),
});

/**
 * The second half of the reset: the emailed code and the new password.
 *
 * The code is exactly six digits, so anything else is refused before it costs
 * a round trip. The eight-character floor applies only to passwords being set
 * from here — nobody's existing password is affected — and it is the one place
 * worth asking for, because a reset that accepts `a` undoes every other
 * control on this page.
 */
export const resetPasswordSchema = forgotPasswordSchema.extend({
  otp: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "codeInvalid"),
  newPassword: z
    .string()
    .min(8, "passwordTooShort")
    .max(200, "passwordTooLong"),
});

/**
 * Creating an account.
 *
 * The eight-character floor matches the reset: two doors onto the same
 * password, and only one of them asking would be no floor at all.
 */
export const signUpSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(160, "emailInvalid")
    .pipe(z.email("emailInvalid")),
  password: z.string().min(8, "passwordTooShort").max(200, "passwordTooLong"),
  name: z.string().trim().max(120).optional(),
});

/** The six-digit code that finishes a sign-up. */
export const verifyEmailSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(160, "emailInvalid")
    .pipe(z.email("emailInvalid")),
  otp: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "codeInvalid"),
});

/**
 * The contact form. The same shape validates the browser and the server
 * action, because a form that emails the team is worth checking twice.
 */
export const contactMessageSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(80),
  lastName: z.string().trim().min(1, "Last name is required").max(80),
  email: z.string().trim().email("Enter a valid email address").max(160),
  interest: z.enum(
    ["membership", "wellness", "medicine", "community", "other"],
    { message: "Choose a topic" },
  ),
  message: z
    .string()
    .trim()
    .min(10, "Tell us a little more — at least 10 characters")
    .max(4000),
});

/** Keys against `common.validation`, as above. */
export const bookingDetailsSchema = z.object({
  firstName: z.string().min(1, "firstNameRequired"),
  lastName: z.string().min(1, "lastNameRequired"),
  email: z.email("emailInvalid"),
  phone: z.string().min(6, "phoneInvalid").refine(isValidPhone, "phoneInvalid"),
  consent: z.literal(true, { error: "consentRequired" }),
});

/** The first step of buying a bonus: who is buying, checked as a booking's client is. */
export const bonusDetailsSchema = bookingDetailsSchema.pick({
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
});

/** The last step: the acceptance of the terms, worded and checked as in a booking. */
export const bonusConsentSchema = bookingDetailsSchema.pick({ consent: true });

// ─── Dashboard people forms ───────────────────────────────────
//
// The user and contact screens used to validate with a bare
// `if (!firstName || !email)`, which let malformed emails and phone numbers
// through and could only report one error at a time. These schemas mirror the
// database constraints so the four screens agree on what a valid person is.

const genderField = z.enum(["female", "male", "other"]).or(z.literal(""));

/**
 * The dashboard people schemas below carry message KEYS rather than English
 * sentences: the dashboard is bilingual, and these are the only schemas it
 * validates with. Each screen resolves them against `dashboard.validation.*`
 * through `useTranslations`. The public-site schemas above keep their literal
 * messages — nothing there reads them through next-intl yet.
 */
const optionalPhoneField = z
  .string()
  .refine((v) => v.trim() === "" || isValidPhone(v), {
    message: "phoneInvalid",
  });

const personFields = {
  firstName: z.string().trim().min(1, "firstNameRequired"),
  lastName: z.string().trim().optional(),
  email: z.string().trim().email("emailInvalid"),
  phone: optionalPhoneField,
  gender: genderField,
};

/** Creating or editing a staff account (`profiles`). */
export const dashboardUserSchema = z.object({
  ...personFields,
  role: z.enum(["admin", "staff", "partner"]),
});

/** Creating or editing a contact (`contacts`). */
export const dashboardContactSchema = z.object({
  ...personFields,
  // A contact may exist without an email — bookings taken over the phone often
  // have only a number — so this is looser than the staff schema.
  email: z
    .string()
    .trim()
    .refine((v) => v === "" || z.email().safeParse(v).success, {
      message: "emailInvalid",
    }),
});

/**
 * The "new user" screen, which can also create a contact.
 *
 * An account needs an email to sign in with; a contact does not. Walk-in
 * clients without an address are real — two of them shared a placeholder
 * address in the database until it was cleared.
 */
export const newDashboardPersonSchema = z
  .object({
    ...personFields,
    email: z.string().trim(),
    role: z.enum(["admin", "staff", "partner", "client", "member"]),
  })
  .superRefine((value, ctx) => {
    const isAccount = ["admin", "staff", "partner"].includes(value.role);
    if (!isAccount && value.email === "") return;

    if (!z.email().safeParse(value.email).success) {
      ctx.addIssue({
        code: "custom",
        path: ["email"],
        message: isAccount ? "accountEmailRequired" : "emailInvalid",
      });
    }
  });
/** Keys against `dashboard.validation`, like the other dashboard schemas. */
export const accountProfileSchema = z.object({
  firstName: z.string().min(1, "firstNameRequired"),
  lastName: z.string().optional(),
  phone: z
    .string()
    .regex(/^[+\d\s\-().]{6,}$/, "phoneFormatInvalid")
    .optional()
    .or(z.literal("")),
});

export type FormErrors<T extends z.ZodTypeAny> = Partial<
  Record<keyof z.infer<T>, string>
>;

export function parseErrors<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown,
): FormErrors<T> {
  const result = schema.safeParse(data);
  if (result.success) return {};
  const errors: FormErrors<T> = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0] as keyof z.infer<T>;
    if (key && !errors[key]) {
      errors[key] = issue.message;
    }
  }
  return errors;
}

// ─── Email campaigns ─────────────────────────────────────────
//
// Message KEYS against `dashboard.validation.*`, like the other dashboard
// schemas. `https` is enforced on every URL the admin types: the email is sent
// in the centre's name and a plain-http link in it looks like phishing.

/**
 * Every key a campaign issue can carry. `collectIssues` maps anything else —
 * a wrong type at the root, a shape Zod describes in its own words — to
 * `invalidInput`, so the screen never shows a bare English sentence.
 */
const CAMPAIGN_MESSAGE_KEYS = new Set([
  "nameRequired",
  "nameTooLong",
  "nameTaken",
  "subjectRequired",
  "subjectTooLong",
  "preheaderTooLong",
  "titleRequired",
  "titleTooLong",
  "bodyRequired",
  "bodyTooLong",
  "ctaTextTooLong",
  "urlMustBeHttps",
  "ctaNeedsBoth",
  "blockTextRequired",
  "imageUrlRequired",
  "tooManyBlocks",
  "subjectBRequired",
  "daysOutOfRange",
  "hoursOutOfRange",
  "tierInvalid",
  "manualNotAllowed",
  "servicesTooMany",
  "contactIdInvalid",
  "tooManyContacts",
  "templateRequired",
  "paramTooLong",
  "kindNotAllowedForChannel",
  "invalidInput",
]);

/** Empty, or a well-formed `https://` URL. */
export const campaignAudienceSchema = z.object({
  language: z.enum(["any", "en", "es"]),
  newsletter: z.boolean().nullable(),
  services: z.array(z.string().min(1)).max(50, "servicesTooMany"),
  lastBooking: z
    .object({
      op: z.enum(["gt", "lt"]),
      days: z
        .number()
        .int("daysOutOfRange")
        .min(1, "daysOutOfRange")
        .max(3650, "daysOutOfRange"),
    })
    .nullable(),
  neverBooked: z.boolean(),
  hasBooked: z.boolean().optional(),
  sendLocale: z.enum(["en", "es"]).optional(),
  manualIds: z.array(z.uuid("contactIdInvalid")).max(5000, "tooManyContacts"),
  manualOnly: z.boolean().optional(),
}) satisfies z.ZodType<CampaignAudience>;

/**
 * What a saved segment holds: the conditions, and, for a hand-made list, the
 * people (`manualIds`, uuids without repeats, up to 2000) with `manualOnly`.
 * One without the other is neither kind of segment and is refused.
 */
export const segmentConditionsSchema = campaignAudienceSchema
  .omit({ manualIds: true, manualOnly: true })
  .extend({
    manualIds: z
      .array(z.uuid("contactIdInvalid"))
      .max(MAX_LIST_PEOPLE, "tooManyContacts")
      .optional(),
    manualOnly: z.literal(true).optional(),
  })
  .superRefine((value, ctx) => {
    const ids = value.manualIds ?? [];
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: "custom",
        path: ["manualIds"],
        message: "contactIdInvalid",
      });
    }
    // A list is people and manualOnly together; either alone is neither kind.
    if ((value.manualOnly === true) !== ids.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["manualIds"],
        message: "invalidInput",
      });
    }
  });

export const segmentSchema = z.object({
  name: z.string().trim().min(1, "nameRequired").max(120, "nameTooLong"),
  conditions: segmentConditionsSchema,
});

/**
 * One language's block with only the per-field limits. The "required" rules
 * live in `campaignLocaleContentSchema`, because a block the campaign does not
 * go out in is allowed to stay empty.
 */
/**
 * The body is a Maily document. The loose shape only asks for the envelope
 * (`type: "doc"`), so a draft can hold whatever the editor produced; the
 * strict one refuses an empty body before anything is sent.
 */
export const docNode: z.ZodType<EmailDoc> = z.lazy(() =>
  z.object({
    type: z.string(),
    attrs: z.record(z.string(), z.unknown()).optional(),
    content: z.array(docNode).optional(),
    marks: z
      .array(
        z.object({
          type: z.string(),
          attrs: z.record(z.string(), z.unknown()).optional(),
        }),
      )
      .optional(),
    text: z.string().optional(),
  }),
);

const localeContentShape = {
  subject: z.string().trim().max(120, "subjectTooLong"),
  subjectB: z.string().trim().max(120, "subjectTooLong").optional(),
  preheader: z.string().trim().max(150, "preheaderTooLong"),
  title: z.string().trim().max(200, "titleTooLong"),
  doc: docNode.nullable(),
};

/** A language block the campaign actually sends: subject, title and a body. */
const campaignLocaleContentSchema = z.object({
  ...localeContentShape,
  subject: localeContentShape.subject.min(1, "subjectRequired"),
  title: localeContentShape.title.min(1, "titleRequired"),
  doc: docNode.nullable().refine((doc) => !docIsEmpty(doc), "bodyRequired"),
});

/** Runs the strict block schema and reports its issues under `content.<locale>`. */
function refineLocale(
  locale: CampaignLocale,
  block: CampaignLocaleContent,
  ctx: z.RefinementCtx,
  prefix: PropertyKey[],
) {
  const result = campaignLocaleContentSchema.safeParse(block);
  if (result.success) return;
  for (const issue of result.error.issues) {
    ctx.addIssue({
      code: "custom",
      path: [...prefix, locale, ...issue.path],
      message: issue.message,
    });
  }
}

/**
 * What a WhatsApp campaign fills `{{n}}` with. `field` reads from the contact
 * or the booking, `static` is text the admin typed. The sources are the ones
 * `WhatsAppParamSource` declares, so a field added there fails to compile here.
 *
 * A fixed text over 200 characters is reported on the parameter itself
 * (`content.whatsapp.params.N`), the one key the form can attach to its input.
 */
export const whatsappParamSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("field"),
    field: z.enum([
      "first_name",
      "last_name",
      "service",
      "session_type",
      "date",
      "time",
      "post_title",
      "post_url",
    ]),
  }),
  z
    .object({
      kind: z.literal("static"),
      value: z.string().trim(),
    })
    .refine((param) => param.value.length <= 200, "paramTooLong"),
]) satisfies z.ZodType<WhatsAppParamSource>;

/** One language's template and what fills it. */
const whatsappLocaleContentSchema = z.object({
  templateId: z.uuid("templateRequired").nullable(),
  params: z.array(whatsappParamSchema).max(20),
});

/**
 * The `content.whatsapp` block: a template per language (`es`, `en`), each
 * with its own parameters. Even a draft keeps it well formed (a uuid or
 * nothing, parameters of a known shape) so it always loads back into the form;
 * only `campaignSchema` insists on a template, for every language of the
 * audience.
 *
 * The old shape (one `templateId` and `params` at the top, from when a
 * campaign had one language) is still accepted, and read by `whatsappBlocks`
 * as the template of the language that campaign was sent in.
 *
 * Error keys: `content.whatsapp.<locale>.templateId` and
 * `content.whatsapp.<locale>.params.N`.
 */
export const whatsappContentSchema = z.object({
  es: whatsappLocaleContentSchema.optional(),
  en: whatsappLocaleContentSchema.optional(),
  templateId: z.uuid("templateRequired").nullable().optional(),
  params: z.array(whatsappParamSchema).max(20).optional(),
}) satisfies z.ZodType<WhatsAppContent>;

/**
 * The `content` column: both language blocks plus the optional WhatsApp one.
 * Only the per-field limits live here. What a block must contain depends on
 * the channel and the audience, so `campaignSchema` checks that.
 */
export const campaignContentSchema = z.object({
  en: z.object(localeContentShape),
  es: z.object(localeContentShape),
  whatsapp: whatsappContentSchema.optional(),
}) satisfies z.ZodType<CampaignContent>;

/**
 * The languages a campaign must be written in: the one its audience fixes, or
 * both when it spans the two. Each recipient gets the version of her language
 * (`recipientLocale`). The rule lives in `languages.ts`, which the senders
 * read too.
 */
export function requiredLocales(
  audience: Pick<CampaignAudience, "language">,
): CampaignLocale[] {
  return audienceLocales(audience);
}

export const campaignKindSchema = z.enum([
  "standard",
  "automated",
  "autoresponder",
  "split",
  "rss",
  "dateBased",
  "appointment",
]);

export const campaignChannelSchema = z.enum(["email", "whatsapp"]);

export const campaignTriggerSchema = z.object({
  event: z
    .enum([
      "newsletter_subscribed",
      "segment_entry",
      "after_booking",
      "birthday",
      "first_booking_anniversary",
      "new_blog_post",
      "first_visit",
      "before_visit",
      "after_visit",
    ])
    .optional(),
  days: z
    .number()
    .int("daysOutOfRange")
    .min(0, "daysOutOfRange")
    .max(365, "daysOutOfRange")
    .optional(),
  hours: z
    .number()
    .int("hoursOutOfRange")
    .min(0, "hoursOutOfRange")
    // The widest of the events; each event's own bounds are `addCampaignIssues`.
    .max(720, "hoursOutOfRange")
    .optional(),
  tierId: z.string().uuid("tierInvalid").optional(),
});

/**
 * A template has no subject to test and no link that changes per send, so the
 * A/B and RSS kinds exist only as emails; and an appointment notice goes to a
 * client's phone about her own booking, so it exists only on WhatsApp. The form
 * hides what a channel cannot be, but the action is a public endpoint: this is
 * where it is actually enforced, for a draft as much as for a send.
 * `kindAllowedForChannel` is the one source.
 *
 * The rest of what ties the pieces of an appointment notice together lives
 * here too, because it reads `kind`, `trigger` and `audience` side by side.
 */
function addCampaignIssues(
  value: {
    kind: CampaignKind;
    channel: CampaignChannel;
    trigger: CampaignTrigger;
    audience: { manualIds: string[]; manualOnly?: boolean };
  },
  ctx: z.RefinementCtx,
) {
  // A hand-made list with nobody in it would reach nobody, not everybody.
  if (value.audience.manualOnly && value.audience.manualIds.length === 0) {
    ctx.addIssue({
      code: "custom",
      path: ["audience", "manualIds"],
      message: "invalidInput",
    });
  }

  if (!kindAllowedForChannel(value.kind, value.channel)) {
    ctx.addIssue({
      code: "custom",
      path: ["kind"],
      message: "kindNotAllowedForChannel",
    });
  }

  const { event, hours } = value.trigger;
  const visitEvent = event === "before_visit" || event === "after_visit";
  if (value.kind === "appointment") {
    // The only two events it runs on.
    if (!visitEvent) {
      ctx.addIssue({
        code: "custom",
        path: ["trigger", "event"],
        message: "invalidInput",
      });
    }
    // The audience is the appointments themselves: nobody is added by hand.
    if (value.audience.manualIds.length > 0 || value.audience.manualOnly) {
      ctx.addIssue({
        code: "custom",
        path: ["audience", "manualIds"],
        message: "manualNotAllowed",
      });
    }
  } else if (visitEvent) {
    // And those two events belong to no other kind.
    ctx.addIssue({
      code: "custom",
      path: ["trigger", "event"],
      message: "invalidInput",
    });
  }

  // The base schema allows up to 720 (the widest event). Past that it has
  // already said so, once; saying it again here would give the field two errors.
  if (hours !== undefined && hours > 720) return;
  if (visitEvent) {
    // The limits are `appointment-form.ts`'s, which the form reads too.
    const { min, max } = APPOINTMENT_HOURS[event];
    if (hours === undefined || hours < min || hours > max) {
      ctx.addIssue({
        code: "custom",
        path: ["trigger", "hours"],
        message: "hoursOutOfRange",
      });
    }
  } else if (hours !== undefined && hours > 168) {
    // Every other event keeps the ceiling it always had.
    ctx.addIssue({
      code: "custom",
      path: ["trigger", "hours"],
      message: "hoursOutOfRange",
    });
  }
}

/**
 * The whole campaign. What it must contain depends on the channel. An email
 * needs the version of every language its audience includes (the one rule
 * that needs `audience` and `content` side by side): both when the audience
 * spans the two, the audience's own when it fixes one. A WhatsApp campaign
 * needs a template for each of those same languages and ignores the email
 * blocks. `campaignContentSchema` holds just the per-field limits.
 */
export const campaignSchema = z
  .object({
    name: z.string().trim().min(1, "nameRequired").max(120, "nameTooLong"),
    // An older client that does not send it is sending an email.
    channel: campaignChannelSchema.default("email"),
    kind: campaignKindSchema,
    trigger: campaignTriggerSchema,
    audience: campaignAudienceSchema,
    content: campaignContentSchema,
  })
  .superRefine((value, ctx) => {
    addCampaignIssues(value, ctx);
    if (value.channel === "whatsapp") {
      // The email blocks are not sent, so nothing is asked of them. The
      // template is the one thing a WhatsApp message cannot go without, and
      // every language of the audience needs its own: Meta keeps each
      // language of a template as a template apart, and each contact is
      // written to in hers.
      const blocks = whatsappBlocks(value.content.whatsapp, value.audience);
      for (const locale of requiredLocales(value.audience)) {
        if (!blocks[locale]?.templateId) {
          ctx.addIssue({
            code: "custom",
            path: ["content", "whatsapp", locale, "templateId"],
            message: "templateRequired",
          });
        }
      }
      return;
    }
    // Every language the audience includes must have its whole version: each
    // recipient gets hers, and one left half written would reach people. The
    // version of a language the audience leaves out is not sent, so nothing is
    // asked of it beyond its limits (its tab is not even on the form).
    for (const locale of requiredLocales(value.audience)) {
      refineLocale(locale, value.content[locale], ctx, ["content"]);
      // An A/B test with one subject is not a test, in either language.
      if (value.kind === "split" && !value.content[locale].subjectB?.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["content", locale, "subjectB"],
          message: "subjectBRequired",
        });
      }
    }
  });

export type CampaignInput = z.infer<typeof campaignSchema>;

/**
 * A saved campaign keeps its channel. Its recipients, counters and report all
 * mean something only in that channel, so editing cannot turn an email into a
 * WhatsApp message or back. Make a new campaign instead.
 */
export function channelChangeAllowed(
  saved: CampaignChannel,
  next: CampaignChannel,
): boolean {
  return saved === next;
}

/**
 * What a draft has to satisfy: a name, well-shaped conditions, and blocks
 * within their limits. Nothing has to be filled in — a draft is by definition
 * unfinished — but nothing may be malformed either, so a saved draft always
 * loads back into the form.
 */
export const campaignDraftSchema = z
  .object({
    name: z.string().trim().min(1, "nameRequired").max(120, "nameTooLong"),
    channel: campaignChannelSchema.default("email"),
    kind: campaignKindSchema,
    trigger: campaignTriggerSchema,
    audience: campaignAudienceSchema,
    content: campaignContentSchema,
  })
  .superRefine(addCampaignIssues);

/**
 * The first issue per dotted path — `"content.es.subject"` — wins. An issue
 * with no path (the payload itself is not an object) lands under `"_"`, so the
 * consumer always has something to show.
 */
function collectIssues(issues: z.core.$ZodIssue[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join(".") || "_";
    if (errors[key]) continue;
    errors[key] = CAMPAIGN_MESSAGE_KEYS.has(issue.message)
      ? issue.message
      : "invalidInput";
  }
  return errors;
}

export type CampaignValidation =
  | { ok: true; data: CampaignInput }
  | { ok: false; errors: Record<string, string> };

/**
 * The one check the client form and the server action share. Pure: no I/O,
 * and it never throws — `input` is whatever came over the wire. Error keys are
 * dotted paths (`"name"`, `"audience.lastBooking.days"`,
 * `"content.es.subject"`, `"_"` for the root) and values are message keys.
 */
export function validateCampaign(input: unknown): CampaignValidation {
  const parsed = campaignSchema.safeParse(input);
  if (parsed.success) return { ok: true, data: parsed.data };
  return { ok: false, errors: collectIssues(parsed.error.issues) };
}

/** The draft-strength check; same shape of answer as `validateCampaign`. */
export function validateCampaignDraft(input: unknown): CampaignValidation {
  const parsed = campaignDraftSchema.safeParse(input);
  if (parsed.success) return { ok: true, data: parsed.data };
  return { ok: false, errors: collectIssues(parsed.error.issues) };
}

// ─── WhatsApp templates ───────────────────────────────────────
//
// Messages are keys under `dashboard.validation.*`. Meta's naming rule for
// templates is lowercase letters, digits and underscores, up to 512 chars; the
// body may run to 1024 and placeholders must be 1..n consecutive and not at an
// edge. Header, footer and button URL take no variables: Meta wants an example
// for a header or URL one, forbids them in a footer, and the form asks for none.
// Every message below is a key, never prose, so the form can translate it.
export const whatsappTemplateSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "templateNameRequired")
      .max(512, "templateNameTooLong")
      .regex(/^[a-z0-9_]+$/, "templateNameFormat"),
    language: z.enum(["es", "en"], "templateLanguageInvalid"),
    category: z.enum(WHATSAPP_TEMPLATE_CATEGORIES, "templateCategoryInvalid"),
    headerText: z
      .string()
      .trim()
      .max(60, "headerTooLong")
      .refine((v) => !v.includes("{{"), "headerNoVariables")
      .optional(),
    body: z
      .string()
      .trim()
      .min(1, "templateBodyRequired")
      .max(1024, "templateBodyTooLong"),
    footerText: z
      .string()
      .trim()
      .max(60, "footerTooLong")
      .refine((v) => !v.includes("{{"), "footerNoVariables")
      .optional(),
    buttons: z
      .array(
        z.discriminatedUnion("type", [
          z.object({
            type: z.literal("URL"),
            text: z
              .string()
              .trim()
              .min(1, "buttonTextRequired")
              .max(25, "buttonTextTooLong"),
            url: z
              .string()
              .trim()
              .url("urlInvalid")
              .max(2000, "urlTooLong")
              .startsWith("https://", "urlMustBeHttps")
              .refine((v) => !v.includes("{{"), "urlNoVariables"),
          }),
          z.object({
            type: z.literal("QUICK_REPLY"),
            text: z
              .string()
              .trim()
              .min(1, "buttonTextRequired")
              .max(25, "buttonTextTooLong"),
          }),
        ]),
      )
      .max(3, "tooManyButtons"),
    exampleParams: z
      .array(
        z.string().trim().min(1, "exampleRequired").max(200, "exampleTooLong"),
      )
      .max(20, "exampleTooLong"),
  })
  .superRefine((value, ctx) => {
    for (const issue of paramIssues(value.body)) {
      ctx.addIssue({ code: "custom", path: ["body"], message: issue });
    }
    if (value.exampleParams.length !== countParams(value.body)) {
      ctx.addIssue({
        code: "custom",
        path: ["exampleParams"],
        message: "exampleCountMismatch",
      });
    }
  });

export type WhatsAppTemplateInput = z.infer<typeof whatsappTemplateSchema>;

/** Every key the template schema can raise; anything else is `invalidInput`. */
export const TEMPLATE_MESSAGE_KEYS = new Set([
  "templateNameRequired",
  "templateNameTooLong",
  "templateNameFormat",
  "templateLanguageInvalid",
  "templateCategoryInvalid",
  "templateBodyRequired",
  "templateBodyTooLong",
  "headerTooLong",
  "headerNoVariables",
  "footerTooLong",
  "footerNoVariables",
  "buttonTextRequired",
  "buttonTextTooLong",
  "urlInvalid",
  "urlTooLong",
  "urlMustBeHttps",
  "urlNoVariables",
  "tooManyButtons",
  "exampleRequired",
  "exampleTooLong",
  "exampleCountMismatch",
  "paramMalformed",
  "paramGap",
  "paramAtEdge",
]);

export type WhatsAppTemplateValidation =
  | { ok: true; data: WhatsAppTemplateInput }
  | { ok: false; fieldErrors: Record<string, string> };

/**
 * Validates anything a client sent. A Server Action is a public endpoint, so
 * the payload may not even be an object; every issue Zod words in its own
 * English (a wrong type, a missing field) becomes `invalidInput`, and a
 * payload with no path lands under `"_"`.
 */
export function validateWhatsAppTemplate(
  input: unknown,
): WhatsAppTemplateValidation {
  const parsed = whatsappTemplateSchema.safeParse(input);
  if (parsed.success) return { ok: true, data: parsed.data };
  const fieldErrors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path.map(String).join(".") || "_";
    if (fieldErrors[key]) continue;
    fieldErrors[key] = TEMPLATE_MESSAGE_KEYS.has(issue.message)
      ? issue.message
      : "invalidInput";
  }
  return { ok: false, fieldErrors };
}

export const paymentSettingsSchema = z.object({
  depositPercent: z.number().int().min(10).max(100),
  fullPaymentDiscountPercent: z.number().int().min(0).max(50),
});

export const bonusPlanSchema = z.object({
  id: z.string().uuid().optional(),
  tierId: z.string().uuid(),
  sessions: z.number().int().min(1).max(50),
  priceEur: z.number().min(0),
  validityDays: z.number().int().min(1).max(1095),
  active: z.boolean(),
});

/**
 * What the public consent form sends. The token in the URL is the only proof of
 * who is signing, so everything else is checked here and again on the server.
 */
export const consentSchema = z.object({
  data: z.record(z.string(), z.union([z.boolean(), z.string().max(500)])),
  birthdate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  phone: z.string().min(6).max(30).optional(),
  treatmentAccepted: z.literal(true), // "Acepto el tratamiento informado"
  healthDataConsent: z.literal(true), // RGPD: tratamiento de datos de salud
  imageConsent: z.boolean(), // opcional e independiente
  signedName: z.string().trim().min(2).max(120),
  // Absent only when a signed consent is being corrected and keeps its
  // signature; the server decides, and refuses it for a first signing.
  signaturePng: z
    .string()
    .startsWith("data:image/png;base64,")
    .max(400_000)
    .optional(),
});

export type ConsentInput = z.infer<typeof consentSchema>;

/**
 * What the public bonus checkout accepts. The price is never part of it: the
 * route reads the plan from the database.
 */
export const bonusCheckoutSchema = z.object({
  planId: z.string().uuid(),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.email().max(160),
  phone: z.string().trim().min(6).max(30).refine(isValidPhone),
  consent: z.literal(true),
  locale: z.enum(["en", "es"]),
});
