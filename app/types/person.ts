/**
 * Attributes shared by the two people tables: `contacts` (clients and leads)
 * and `profiles` (staff accounts).
 */

/**
 * Stored on both tables as a nullable column — `null` means "not specified",
 * which is what every record created before the field existed carries.
 *
 * Distinct from the `therapistGender` used in the booking flow, which records a
 * preference about the practitioner rather than a fact about the person.
 */
export type Gender = "female" | "male" | "other";
