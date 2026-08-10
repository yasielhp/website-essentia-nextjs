/** The new-race form as one value, shared by the page and its fields. */

export type FormState = {
  title: string;
  description: string;
  date: string;
  time: string;
  distance: string;
  location: string;
  maxParticipants: string;
  imageUrl: string;
  access: "members" | "open";
};

export type FormAction =
  | { type: "SET_FIELD"; field: keyof Omit<FormState, "access">; value: string }
  | { type: "SET_ACCESS"; value: "members" | "open" };

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
