/** The new-person form as one value, shared by the page and its fields. */

import type { GenderValue } from "@/constants/gender";
import type { FormErrors, newDashboardPersonSchema } from "@/lib/schemas";

/**
 * What this form can create.
 *
 * `admin`/`staff`/`partner` are `profiles.role` values and come with an auth
 * account. `client` is not a role at all — it is a `contacts` row with
 * `status = 'client'` and no login. `member` is a `memberships` record that
 * needs a plan and dates.
 */
export type NewUserKind = "admin" | "staff" | "partner" | "client" | "member";

export type SystemRole = "admin" | "staff" | "partner";

export const SYSTEM_ROLES: SystemRole[] = ["admin", "staff", "partner"];

export function isSystemRole(kind: NewUserKind): kind is SystemRole {
  return (SYSTEM_ROLES as NewUserKind[]).includes(kind);
}

export type PersonErrors = FormErrors<typeof newDashboardPersonSchema>;

export type FormState = {
  submitting: boolean;
  error: string | null;
  fieldErrors: PersonErrors;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gender: GenderValue;
  language: string;
  role: NewUserKind;
};

export type FormAction =
  | {
      type: "SET_FIELD";
      field: "firstName" | "lastName" | "email" | "phone";
      value: string;
    }
  | { type: "SET_ROLE"; role: NewUserKind }
  | { type: "SET_GENDER"; gender: GenderValue }
  | { type: "SET_LANGUAGE"; language: string }
  | { type: "SUBMIT_START" }
  | { type: "SUBMIT_ERROR"; message: string }
  | { type: "SET_FIELD_ERRORS"; errors: PersonErrors }
  | { type: "CLEAR_ERROR" };

export const ROLE_VALUES: NewUserKind[] = [
  "client",
  "member",
  "staff",
  "partner",
  "admin",
];

/** Keeps the default in step with whatever ROLE_VALUES lists first. */
const ROLES_DEFAULT: NewUserKind = ROLE_VALUES[0]!;

export const initialState: FormState = {
  submitting: false,
  error: null,
  fieldErrors: {},
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  gender: "",
  language: "en",
  // The first option in ROLES, so the form opens on what the list shows first
  // rather than on a different choice further down.
  role: ROLES_DEFAULT,
};

export function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "SET_FIELD":
      return {
        ...state,
        [action.field]: action.value,
        fieldErrors: { ...state.fieldErrors, [action.field]: undefined },
      };
    case "SET_FIELD_ERRORS":
      return { ...state, fieldErrors: action.errors, submitting: false };
    case "SET_ROLE":
      return { ...state, role: action.role };
    case "SET_GENDER":
      return { ...state, gender: action.gender };
    case "SET_LANGUAGE":
      return { ...state, language: action.language };
    case "SUBMIT_START":
      return { ...state, submitting: true, error: null };
    case "SUBMIT_ERROR":
      return { ...state, submitting: false, error: action.message };
    case "CLEAR_ERROR":
      return { ...state, error: null };
    default:
      return state;
  }
}
