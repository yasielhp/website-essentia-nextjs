"use server";

import { getAdminClient } from "@/lib/insforge-admin";
import { ADMIN_ROLES, AuthError, requireRole } from "@/lib/auth-guard";

/**
 * Creates an auth account on someone else's behalf, from the dashboard.
 *
 * This must never run through the caller's own session. The browser used to
 * call `insforge.auth.signUp()` directly, which signs the *caller* in as the
 * account it just created — harmless while the SDK only held a token in
 * memory, and a real hazard now that a successful sign-up writes session
 * cookies: an administrator would create a user and silently become them.
 *
 * The admin client carries the service key and no cookie store, so the
 * caller's session is untouched. `requireRole` is what stands between this
 * endpoint and anyone on the internet — Server Actions are public HTTP.
 */
export async function createUserAccount(
  accessToken: string | null,
  email: string,
  password: string,
  name: string,
): Promise<{ userId: string | null; error: string | null }> {
  try {
    await requireRole(accessToken, ADMIN_ROLES);
  } catch (err) {
    if (err instanceof AuthError) return { userId: null, error: err.message };
    throw err;
  }

  const { data, error } = await getAdminClient().auth.signUp({
    email,
    password,
    name,
  });

  const userId = (data as { user?: { id: string } } | null)?.user?.id ?? null;

  return {
    userId,
    error: userId
      ? null
      : ((error as { message?: string } | null)?.message ??
        "Failed to create account."),
  };
}
