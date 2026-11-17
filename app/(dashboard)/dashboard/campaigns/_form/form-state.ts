import {
  EMPTY_AUDIENCE,
  EMPTY_LOCALE_CONTENT,
  type CampaignAudience,
  type CampaignChannel,
  type CampaignContent,
  type CampaignLocale,
  type CampaignLocaleContent,
  type CampaignRow,
  type EmailDoc,
  type SegmentConditions,
  type WhatsAppContent,
  type CampaignKind,
  type CampaignTrigger,
  DEFAULT_TRIGGER,
} from "@/types/campaign";
import { sendLocaleOf } from "@/lib/schemas";
import { kindSwitchAllowed } from "@/lib/campaigns/appointment-form";
import { kindAllowedForChannel } from "@/lib/campaigns/whatsapp-form";

/**
 * The campaign form as one value, shared by the three steps and the shell.
 *
 * `reach` is the audience count the server last reported; the shell refuses to
 * move past the first step while it is zero, so it lives here rather than in
 * the step that displays it. `pickedContacts` remembers the names behind
 * `audience.manualIds`, which the server never needs and the chips do.
 */

export type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Where an error sends the admin: the step that owns the field. */
export const STEP_OF = {
  kind: 0,
  name: 1,
  audience: 2,
  trigger: 3,
  template: 4,
  content: 5,
  review: 6,
} as const;

/**
 * The step after `step`, skipping the ones this campaign does not have: the
 * trigger for a kind with one event, and the starting-point step for a WhatsApp
 * campaign, whose template step is the content step.
 */
export function nextStep(
  step: Step,
  channel: CampaignChannel,
  hasTrigger: boolean,
): Step {
  let next = step + 1;
  if (next === STEP_OF.trigger && !hasTrigger) next = STEP_OF.template;
  if (next === STEP_OF.template && channel === "whatsapp") {
    next = STEP_OF.content;
  }
  return next as Step;
}

/** Every kind can be built; the picker shows them all. */
export const AVAILABLE_KINDS: CampaignKind[] = [
  "standard",
  "automated",
  "autoresponder",
  "split",
  "rss",
  "dateBased",
  // Only the WhatsApp channel can be one: `kindsForChannel` decides.
  "appointment",
];

export type PickedContact = { id: string; name: string; email: string };

export type FormState = {
  id: string | null;
  step: Step;
  /** Fixed once the campaign is saved: its report only makes sense in one. */
  channel: CampaignChannel;
  kind: CampaignKind;
  /** The kind the campaign was saved with; null while it is new. */
  savedKind: CampaignKind | null;
  trigger: CampaignTrigger;
  name: string;
  /** The saved segment the conditions came from; null means everyone or ad hoc. */
  segmentId: string | null;
  segmentName: string | null;
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
  | { type: "SET_CHANNEL"; channel: CampaignChannel }
  | {
      type: "SET_WHATSAPP";
      templateId: string | null;
      params: WhatsAppContent["params"];
    }
  | { type: "SET_KIND"; kind: CampaignKind }
  | { type: "SET_TRIGGER"; trigger: CampaignTrigger }
  | { type: "SET_AUDIENCE"; patch: Partial<CampaignAudience> }
  | {
      type: "SET_SEGMENT";
      id: string | null;
      name: string | null;
      conditions: SegmentConditions;
    }
  | { type: "ADD_MANUAL"; contact: PickedContact }
  | { type: "REMOVE_MANUAL"; id: string }
  | { type: "SET_REACH"; reach: FormState["reach"] }
  | {
      type: "SET_CONTENT";
      locale: CampaignLocale;
      field: Exclude<keyof CampaignLocaleContent, "doc">;
      value: string;
    }
  | {
      type: "SET_CONTENT_ALL";
      locale: CampaignLocale;
      content: CampaignLocaleContent;
    }
  | { type: "SET_DOC"; locale: CampaignLocale; doc: EmailDoc }
  | { type: "SET_LOCALE"; locale: CampaignLocale }
  | { type: "GO"; step: Step }
  | { type: "SET_ERRORS"; errors: Record<string, string> }
  | { type: "SUBMIT_START" }
  | { type: "SUBMIT_ERROR"; message: string }
  | { type: "SUBMIT_END" }
  | {
      type: "LOAD";
      campaign: CampaignRow;
      picked: PickedContact[];
      segmentName: string | null;
    };

export const initialFormState: FormState = {
  id: null,
  step: 0,
  channel: "email",
  kind: "standard",
  savedKind: null,
  trigger: {},
  name: "",
  segmentId: null,
  segmentName: null,
  // The form always names the send language; only stored rows may lack it.
  audience: { ...EMPTY_AUDIENCE, sendLocale: "es" },
  content: { en: EMPTY_LOCALE_CONTENT, es: EMPTY_LOCALE_CONTENT },
  activeLocale: "es",
  pickedContacts: [],
  reach: null,
  fieldErrors: {},
  submitting: false,
  error: null,
};

/**
 * The count with its language breakdown settled for the audience as it is.
 * A campaign goes out in one language and everybody reached gets that
 * version, so the breakdown is the whole count in the send language; a
 * breakdown computed under another send language would be a lie.
 */
export function reachIn(
  reach: FormState["reach"],
  audience: CampaignAudience,
): FormState["reach"] {
  if (!reach) return reach;
  const locale = sendLocaleOf(audience);
  return {
    count: reach.count,
    en: locale === "en" ? reach.count : 0,
    es: locale === "es" ? reach.count : 0,
  };
}

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
    case "SET_CHANNEL": {
      // A saved campaign keeps its channel (the action refuses to change it).
      if (state.id || action.channel === state.channel) return state;
      const kindFits = kindAllowedForChannel(state.kind, action.channel);
      return {
        ...state,
        channel: action.channel,
        // The audience is counted per channel and the content is a different
        // thing, so the form goes back to the kind step and is walked again;
        // what was typed stays.
        step: 0,
        reach: null,
        fieldErrors: {},
        kind: kindFits ? state.kind : "standard",
        trigger: kindFits ? state.trigger : {},
      };
    }
    case "SET_WHATSAPP":
      return {
        ...state,
        content: {
          ...state.content,
          whatsapp: { templateId: action.templateId, params: action.params },
        },
        fieldErrors: without(state.fieldErrors, "content.whatsapp"),
      };
    case "SET_KIND":
      if (!AVAILABLE_KINDS.includes(action.kind)) return state;
      if (!kindAllowedForChannel(action.kind, state.channel)) return state;
      // A saved campaign cannot become an appointment notice, or stop being one.
      if (state.id && !kindSwitchAllowed(state.savedKind, action.kind)) {
        return state;
      }
      return {
        ...state,
        kind: action.kind,
        // A new kind starts from its default event; the admin refines it.
        trigger:
          action.kind === state.kind
            ? state.trigger
            : { ...DEFAULT_TRIGGER[action.kind] },
        // An appointment notice is aimed at bookings, not at a list: no
        // segment, nobody by hand, none of the filters about past bookings.
        // The send language and nothing else of the audience carries over.
        ...(action.kind === "appointment" && state.kind !== "appointment"
          ? {
              segmentId: null,
              segmentName: null,
              pickedContacts: [],
              reach: null,
              audience: {
                ...EMPTY_AUDIENCE,
                language: "any" as const,
                sendLocale: state.audience.sendLocale ?? "es",
              },
            }
          : {}),
      };
    case "SET_TRIGGER":
      return { ...state, trigger: action.trigger };
    case "SET_SEGMENT":
      return {
        ...state,
        segmentId: action.id,
        segmentName: action.name,
        reach: null,
        // The conditions come from the segment; the hand-picked extras and
        // the send language stay with the campaign.
        audience: {
          ...action.conditions,
          manualIds: state.audience.manualIds,
          sendLocale:
            action.conditions.language !== "any"
              ? action.conditions.language
              : (state.audience.sendLocale ?? "es"),
        },
        fieldErrors: without(state.fieldErrors, "audience"),
      };
    case "SET_AUDIENCE": {
      const audience = { ...state.audience, ...action.patch };
      // The email is written in the segment's language when it fixes one.
      if (audience.language !== "any") audience.sendLocale = audience.language;
      else audience.sendLocale = audience.sendLocale ?? "es";
      // "Never booked" cannot hold alongside a booking condition.
      if (audience.neverBooked) {
        audience.services = [];
        audience.lastBooking = null;
        audience.hasBooked = false;
      }
      // Choosing the send language changes nobody's membership, so the count
      // stays: the step that recounts is folded away when this is chosen.
      const onlyLocale = Object.keys(action.patch).every(
        (key) => key === "sendLocale",
      );
      return {
        ...state,
        audience,
        reach: onlyLocale ? reachIn(state.reach, audience) : null,
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
    case "SET_CONTENT_ALL":
      return {
        ...state,
        content: { ...state.content, [action.locale]: action.content },
        fieldErrors: without(state.fieldErrors, `content.${action.locale}`),
      };
    case "SET_DOC":
      return {
        ...state,
        content: {
          ...state.content,
          [action.locale]: { ...state.content[action.locale], doc: action.doc },
        },
        fieldErrors: without(state.fieldErrors, `content.${action.locale}.doc`),
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
        channel: action.campaign.channel ?? "email",
        kind: action.campaign.kind ?? "standard",
        savedKind: action.campaign.kind ?? "standard",
        trigger: action.campaign.trigger ?? {},
        name: action.campaign.name,
        segmentId: action.campaign.segment_id ?? null,
        segmentName: action.segmentName,
        audience: { ...EMPTY_AUDIENCE, ...action.campaign.audience },
        content: {
          en: { ...EMPTY_LOCALE_CONTENT, ...action.campaign.content.en },
          es: { ...EMPTY_LOCALE_CONTENT, ...action.campaign.content.es },
          // Absent from every email and from rows older than the channel.
          ...(action.campaign.content.whatsapp
            ? { whatsapp: action.campaign.content.whatsapp }
            : {}),
        },
        activeLocale:
          action.campaign.audience.sendLocale ??
          (action.campaign.audience.language === "en" ? "en" : "es"),
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

/**
 * The `content` the server should store. An email carries no WhatsApp block,
 * even if the admin picked a template before switching channel back.
 */
export function contentOf(state: FormState): CampaignContent {
  if (state.channel === "whatsapp") return state.content;
  const { en, es } = state.content;
  return { en, es };
}
