import { dashboardUserSchema, type FormErrors } from "@/lib/schemas";
import type { GenderValue } from "@/constants/gender";
import type { WeeklySchedule } from "@/types/schedule";

/**
 * The profile being edited, and every way the form changes it.
 *
 * Apart from the page so the fields can dispatch without importing the screen
 * that arranges them.
 */
export type SystemRole = "admin" | "staff" | "partner";

export type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
  phone: string | null;
  gender: GenderValue | null;
  job_title: string | null;
  preferred_language: string | null;
  role: SystemRole;
  google_connected_email: string | null;
  schedule: WeeklySchedule | null;
  slot_interval_minutes: number | null;
};

// ─── State ────────────────────────────────────────────────────

export type UserErrors = FormErrors<typeof dashboardUserSchema>;

export type State = {
  loading: boolean;
  fieldErrors: UserErrors;
  notFound: boolean;
  saving: boolean;
  confirmRemove: boolean;
  removing: boolean;
  error: string | null;
  firstName: string;
  lastName: string;
  email: string;
  originalEmail: string;
  phone: string;
  gender: GenderValue;
  language: string;
  role: SystemRole;
  avatarUrl: string;
  jobTitle: string;
};

export type Action =
  | { type: "LOADED"; profile: Profile }
  | { type: "NOT_FOUND" }
  | { type: "SET_SAVING"; value: boolean }
  | { type: "SET_REMOVING"; value: boolean }
  | { type: "OPEN_REMOVE" }
  | { type: "CLOSE_REMOVE" }
  | { type: "SET_ERROR"; msg: string | null }
  | {
      type: "SET_FIELD";
      field:
        "firstName" | "lastName" | "email" | "phone" | "jobTitle" | "sortOrder";
      value: string;
    }
  | { type: "SET_GENDER"; gender: GenderValue }
  | { type: "SET_LANGUAGE"; language: string }
  | { type: "SET_AVATAR_URL"; value: string }
  | { type: "SET_ROLE"; role: SystemRole }
  | { type: "SET_FIELD_ERRORS"; errors: UserErrors };

export const initial: State = {
  loading: true,
  fieldErrors: {},
  notFound: false,
  saving: false,
  confirmRemove: false,
  removing: false,
  error: null,
  firstName: "",
  lastName: "",
  email: "",
  originalEmail: "",
  phone: "",
  gender: "",
  language: "en",
  role: "staff",
  avatarUrl: "",
  jobTitle: "",
};

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "LOADED":
      return {
        ...state,
        loading: false,
        firstName:
          action.profile.first_name ??
          action.profile.full_name?.split(" ")[0] ??
          "",
        lastName:
          action.profile.last_name ??
          action.profile.full_name?.split(" ").slice(1).join(" ") ??
          "",
        email: action.profile.email ?? "",
        originalEmail: action.profile.email ?? "",
        phone: action.profile.phone ?? "",
        gender: action.profile.gender ?? "",
        jobTitle: action.profile.job_title ?? "",
        language: action.profile.preferred_language ?? "en",
        role: action.profile.role,
        avatarUrl: action.profile.avatar_url ?? "",
      };
    case "NOT_FOUND":
      return { ...state, loading: false, notFound: true };
    case "SET_SAVING":
      return { ...state, saving: action.value };
    case "SET_REMOVING":
      return { ...state, removing: action.value };
    case "OPEN_REMOVE":
      return { ...state, confirmRemove: true };
    case "CLOSE_REMOVE":
      return { ...state, confirmRemove: false };
    case "SET_ERROR":
      return { ...state, error: action.msg };
    case "SET_FIELD":
      return {
        ...state,
        [action.field]: action.value,
        fieldErrors: { ...state.fieldErrors, [action.field]: undefined },
      };
    case "SET_FIELD_ERRORS":
      return { ...state, fieldErrors: action.errors, saving: false };
    case "SET_GENDER":
      return { ...state, gender: action.gender };
    case "SET_AVATAR_URL":
      return { ...state, avatarUrl: action.value };
    case "SET_LANGUAGE":
      return { ...state, language: action.language };
    case "SET_ROLE":
      return { ...state, role: action.role };
  }
}

/**
 * Only system roles: this screen edits an existing `profiles` row, and a
 * profile cannot be turned into a contact. Same labels and order as the
 * creation form.
 */
export const ROLE_VALUES: SystemRole[] = ["staff", "partner", "admin"];
