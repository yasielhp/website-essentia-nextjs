/** The new-contact form as one value, shared by the page and its fields. */

import type { ContactStatus } from "@/types/contact";
import type { GenderValue } from "@/constants/gender";
import type { FormErrors, dashboardContactSchema } from "@/lib/schemas";

export type ContactErrors = FormErrors<typeof dashboardContactSchema>;

export type FormState = {
  submitting: boolean;
  error: string | null;
  fieldErrors: ContactErrors;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  language: string;
  /** YYYY-MM-DD or "". */
  birthdate: string;
  gender: GenderValue;
  status: ContactStatus;
  /** Consent the client gave in person. Off means "not asked", not "no". */
  newsletter: boolean;
};

export type FormAction =
  | {
      type: "SET_FIELD";
      field:
        "firstName" | "lastName" | "email" | "phone" | "language" | "birthdate";
      value: string;
    }
  | { type: "SET_STATUS"; status: ContactStatus }
  | { type: "SET_GENDER"; gender: GenderValue }
  | { type: "TOGGLE_NEWSLETTER" }
  | { type: "SUBMIT_START" }
  | { type: "SUBMIT_ERROR"; message: string }
  | { type: "SET_FIELD_ERRORS"; errors: ContactErrors }
  | { type: "CLEAR_ERROR" };

export const initialFormState: FormState = {
  submitting: false,
  error: null,
  fieldErrors: {},
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  language: "en",
  birthdate: "",
  gender: "",
  status: "lead",
  newsletter: false,
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
    case "SET_STATUS":
      return { ...state, status: action.status };
    case "SET_GENDER":
      return { ...state, gender: action.gender };
    case "TOGGLE_NEWSLETTER":
      return { ...state, newsletter: !state.newsletter };
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

// ---------------------------------------------------------------------------
