/**
 * The session being edited, and every way the form changes it.
 *
 * Apart from the page because the details form and the sidebar dispatch the
 * same actions and have no other reason to import the screen around them.
 */
export type AccessType = "members_only" | "open" | "paid" | "paid_members_free";
export type Session = {
  id: string;
  title: string;
  description: string | null;
  title_es: string | null;
  description_es: string | null;
  date: string;
  duration_minutes: number | null;
  location: string | null;
  max_participants: number | null;
  image_url: string | null;
  access: AccessType;
};

export type PageState = {
  loading: boolean;
  notFound: boolean;
  saving: boolean;
  deleting: boolean;
  deleteOpen: boolean;
  error: string | null;
  title: string;
  description: string;
  titleEs: string;
  descriptionEs: string;
  date: string;
  time: string;
  duration: string;
  location: string;
  maxParticipants: string;
  imageUrl: string;
  access: AccessType;
};

export type PageAction =
  | {
      type: "LOAD_SUCCESS";
      payload: {
        title: string;
        description: string;
        titleEs: string;
        descriptionEs: string;
        date: string;
        time: string;
        duration: string;
        location: string;
        maxParticipants: string;
        imageUrl: string;
        access: AccessType;
      };
    }
  | { type: "LOAD_NOT_FOUND" }
  | { type: "SET_SAVING"; value: boolean }
  | { type: "SET_DELETING"; value: boolean }
  | { type: "OPEN_DELETE_DIALOG" }
  | { type: "CLOSE_DELETE_DIALOG" }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "SET_TITLE"; value: string }
  | { type: "SET_DESCRIPTION"; value: string }
  | { type: "SET_TITLE_ES"; value: string }
  | { type: "SET_DESCRIPTION_ES"; value: string }
  | { type: "SET_DATE"; value: string }
  | { type: "SET_TIME"; value: string }
  | { type: "SET_DURATION"; value: string }
  | { type: "SET_LOCATION"; value: string }
  | { type: "SET_MAX_PARTICIPANTS"; value: string }
  | { type: "SET_IMAGE_URL"; value: string }
  | { type: "SET_ACCESS"; value: AccessType };

export const initialState: PageState = {
  loading: true,
  notFound: false,
  saving: false,
  deleting: false,
  deleteOpen: false,
  error: null,
  title: "",
  description: "",
  titleEs: "",
  descriptionEs: "",
  date: "",
  time: "",
  duration: "",
  location: "",
  maxParticipants: "",
  imageUrl: "",
  access: "members_only",
};

export function reducer(state: PageState, action: PageAction): PageState {
  switch (action.type) {
    case "LOAD_SUCCESS":
      return { ...state, loading: false, ...action.payload };
    case "LOAD_NOT_FOUND":
      return { ...state, loading: false, notFound: true };
    case "SET_SAVING":
      return { ...state, saving: action.value };
    case "SET_DELETING":
      return { ...state, deleting: action.value };
    case "OPEN_DELETE_DIALOG":
      return { ...state, deleteOpen: true };
    case "CLOSE_DELETE_DIALOG":
      return { ...state, deleteOpen: false };
    case "SET_ERROR":
      return { ...state, error: action.error };
    case "SET_TITLE":
      return { ...state, title: action.value };
    case "SET_DESCRIPTION":
      return { ...state, description: action.value };
    case "SET_TITLE_ES":
      return { ...state, titleEs: action.value };
    case "SET_DESCRIPTION_ES":
      return { ...state, descriptionEs: action.value };
    case "SET_DATE":
      return { ...state, date: action.value };
    case "SET_TIME":
      return { ...state, time: action.value };
    case "SET_DURATION":
      return { ...state, duration: action.value };
    case "SET_LOCATION":
      return { ...state, location: action.value };
    case "SET_MAX_PARTICIPANTS":
      return { ...state, maxParticipants: action.value };
    case "SET_IMAGE_URL":
      return { ...state, imageUrl: action.value };
    case "SET_ACCESS":
      return { ...state, access: action.value };
  }
}
