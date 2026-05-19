import { z } from "zod";

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
    .regex(/^[+\d\s\-().]{6,}$/, "Enter a valid phone number"),
  consent: z.literal(true, {
    error: "You must accept the terms and privacy policy",
  }),
});

export const locationAddressSchema = z.object({
  street: z.string().min(1, "Street is required"),
  building: z.string().optional(),
  postalCode: z
    .string()
    .regex(/^\d{5}$/, "Postal code must be 5 digits"),
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
