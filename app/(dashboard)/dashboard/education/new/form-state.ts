/** The new-session form as one value, shared by the page and its fields. */

export type AccessType = "members_only" | "open" | "paid" | "paid_members_free";

export type FormState = {
  title: string;
  description: string;
  date: string;
  time: string;
  duration: string;
  location: string;
  maxParticipants: string;
  imageUrl: string;
  access: AccessType;
};

export type FormAction =
  | { type: "SET_FIELD"; field: keyof Omit<FormState, "access">; value: string }
  | { type: "SET_ACCESS"; value: AccessType };

export function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "SET_ACCESS":
      return { ...state, access: action.value };
    default:
      return state;
  }
}

// ─── Page ─────────────────────────────────────────────────────
