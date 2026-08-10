import type { Contact, Enrollee, Session } from "./types";

/**
 * Who is on this session, and everything the screen is waiting on.
 *
 * Apart from the page so the hook that fetches can dispatch without importing
 * the screen that draws the result.
 */
export type State = {
  session: Session | null;
  enrollees: Enrollee[];
  contacts: Contact[];
  loading: boolean;
  notFound: boolean;
  contactsLoading: boolean;
  removingId: string | null;
  addingId: string | null;
  removeOpen: string | null;
  addOpen: boolean;
  search: string;
};

export type Action =
  | { type: "LOAD_START" }
  | { type: "NOT_FOUND" }
  | { type: "LOAD_SUCCESS"; session: Session }
  | { type: "SET_ENROLLEES"; enrollees: Enrollee[] }
  | { type: "CONTACTS_LOADING" }
  | { type: "OPEN_ADD"; contacts: Contact[] }
  | { type: "CLOSE_ADD" }
  | { type: "SET_SEARCH"; search: string }
  | { type: "SET_REMOVE_OPEN"; id: string | null }
  | { type: "REMOVING_START"; id: string }
  | { type: "REMOVING_DONE" }
  | { type: "ADDING_START"; id: string }
  | { type: "ADDING_DONE" };

export const initialState: State = {
  session: null,
  enrollees: [],
  contacts: [],
  loading: true,
  notFound: false,
  contactsLoading: false,
  removingId: null,
  addingId: null,
  removeOpen: null,
  addOpen: false,
  search: "",
};

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "LOAD_START":
      return { ...state, loading: true, notFound: false };
    case "NOT_FOUND":
      return { ...state, loading: false, notFound: true };
    case "LOAD_SUCCESS":
      return { ...state, loading: false, session: action.session };
    case "SET_ENROLLEES":
      return { ...state, enrollees: action.enrollees };
    case "CONTACTS_LOADING":
      return { ...state, contactsLoading: true };
    case "OPEN_ADD":
      return {
        ...state,
        addOpen: true,
        contactsLoading: false,
        contacts: action.contacts,
        search: "",
      };
    case "CLOSE_ADD":
      return { ...state, addOpen: false, search: "" };
    case "SET_SEARCH":
      return { ...state, search: action.search };
    case "SET_REMOVE_OPEN":
      return { ...state, removeOpen: action.id };
    case "REMOVING_START":
      return { ...state, removingId: action.id };
    case "REMOVING_DONE":
      return { ...state, removingId: null, removeOpen: null };
    case "ADDING_START":
      return { ...state, addingId: action.id };
    case "ADDING_DONE":
      return { ...state, addingId: null, addOpen: false };
    default:
      return state;
  }
}
