import { z } from "zod";
import { ADMIN_ROLES, AuthError, requireRole } from "@/lib/auth-guard";
import { getAdminClient } from "@/lib/insforge-admin";
import type {
  SessionTypeInput,
  SessionTypeSaveError,
  SessionTypeSaveResult,
} from "@/types/settings";

/**
 * Saving a session type (`service_tiers`): what it lasts, what it costs in
 * three places, the colour it wears on the calendar, whether it is on sale and
 * who performs it. It is what `saveSessionType` runs.
 *
 * SERVER ONLY, and deliberately not a `"use server"` module. The action is a
 * thin door onto this, and the reason it is apart is `deadlineMs`: a test must
 * be able to shorten the deadline, but every argument of an action comes from
 * the browser, so it cannot be one of the action's.
 *
 * THE ONLY WRITER OF THE TABLE. A session type's price is what the booking
 * flow charges, what the site prints and what the agent tools answer with, and
 * it used to be written from the browser, on a table that anybody holding the
 * public key could write to. Now the write is here, with the service key,
 * after three checks:
 *
 *  - WHO: an administrator, as the Settings screen is for. Asked of the server,
 *    never taken from what the browser says about itself.
 *  - WHAT: the fields of the form and no other key (`sessionTypeInput` is
 *    strict). The name, the service, the position and the picture of a session
 *    type are not edited from that form, so they cannot be sent through it.
 *  - WHICH: a uuid, and a row that exists.
 *
 * A test (`app/actions/session-types.test.ts`) reads the source of the whole
 * app and fails if anything else writes the table.
 */

/** Every step shares this much time; past it the answer is `timeout`. */
export const SESSION_TYPE_SAVE_DEADLINE_MS = 8_000;

/** A price in euros: not negative, not absurd, and in whole cents. */
const price = z
  .number()
  .min(0)
  .max(100_000)
  .refine((euros) => Math.abs(Math.round(euros * 100) - euros * 100) < 1e-6);

/**
 * The form of Settings, and nothing else. `z.number()` already refuses NaN,
 * the infinities and a number sent as text. An unknown key is a refusal of the
 * whole save, not a key quietly dropped.
 */
const sessionTypeInput = z.strictObject({
  // A whole number of minutes, up to a day. Empty is allowed: a session type
  // can have no length set, and its card then shows none.
  duration_minutes: z.number().int().min(1).max(1_440).nullable(),
  price_eur: price.nullable(),
  price_center_eur: price.nullable(),
  price_suite_eur: price.nullable(),
  // What the colour picker gives. It is printed into styles, so it is a hex
  // colour or it is nothing.
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable(),
  active: z.boolean(),
  staffIds: z
    .array(z.uuid())
    .max(200)
    .refine((ids) => new Set(ids).size === ids.length)
    .nullable(),
}) satisfies z.ZodType<SessionTypeInput>;

/** Postgres' code for a unique index: here, `service_tiers_color_unique`. */
const UNIQUE_VIOLATION = "23505";

const TIMEOUT = Symbol("timeout");

/**
 * One clock for the whole save. `within` answers with the work, or with
 * `TIMEOUT` when the clock runs out first; it never rejects, so a step left
 * behind at the deadline cannot become an unhandled rejection later.
 */
function clock(ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const up = new Promise<typeof TIMEOUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMEOUT), ms);
  });
  return {
    within<T>(
      work: PromiseLike<T>,
    ): Promise<{ value: T } | { thrown: unknown } | typeof TIMEOUT> {
      const settled = Promise.resolve(work).then(
        (value) => ({ value }),
        (thrown: unknown) => ({ thrown }),
      );
      return Promise.race([settled, up]);
    },
    stop: () => clearTimeout(timer),
  };
}

type DbAnswer = { data: unknown; error: unknown };

/** What the action does with the answer: whether a write may have landed. */
export type SessionTypeSaveOutcome = {
  reply: SessionTypeSaveResult;
  /**
   * True when the session type was written, or its write was begun and nobody
   * knows how it ended. The site's prices are dropped then, to be safe.
   */
  written: boolean;
};

const refused = (
  error: SessionTypeSaveError,
  written = false,
): SessionTypeSaveOutcome => ({ reply: { ok: false, error }, written });

/**
 * Never throws, and always answers within `deadlineMs`. When the time is up it
 * answers `timeout` and BEGINS nothing more; a write already on its way to the
 * database is not called back, which is why `timeout` means "it may or may not
 * have been saved" and the screen says so.
 *
 * The staff are written new ones first, removals last, so a session type is
 * never left with nobody in the middle of a save (the booking form would
 * offer no professional for it). A save cut short between the two leaves the
 * people who were removed still assigned, which the next save puts right.
 */
export async function saveSessionTypeCore(
  accessToken: string | null,
  tierId: unknown,
  input: unknown,
  { deadlineMs = SESSION_TYPE_SAVE_DEADLINE_MS }: { deadlineMs?: number } = {},
): Promise<SessionTypeSaveOutcome> {
  const time = clock(deadlineMs);
  let written = false;
  const late = (step: string): SessionTypeSaveOutcome => {
    console.error(`[session-types] no answer in time at: ${step}`);
    return refused("timeout", written);
  };
  const failed = (step: string, detail: unknown) => {
    // The database's own text names columns and constraints: it stays here.
    console.error(`[session-types] could not ${step}:`, detail);
  };

  try {
    const role = await time.within(requireRole(accessToken, ADMIN_ROLES));
    if (role === TIMEOUT) return late("the session check");
    if ("thrown" in role) {
      if (role.thrown instanceof AuthError) {
        return refused(
          role.thrown.status === 403 ? "forbidden" : "unauthenticated",
        );
      }
      failed("check the session", role.thrown);
      return refused("failed");
    }

    const id = z.uuid().safeParse(tierId);
    const form = sessionTypeInput.safeParse(input);
    if (!id.success || !form.success) return refused("invalid");

    const { staffIds, ...fields } = form.data;
    const db = getAdminClient().database;

    // From here on the write is on its way: if nobody answers, it may land.
    written = true;
    const saved = await time.within<DbAnswer>(
      db.from("service_tiers").update(fields).eq("id", id.data).select("id"),
    );
    if (saved === TIMEOUT) return late("the session type");
    if ("thrown" in saved || saved.value.error) {
      written = false;
      const error = "thrown" in saved ? saved.thrown : saved.value.error;
      failed("save the session type", error);
      return refused(
        (error as { code?: string } | null)?.code === UNIQUE_VIOLATION
          ? "colorTaken"
          : "failed",
      );
    }
    if (((saved.value.data ?? []) as unknown[]).length === 0) {
      written = false;
      return refused("notFound");
    }

    // `null` is "leave them as they are": the form never got to read them.
    if (staffIds === null) return { reply: { ok: true }, written };

    const current = await time.within<DbAnswer>(
      db.from("staff_tiers").select("staff_id").eq("tier_id", id.data),
    );
    if (current === TIMEOUT) return late("reading the staff");
    if ("thrown" in current || current.value.error) {
      failed(
        "read the staff of the session type",
        "thrown" in current ? current.thrown : current.value.error,
      );
      return refused("staff", written);
    }

    if (staffIds.length > 0) {
      const assigned = await time.within<DbAnswer>(
        db.from("staff_tiers").upsert(
          // The position in the list is the position in the booking form.
          staffIds.map((staff_id, index) => ({
            staff_id,
            tier_id: id.data,
            sort_order: index,
          })),
          { onConflict: "staff_id,tier_id" },
        ),
      );
      if (assigned === TIMEOUT) return late("assigning the staff");
      if ("thrown" in assigned || assigned.value.error) {
        failed(
          "assign the staff of the session type",
          "thrown" in assigned ? assigned.thrown : assigned.value.error,
        );
        return refused("staff", written);
      }
    }

    const wanted = new Set(staffIds);
    const gone = ((current.value.data ?? []) as { staff_id: string }[])
      .map((row) => row.staff_id)
      .filter((staffId) => !wanted.has(staffId));
    if (gone.length > 0) {
      const removed = await time.within<DbAnswer>(
        db
          .from("staff_tiers")
          .delete()
          .eq("tier_id", id.data)
          .in("staff_id", gone),
      );
      if (removed === TIMEOUT) return late("unassigning the staff");
      if ("thrown" in removed || removed.value.error) {
        failed(
          "unassign the staff of the session type",
          "thrown" in removed ? removed.thrown : removed.value.error,
        );
        return refused("staff", written);
      }
    }

    return { reply: { ok: true }, written };
  } catch (err) {
    failed("save the session type", err);
    return refused("failed", written);
  } finally {
    time.stop();
  }
}
