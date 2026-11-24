import { cookies } from "next/headers";
import { clientIp } from "@/lib/auth-security";
import {
  CLAIM_COOKIE,
  CLAIM_COOKIE_OPTIONS,
  withClaim,
} from "@/lib/bookings/draft-claim";

/**
 * Who is on the other side of a public booking action: her claims on the
 * bookings this browser started (`draft-claim.ts`) and her address, for the
 * rate limits. Read from the request; outside one (a test, a script) it is
 * nobody's: no claims, no address.
 */
export type Visitor = { claims: string | null; ip: string | null };

export async function readVisitor(): Promise<Visitor> {
  let claims: string | null = null;
  let ip: string | null = null;
  try {
    claims = (await cookies()).get(CLAIM_COOKIE)?.value ?? null;
  } catch {
    // Not in a request.
  }
  try {
    ip = await clientIp();
  } catch {
    // Not in a request.
  }
  return { claims, ip };
}

/** Gives this browser the claim on a booking the server just wrote for it. */
export async function rememberClaim(
  visitor: Visitor,
  bookingId: string,
): Promise<void> {
  try {
    (await cookies()).set(
      CLAIM_COOKIE,
      withClaim(visitor.claims, bookingId),
      CLAIM_COOKIE_OPTIONS,
    );
  } catch {
    // Not in a request: nothing to remember it in.
  }
}
