"use client";

/**
 * A local note of whether this browser is signed in.
 *
 * The Insforge session lives in an httpOnly cookie, which the page cannot
 * read. Calling `getCurrentUser()` on every load therefore meant asking the
 * server to refresh a session that most visitors do not have, and the answer —
 * `401 (Unauthorized)` on `/api/auth/refresh` — was logged as an error on
 * every public page.
 *
 * This flag is written next to the cookie so the page can skip the call when
 * nobody has signed in. It is a hint, not the session: the cookie stays
 * authoritative, and a stale flag costs one refresh that clears it again.
 */

const KEY = "essentia.session";

export function markSession() {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // Private mode or a blocked store — the flag is optional.
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear if the store is unavailable.
  }
}

export function hasSession() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    // Without a store, assume a session so the refresh still runs and the
    // signed-in path keeps working.
    return true;
  }
}
