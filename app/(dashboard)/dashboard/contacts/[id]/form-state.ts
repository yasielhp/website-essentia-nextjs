import { dashboardContactSchema, type FormErrors } from "@/lib/schemas";
import type { GenderValue } from "@/constants/gender";

/**
 * The editable half of a contact, and every way it changes.
 *
 * Kept apart from the page because the details card takes the same actions and
 * has no other reason to import the screen that renders it.
 */
export type ContactErrors = FormErrors<typeof dashboardContactSchema>;

export type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  language: string;
  /** YYYY-MM-DD or "". */
  birthdate: string;
  gender: GenderValue;
  newsletterSubscribed: boolean;
  fieldErrors: ContactErrors;
  error: string | null;
  saving: boolean;
  deleting: boolean;
  deleteOpen: boolean;
};

export type FormAction =
  | {
      type: "INIT";
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      language: string;
      birthdate: string;
      gender: GenderValue;
      newsletterSubscribed: boolean;
    }
  | {
      type: "SET_FIELD";
      field:
        "firstName" | "lastName" | "email" | "phone" | "language" | "birthdate";
      value: string;
    }
  | { type: "SET_GENDER"; gender: GenderValue }
  | { type: "TOGGLE_NEWSLETTER" }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "SET_FIELD_ERRORS"; errors: ContactErrors }
  | { type: "SAVING_START" }
  | { type: "SAVING_END" }
  | { type: "DELETING_START" }
  | { type: "OPEN_DELETE" }
  | { type: "CLOSE_DELETE" };

export const initialFormState: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  language: "en",
  birthdate: "",
  gender: "",
  newsletterSubscribed: false,
  fieldErrors: {},
  error: null,
  saving: false,
  deleting: false,
  deleteOpen: false,
};

export function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "INIT":
      return {
        ...state,
        firstName: action.firstName,
        lastName: action.lastName,
        email: action.email,
        phone: action.phone,
        language: action.language,
        birthdate: action.birthdate,
        gender: action.gender,
        newsletterSubscribed: action.newsletterSubscribed,
      };
    case "SET_GENDER":
      return { ...state, gender: action.gender };
    case "TOGGLE_NEWSLETTER":
      return { ...state, newsletterSubscribed: !state.newsletterSubscribed };
    case "SET_FIELD":
      return {
        ...state,
        [action.field]: action.value,
        fieldErrors: { ...state.fieldErrors, [action.field]: undefined },
      };
    case "SET_FIELD_ERRORS":
      return { ...state, fieldErrors: action.errors, saving: false };
    case "SET_ERROR":
      return { ...state, error: action.error };
    case "SAVING_START":
      return { ...state, saving: true, error: null };
    case "SAVING_END":
      return { ...state, saving: false };
    case "DELETING_START":
      return { ...state, deleting: true };
    case "OPEN_DELETE":
      return { ...state, deleteOpen: true };
    case "CLOSE_DELETE":
      return { ...state, deleteOpen: false };
    default:
      return state;
  }
}
