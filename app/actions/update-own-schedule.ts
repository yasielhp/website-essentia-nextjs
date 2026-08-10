"use server";

import { getAdminClient } from "@/lib/insforge-admin";
import { AuthError, authenticate } from "@/lib/auth-guard";
import type { WeeklySchedule } from "@/types/schedule";

/**
 * A member of staff setting their own working hours.
 *
 * Separate from `updateUserProfile`, which administers somebody else and asks
 * for an admin. The check here is not "are you an admin" but "is this you":
 * the row written is the caller's own, taken from the token rather than from
 * anything the browser sent, so a staff member cannot widen — or close —
 * another professional's week by editing the request.
 *
 * Only the two schedule columns are touched. A Server Action is a public
 * endpoint, and this one must not become a way to grant yourself a role.
 */
export async function updateOwnSchedule(
  accessToken: string | null,
  input: { schedule: WeeklySchedule; slotIntervalMinutes: number },
): Promise<{ error: string | null }> {
  try {
    const { userId, role } = await authenticate(accessToken);

    // Only staff hold a schedule; for anybody else there is nothing to set.
    if (role !== "staff") {
      throw new AuthError("Only staff hold a working schedule", 403);
    }

    const interval = Math.round(input.slotIntervalMinutes);
    if (!Number.isFinite(interval) || interval < 5 || interval > 240) {
      return { error: "The slot interval must be between 5 and 240 minutes." };
    }

    const { error } = await getAdminClient()
      .database.from("profiles")
      .update({
        schedule: input.schedule,
        slot_interval_minutes: interval,
      })
      .eq("id", userId);

    if (error) {
      return {
        error:
          (error as { message?: string })?.message ??
          "The schedule could not be saved.",
      };
    }

    return { error: null };
  } catch (err) {
    if (err instanceof AuthError) return { error: err.message };
    throw err;
  }
}
