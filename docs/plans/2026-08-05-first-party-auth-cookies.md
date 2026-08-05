# First-Party Auth Cookies Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let people sign in on Safari and in private windows, by moving the Insforge session onto cookies this site owns.

**Architecture:** Today the session lives in a `refresh_token` cookie set by `8w2e5wbf.eu-central.insforge.app`. Against `essentiawellnessclub.com` that is a third-party cookie, and Safari plus Chrome incognito drop it — so the sign-in succeeds, the hard navigation into `/account` loses the in-memory access token, the refresh has nothing to send, and the page bounces back to the login. `@insforge/sdk/ssr` moves both tokens to cookies on our own domain: `insforge_refresh_token` (httpOnly, server-owned) and `insforge_access_token` (readable by scripts, short-lived). Auth mutations move to Server Actions, refresh runs through `/api/auth/refresh`, and the proxy keeps Server Components looking at fresh cookies.

**Tech Stack:** Next.js 16 App Router · `@insforge/sdk` 1.5.2 (`/ssr` and `/ssr/middleware` entrypoints) · next-intl 4 proxy

---

## Why this stays smaller than it looks

Three decisions keep the blast radius down. Confirm each holds before relying on it.

1. **`getAccessToken()` keeps its signature.** It returns a string or null; it just reads the `insforge_access_token` cookie instead of the SDK's in-memory header. All 12 call sites (`app/services/calendar.client.ts`, the dashboard pages, `booking-content.tsx`, `account/page.tsx`) stay untouched.
2. **`app/lib/auth-guard.ts` stays as it is.** It validates a bearer token against `/api/auth/sessions/current`. That contract does not change; only where the browser got the token does.
3. **`app/lib/insforge.ts` keeps exporting `insforge`.** All 61 importers keep their import. Only the files calling auth _mutations_ change, and they are five: `sign-in-form.tsx`, `sign-up-form.tsx`, `forgot-password-form.tsx`, `oauth-button.tsx`, `auth-provider.tsx`. Plus two readers to re-check: `dashboard/users/new/page.tsx` (calls `signUp`) and `dashboard/bookings/new/page.tsx` (calls `getCurrentUser`).

## Testing note

This repo has no automated tests; `bun run build` is the type check. Every task below is verified by building and by driving the real page. The decisive test for the whole plan is **a private window**, because that is the failure the user reported.

**Set up the failing case first, in Chrome:** open a private window, `chrome://settings/cookies` → "Block third-party cookies". A normal window with third-party cookies allowed is _not_ a valid test — it passes today.

---

## Task 0: Reproduce the bug

**Files:** none.

**Step 1:** Open a private window against production and sign in with a real account.

**Step 2:** Open DevTools → Network before submitting. Expected: `POST .../api/auth/refresh` answering `401`, and the page landing back on `/sign-in`.

**Step 3:** Write down what you saw. If the refresh does _not_ 401, stop — the diagnosis is wrong and the rest of this plan does not apply.

---

## Task 1: The refresh route

**Files:**

- Create: `app/api/auth/refresh/route.ts`

**Step 1: Create the route**

```typescript
import { createRefreshAuthRouter } from "@insforge/sdk/ssr";

/**
 * The browser's refresh endpoint, on this site's own domain.
 *
 * The Insforge backend answers from `*.insforge.app`, so its refresh cookie is
 * third-party here and Safari drops it. This route holds the refresh token in
 * a cookie we own and talks to Insforge server-side.
 */
export const { POST } = createRefreshAuthRouter();
```

**Step 2:** `bun run build`. Expected: compiles, and `/api/auth/refresh` appears in the route list as `ƒ`.

**Step 3:** Commit.

```bash
git add app/api/auth/refresh/route.ts
git commit -m "feat(auth): add a first-party refresh endpoint"
```

---

## Task 2: The proxy

**Files:**

- Modify: `proxy.ts:1-21`

The existing proxy is next-intl's, and its matcher **excludes `dashboard`, `account` and `api`** — exactly where the session matters. `updateSession` has to run there too, so the matcher widens and the intl middleware only runs where it did before.

**Step 1: Rewrite `proxy.ts`**

```typescript
import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@insforge/sdk/ssr/middleware";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

/** Paths next-intl must not touch: they live outside the `[locale]` tree. */
const NON_LOCALE = /^\/(dashboard|account|api)(\/|$)/;

export async function proxy(request: NextRequest) {
  const response = NON_LOCALE.test(request.nextUrl.pathname)
    ? NextResponse.next({ request })
    : intlMiddleware(request);

  response.headers.set("x-pathname", request.nextUrl.pathname);

  // Refresh before Server Components render, so they never read a stale cookie.
  await updateSession({
    requestCookies: request.cookies,
    responseCookies: response.cookies,
  });

  return response;
}

export const config = {
  matcher: ["/((?!_next|opengraph-image|twitter-image|.*\\..*).*)"],
};
```

**Step 2:** `bun run build`, then `PORT=3005 bun run start`.

**Step 3:** Check the routes the old matcher excluded still work: `/dashboard`, `/account`, `/api/mcp`, `/es/reserva`, `/booking`. Expected: same status as before this task. A 404 on any of them means the matcher change broke locale resolution — fix before moving on.

**Step 4:** Commit.

---

## Task 3: The browser and server clients

**Files:**

- Modify: `app/lib/insforge.ts`
- Create: `app/lib/insforge-server.ts`

**Step 1: Rewrite `app/lib/insforge.ts`**

```typescript
import { createBrowserClient } from "@insforge/sdk/ssr";

/**
 * The browser client.
 *
 * It reads the `insforge_access_token` cookie and refreshes through
 * `/api/auth/refresh` when that token is missing or expired. Its auth surface
 * is read-only by design — sign-in, sign-up and sign-out run on the server in
 * `app/actions/auth.ts`, because only the server can write the httpOnly
 * refresh cookie.
 */
export const insforge = createBrowserClient();
```

**Step 2:** `bun run build`. Expected: **failures** on every call to `insforge.auth.signInWithPassword` / `signUp` / `signOut` / `signInWithOAuth` / `verifyEmail` / `resetPassword`, because `createBrowserClient` does not expose them. That list is the exact work of Tasks 4–6. Write it down.

**Step 3: Create `app/lib/insforge-server.ts`**

```typescript
import { cookies } from "next/headers";
import { createServerClient } from "@insforge/sdk/ssr";

/** The per-request client for Server Components, Actions and Route Handlers. */
export async function createInsForgeServerClient() {
  return createServerClient({ cookies: await cookies() });
}
```

**Step 4:** Do not commit yet — the tree does not build. Tasks 4–6 close it.

---

## Task 4: Auth actions

**Files:**

- Create: `app/actions/auth.ts`

Note the memory on this repo: a `"use server"` file may export **only async functions**. No types, no constants — re-exporting a type from here crashes at runtime, and the build will not catch it.

**Step 1: Create the actions**

```typescript
"use server";

import { cookies } from "next/headers";
import { createAuthActions } from "@insforge/sdk/ssr";

async function actions() {
  return createAuthActions({ cookies: await cookies() });
}

export async function signInWithPassword(email: string, password: string) {
  const { data, error } = await (
    await actions()
  ).signInWithPassword({
    email,
    password,
  });
  return {
    user: data?.user ?? null,
    error: error
      ? { message: error.message, statusCode: error.statusCode }
      : null,
  };
}

export async function signUp(email: string, password: string, name: string) {
  const { data, error } = await (
    await actions()
  ).signUp({ email, password, name });
  return {
    user: data?.user ?? null,
    requireEmailVerification: data?.requireEmailVerification ?? false,
    error: error
      ? { message: error.message, statusCode: error.statusCode }
      : null,
  };
}

export async function verifyEmail(email: string, otp: string) {
  const { data, error } = await (await actions()).verifyEmail({ email, otp });
  return {
    user: data?.user ?? null,
    error: error
      ? { message: error.message, statusCode: error.statusCode }
      : null,
  };
}

export async function signOut() {
  await (await actions()).signOut();
  return { ok: true };
}
```

**Step 2:** Check the real return shapes against `node_modules/@insforge/sdk/dist/ssr.d.ts` — `SafeAuthAction` strips `accessToken`, `refreshToken` and `csrfToken`, so anything reading `data.accessToken` has to go.

**Step 3:** Commit once Task 5 builds.

---

## Task 5: The forms

**Files:**

- Modify: `app/components/auth/sign-in-form.tsx:38-70`
- Modify: `app/components/auth/sign-up-form.tsx:87-145`
- Modify: `app/components/auth/forgot-password-form.tsx:95-135`
- Modify: `app/components/auth-provider.tsx` (`signOut`)

**Step 1:** Point each form at the action instead of `insforge.auth.*`. The shapes are the same; the error object is now `{ message, statusCode }`.

**Step 2:** `sign-up-form.tsx:106` branches on `data?.accessToken`. That field no longer comes back. Branch on `requireEmailVerification` instead: false means the session is live.

**Step 3:** `forgot-password-form.tsx` uses `exchangeResetPasswordToken` and `resetPassword`, which `createAuthActions` does **not** wrap. Check `ssr.d.ts` before writing: if they are absent, that flow keeps using a route handler with `createServerClient`, or stays on the current client path — it ends at `/sign-in` and creates no session, so it is the least urgent piece. Do not leave it half-migrated.

**Step 4:** `bun run build`. Expected: clean.

**Step 5:** Sign in end to end in a **private window**. Expected: lands on `/account` and stays there through a reload. This is the moment the bug is fixed or not.

**Step 6:** Commit.

---

## Task 6: OAuth

**Files:**

- Modify: `app/components/auth/oauth-button.tsx`
- Create: `app/api/auth/callback/route.ts`
- Create: the `initiateOAuth` action in `app/actions/auth.ts`

Follow `~/.claude/skills/insforge/auth/ssr-integration.md` §"OAuth In Next.js" — server-side initiation with `skipBrowserRedirect: true`, the code verifier in a short-lived httpOnly cookie, and the exchange in the callback route.

**⚠ This task needs a change outside the codebase.** `redirectTo` becomes `https://www.essentiawellnessclub.com/api/auth/callback`, and that URL has to be on the allowed redirect list in the Insforge project config (`npx @insforge/cli config export` to see the current list). Until it is, Google sign-in fails. Confirm the change is made before deploying this task.

**Step 1–4:** Write the action, write the callback, repoint the button, build.

**Step 5:** Test Google sign-in in a private window against a preview deployment, not production.

**Step 6:** Commit.

---

## Task 7: Retire the session flag

**Files:**

- Modify: `app/components/auth-provider.tsx`
- Delete: `app/lib/auth-session-flag.ts`
- Modify: `app/components/auth/oauth-button.tsx`, `app/components/auth/sign-up-form.tsx` (the `markSession()` calls)

`essentia.session` in `localStorage` existed to guess whether a session was worth refreshing, because the page could not see the httpOnly cookie. Now `insforge_access_token` is readable, so the guess becomes a fact — and it is a better one, since it cannot drift from the session it describes.

**Step 1:** Replace `hasSession()` with a read of the `insforge_access_token` cookie.

**Step 2:** Delete the flag module and its three call sites.

**Step 3:** Confirm the win that flag bought is still there: load the home in a private window and check the Network tab shows **no** request to `insforge.app` and none to `/api/auth/refresh`. A visitor who never signed in must still cost nothing.

**Step 4:** Commit.

---

## Task 8: Sign-up from the dashboard

**Files:**

- Modify: `app/(dashboard)/dashboard/users/new/page.tsx:209`

**This is the trap in this migration.** That page calls `insforge.auth.signUp()` to create _another_ person's account. With cookie-writing auth actions, that call would overwrite the admin's own cookies with the new user's session — the admin creates a user and is silently logged in as them.

**Step 1:** Confirm the risk by reading what the page does with the result today.

**Step 2:** Route it through a server-side path that does **not** touch cookies: `getAdminClient()` in `app/lib/insforge-admin.ts`, behind `requireRole(ADMIN_ROLES)` from `app/lib/auth-guard.ts`.

**Step 3:** Create a user from the dashboard and confirm you are still yourself afterwards — reload and check the header still shows the admin.

**Step 4:** Commit.

---

## Task 9: Update the record

**Files:**

- Modify: `app/lib/auth-guard.ts:5-17` (the comment describing the old cookie scoping)
- Modify: `CLAUDE.md` (the Database section, which describes the two client modes)

**Step 1:** Rewrite both to describe first-party cookies. The auth-guard comment currently explains _why_ tokens travel explicitly; that reasoning changes.

**Step 2:** Commit.

---

## Rollout

The failure mode is "nobody can log in", so do not merge and deploy in one move.

1. Deploy the branch as a preview and sign in there, in a private window, on Safari, and on Chrome with third-party cookies allowed — all three.
2. Check an existing signed-in session on production is not broken by the cookie names changing. People holding the old session will be signed out once; that is acceptable and should be expected, not a surprise.
3. Merge, deploy, then sign in on production in a private window before calling it done.
