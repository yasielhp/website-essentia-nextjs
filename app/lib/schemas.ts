import { z } from "zod";
import { isValidPhone } from "@/utils/contact";

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
