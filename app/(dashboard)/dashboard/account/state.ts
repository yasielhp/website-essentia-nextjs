/**
 * The account form as one value, shared by the page and the profile form it
 * renders. Extracted so neither file owns a type the other needs.
 */

export type PageState = {
  loading: boolean;
  saving: boolean;
  error: string | null;
  firstName: string;
  lastName: string;
  phone: string;
  language: string;
  avatarUrl: string;
};

export type PageAction =
  | {
      type: "LOAD_SUCCESS";
      payload: {
        firstName: string;
        lastName: string;
        phone: string;
        language: string;
        avatarUrl: string;
      };
    }
  | { type: "SET_SAVING"; value: boolean }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "SET_FIRST_NAME"; value: string }
  | { type: "SET_LAST_NAME"; value: string }
  | { type: "SET_PHONE"; value: string }
  | { type: "SET_LANGUAGE"; value: string }
  | { type: "SET_AVATAR_URL"; value: string };

export const initialState: PageState = {
  loading: true,
  saving: false,
  error: null,
  firstName: "",
  lastName: "",
  phone: "",
  language: "en",
  avatarUrl: "",
};

export function reducer(state: PageState, action: PageAction): PageState {
  switch (action.type) {
    case "LOAD_SUCCESS":
      return { ...state, loading: false, ...action.payload };
    case "SET_SAVING":
      return { ...state, saving: action.value };
    case "SET_ERROR":
      return { ...state, error: action.error };
    case "SET_FIRST_NAME":
      return { ...state, firstName: action.value };
    case "SET_LAST_NAME":
      return { ...state, lastName: action.value };
    case "SET_PHONE":
      return { ...state, phone: action.value };
    case "SET_LANGUAGE":
      return { ...state, language: action.value };
    case "SET_AVATAR_URL":
      return { ...state, avatarUrl: action.value };
  }
}
