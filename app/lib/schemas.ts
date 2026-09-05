import { z } from "zod";
import { isValidPhone } from "@/utils/contact";
import type {
  CampaignAudience,
  CampaignContent,
  CampaignLanguage,
  CampaignLocaleContent,
} from "@/types/campaign";

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

const httpsUrl = z
  .string()
  .trim()
  .refine((v) => v === "" || /^https:\/\/\S+$/i.test(v), {
    message: "urlMustBeHttps",
  });

export const campaignAudienceSchema = z.object({
  language: z.enum(["any", "en", "es"]),
  newsletter: z.boolean().nullable(),
  services: z.array(z.string().min(1)).max(50),
  lastBooking: z
    .object({
      op: z.enum(["gt", "lt"]),
      days: z.number().int().min(1).max(3650),
    })
    .nullable(),
  neverBooked: z.boolean(),
  manualIds: z.array(z.uuid()).max(5000),
});

/**
 * One language's block with only the per-field limits. The "required" rules
 * live in `campaignLocaleContentSchema`, because a block the campaign does not
 * go out in is allowed to stay empty.
 */
const localeContentShape = {
  subject: z.string().trim().max(120, "subjectTooLong"),
  preheader: z.string().trim().max(150, "preheaderTooLong"),
  title: z.string().trim().max(200),
  body: z.string().trim().max(20000),
  imageUrl: httpsUrl,
  ctaText: z.string().trim().max(60),
  ctaUrl: httpsUrl,
};

/** A language block the campaign actually sends: subject, title and body. */
const campaignLocaleContentSchema = z
  .object({
    ...localeContentShape,
    subject: localeContentShape.subject.min(1, "subjectRequired"),
    title: localeContentShape.title.min(1, "titleRequired"),
    body: localeContentShape.body.min(1, "bodyRequired"),
  })
  .superRefine((value, ctx) => {
    const hasText = value.ctaText !== "";
    const hasUrl = value.ctaUrl !== "";
    if (hasText !== hasUrl) {
      ctx.addIssue({
        code: "custom",
        path: [hasText ? "ctaUrl" : "ctaText"],
        message: "ctaNeedsBoth",
      });
    }
  });

function isEmptyLocale(block: CampaignLocaleContent): boolean {
  return Object.values(block).every((v) => v === "");
}

/**
 * Both language blocks. A block is valid if EITHER every field is the empty
 * string (the campaign does not go out in that language) OR it passes
 * `campaignLocaleContentSchema`. Whether a given language may be left empty
 * depends on the audience filter, which is `validateCampaign`'s job.
 */
export const campaignContentSchema = z
  .object({
    en: z.object(localeContentShape),
    es: z.object(localeContentShape),
  })
  .superRefine((value, ctx) => {
    for (const locale of ["en", "es"] as const) {
      const block = value[locale];
      if (isEmptyLocale(block)) continue;
      const result = campaignLocaleContentSchema.safeParse(block);
      if (result.success) continue;
      for (const issue of result.error.issues) {
        ctx.addIssue({
          code: "custom",
          path: [locale, ...issue.path],
          message: issue.message,
        });
      }
    }
  });

export const campaignSchema = z.object({
  name: z.string().trim().min(1, "nameRequired").max(120),
  audience: campaignAudienceSchema,
  content: campaignContentSchema,
});

export type CampaignInput = z.infer<typeof campaignSchema>;

/** Which locale blocks a campaign must fill in, from its language filter. */
export function requiredLocales(language: CampaignLanguage): ("en" | "es")[] {
  return language === "any" ? ["en", "es"] : [language];
}

/**
 * A message key is a bare camelCase word; anything else is one of Zod's own
 * sentences (`max(200)` with no key, a wrong type) and the screen shows a
 * generic message for it.
 */
function issueKey(message: string): string {
  return /^[a-z][A-Za-z0-9]*$/.test(message) ? message : "invalid";
}

/** The first issue per dotted path — `"content.es.subject"` — wins. */
function collectIssues(
  issues: z.core.$ZodIssue[],
  errors: Record<string, string>,
  prefix: PropertyKey[] = [],
) {
  for (const issue of issues) {
    const key = [...prefix, ...issue.path].map(String).join(".");
    if (key && !errors[key]) errors[key] = issueKey(issue.message);
  }
}

export type CampaignValidation =
  | { ok: true; data: CampaignInput }
  | { ok: false; errors: Record<string, string> };

/**
 * The one check the client form and the server action share. Pure: no I/O.
 *
 * `campaignSchema` alone lets any language block stay empty; this adds the rule
 * that the languages the audience filter selects cannot be. Error keys are
 * dotted paths (`"name"`, `"audience.lastBooking.days"`,
 * `"content.es.subject"`) and values are message keys.
 */
export function validateCampaign(input: {
  name: string;
  audience: CampaignAudience;
  content: CampaignContent;
}): CampaignValidation {
  const errors: Record<string, string> = {};

  const parsed = campaignSchema.safeParse(input);
  if (!parsed.success) collectIssues(parsed.error.issues, errors);

  for (const locale of requiredLocales(input.audience.language)) {
    const block = campaignLocaleContentSchema.safeParse(input.content[locale]);
    if (!block.success) {
      collectIssues(block.error.issues, errors, ["content", locale]);
    }
  }

  if (!parsed.success || Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, data: parsed.data };
}
