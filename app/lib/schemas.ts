import { z } from "zod";
import { isValidPhone } from "@/utils/contact";

export const signInSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const bookingDetailsSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Enter a valid email address"),
  phone: z
    .string()
    .min(6, "Enter a valid phone number")
    .refine(isValidPhone, "Enter a valid phone number"),
  consent: z.literal(true, {
    error: "You must accept the terms and privacy policy",
  }),
});

// ─── Dashboard people forms ───────────────────────────────────
//
// The user and contact screens used to validate with a bare
// `if (!firstName || !email)`, which let malformed emails and phone numbers
// through and could only report one error at a time. These schemas mirror the
// database constraints so the four screens agree on what a valid person is.

const genderField = z.enum(["female", "male", "other"]).or(z.literal(""));

const optionalPhoneField = z
  .string()
  .refine((v) => v.trim() === "" || isValidPhone(v), {
    message: "Enter a valid phone number, including the country code",
  });

const personFields = {
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().optional(),
  email: z.string().trim().email("Enter a valid email address"),
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
    .refine((v) => v === "" || z.string().email().safeParse(v).success, {
      message: "Enter a valid email address",
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

    if (!z.string().email().safeParse(value.email).success) {
      ctx.addIssue({
        code: "custom",
        path: ["email"],
        message: isAccount
          ? "An account needs a valid email address to sign in with"
          : "Enter a valid email address",
      });
    }
  });

export const locationAddressSchema = z.object({
  street: z.string().min(1, "Street is required"),
  building: z.string().optional(),
  postalCode: z.string().regex(/^\d{5}$/, "Postal code must be 5 digits"),
  municipality: z.string().min(1, "Municipality is required"),
});

export const accountProfileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().optional(),
  phone: z
    .string()
    .regex(/^[+\d\s\-().]{6,}$/, "Enter a valid phone number")
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
