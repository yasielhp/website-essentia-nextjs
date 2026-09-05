import {
  EMPTY_AUDIENCE,
  EMPTY_LOCALE_CONTENT,
  type CampaignAudience,
  type CampaignContent,
  type CampaignLocale,
  type CampaignLocaleContent,
  type CampaignRow,
} from "@/types/campaign";

/**
 * The campaign form as one value, shared by the three steps and the shell.
 *
 * `reach` is the audience count the server last reported; the shell refuses to
 * move past the first step while it is zero, so it lives here rather than in
 * the step that displays it. `pickedContacts` remembers the names behind
 * `audience.manualIds`, which the server never needs and the chips do.
 */

export type Step = 0 | 1 | 2;

export type PickedContact = { id: string; name: string; email: string };

export type FormState = {
  id: string | null;
  step: Step;
  name: string;
  audience: CampaignAudience;
  content: CampaignContent;
  activeLocale: CampaignLocale;
  pickedContacts: PickedContact[];
  reach: { count: number; en: number; es: number } | null;
  fieldErrors: Record<string, string>;
  submitting: boolean;
  error: string | null;
};

export type FormAction =
  | { type: "SET_NAME"; value: string }
  | { type: "SET_AUDIENCE"; patch: Partial<CampaignAudience> }
  | { type: "ADD_MANUAL"; contact: PickedContact }
  | { type: "REMOVE_MANUAL"; id: string }
  | { type: "SET_REACH"; reach: FormState["reach"] }
  | {
      type: "SET_CONTENT";
      locale: CampaignLocale;
      field: keyof CampaignLocaleContent;
      value: string;
    }
  | { type: "SET_LOCALE"; locale: CampaignLocale }
  | { type: "GO"; step: Step }
  | { type: "SET_ERRORS"; errors: Record<string, string> }
  | { type: "SUBMIT_START" }
  | { type: "SUBMIT_ERROR"; message: string }
  | { type: "SUBMIT_END" }
  | { type: "LOAD"; campaign: CampaignRow; picked: PickedContact[] };

export const initialFormState: FormState = {
  id: null,
  step: 0,
  name: "",
  audience: EMPTY_AUDIENCE,
  content: { en: EMPTY_LOCALE_CONTENT, es: EMPTY_LOCALE_CONTENT },
  activeLocale: "es",
  pickedContacts: [],
  reach: null,
  fieldErrors: {},
  submitting: false,
  error: null,
};

/** Drops every error under a dotted prefix, e.g. `content.es.`. */
function without(
  errors: Record<string, string>,
  prefix: string,
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(errors)) {
    if (!key.startsWith(prefix)) next[key] = value;
  }
  return next;
}

export function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "SET_NAME":
      return {
        ...state,
        name: action.value,
        fieldErrors: without(state.fieldErrors, "name"),
      };
    case "SET_AUDIENCE": {
      const audience = { ...state.audience, ...action.patch };
      // "Never booked" cannot hold alongside a booking condition.
      if (audience.neverBooked) {
        audience.services = [];
        audience.lastBooking = null;
      }
      return {
        ...state,
        audience,
        reach: null,
        fieldErrors: without(state.fieldErrors, "audience"),
      };
    }
    case "ADD_MANUAL":
      if (state.audience.manualIds.includes(action.contact.id)) return state;
      return {
        ...state,
        reach: null,
        pickedContacts: [...state.pickedContacts, action.contact],
        audience: {
          ...state.audience,
          manualIds: [...state.audience.manualIds, action.contact.id],
        },
      };
    case "REMOVE_MANUAL":
      return {
        ...state,
        reach: null,
        pickedContacts: state.pickedContacts.filter((c) => c.id !== action.id),
        audience: {
          ...state.audience,
          manualIds: state.audience.manualIds.filter((id) => id !== action.id),
        },
      };
    case "SET_REACH":
      return { ...state, reach: action.reach };
    case "SET_CONTENT":
      return {
        ...state,
        content: {
          ...state.content,
          [action.locale]: {
            ...state.content[action.locale],
            [action.field]: action.value,
          },
        },
        fieldErrors: without(
          state.fieldErrors,
          `content.${action.locale}.${action.field}`,
        ),
      };
    case "SET_LOCALE":
      return { ...state, activeLocale: action.locale };
    case "GO":
      return { ...state, step: action.step, error: null };
    case "SET_ERRORS":
      return { ...state, fieldErrors: action.errors, submitting: false };
    case "SUBMIT_START":
      return { ...state, submitting: true, error: null };
    case "SUBMIT_ERROR":
      return { ...state, submitting: false, error: action.message };
    case "SUBMIT_END":
      return { ...state, submitting: false };
    case "LOAD":
      return {
        ...initialFormState,
        id: action.campaign.id,
        name: action.campaign.name,
        audience: { ...EMPTY_AUDIENCE, ...action.campaign.audience },
        content: {
          en: { ...EMPTY_LOCALE_CONTENT, ...action.campaign.content.en },
          es: { ...EMPTY_LOCALE_CONTENT, ...action.campaign.content.es },
        },
        activeLocale: action.campaign.audience.language === "en" ? "en" : "es",
        pickedContacts: action.picked,
      };
    default:
      return state;
  }
}

/** The first locale whose block carries an error, for the content tabs. */
export function firstErroredLocale(
  errors: Record<string, string>,
): CampaignLocale | null {
  if (Object.keys(errors).some((k) => k.startsWith("content.es."))) return "es";
  if (Object.keys(errors).some((k) => k.startsWith("content.en."))) return "en";
  return null;
}
