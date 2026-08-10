/**
 * The race being edited, and every way the form changes it.
 *
 * Apart from the page because the details form and the sidebar dispatch the
 * same actions and have no other reason to import the screen around them.
 */
export type Race = {
  id: string;
  title: string;
  description: string | null;
  title_es: string | null;
  description_es: string | null;
  date: string | null;
  location: string | null;
  distance_km: number | null;
  max_participants: number | null;
  image_url: string | null;
  access: "members" | "open";
};

export type PageState = {
  loading: boolean;
  notFound: boolean;
  saving: boolean;
  deleting: boolean;
  confirmDelete: boolean;
  error: string | null;
  title: string;
  description: string;
  titleEs: string;
  descriptionEs: string;
  date: string;
  time: string;
  location: string;
  distance: string;
  maxParticipants: string;
  access: "members" | "open";
  imageUrl: string;
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
        location: string;
        distance: string;
        maxParticipants: string;
        access: "members" | "open";
        imageUrl: string;
      };
    }
  | { type: "LOAD_NOT_FOUND" }
  | { type: "SET_SAVING"; value: boolean }
  | { type: "SET_DELETING"; value: boolean }
  | { type: "OPEN_CONFIRM_DELETE" }
  | { type: "CLOSE_CONFIRM_DELETE" }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "SET_TITLE"; value: string }
  | { type: "SET_DESCRIPTION"; value: string }
  | { type: "SET_TITLE_ES"; value: string }
  | { type: "SET_DESCRIPTION_ES"; value: string }
  | { type: "SET_DATE"; value: string }
  | { type: "SET_TIME"; value: string }
  | { type: "SET_LOCATION"; value: string }
  | { type: "SET_DISTANCE"; value: string }
  | { type: "SET_MAX_PARTICIPANTS"; value: string }
  | { type: "SET_ACCESS"; value: "members" | "open" }
  | { type: "SET_IMAGE_URL"; value: string };

export const initialState: PageState = {
  loading: true,
  notFound: false,
  saving: false,
  deleting: false,
  confirmDelete: false,
  error: null,
  title: "",
  description: "",
  titleEs: "",
  descriptionEs: "",
  date: "",
  time: "07:00",
  location: "",
  distance: "",
  maxParticipants: "",
  access: "members",
  imageUrl: "",
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
    case "OPEN_CONFIRM_DELETE":
      return { ...state, confirmDelete: true };
    case "CLOSE_CONFIRM_DELETE":
      return { ...state, confirmDelete: false };
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
    case "SET_LOCATION":
      return { ...state, location: action.value };
    case "SET_DISTANCE":
      return { ...state, distance: action.value };
    case "SET_MAX_PARTICIPANTS":
      return { ...state, maxParticipants: action.value };
    case "SET_ACCESS":
      return { ...state, access: action.value };
    case "SET_IMAGE_URL":
      return { ...state, imageUrl: action.value };
  }
}
