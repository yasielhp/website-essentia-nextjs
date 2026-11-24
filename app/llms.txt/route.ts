import { buildLlmsTxt } from "@/lib/llms";
import { listAllHiddenTreatments } from "@/lib/treatments/public-prices";

/**
 * `/llms.txt`, the short index for assistants (`app/lib/llms.ts`).
 *
 * Served from here rather than kept in `public/`: a treatment whose session
 * type is switched off in Settings is left out while it is off, and that is
 * read from the database. Rebuilt at most every five minutes, and at once when
 * Settings saves a session type (it drops the `tier-prices` tag the read is
 * kept under). Same figure as `TIER_PRICES_REVALIDATE_SECONDS`, as a literal.
 */
export const revalidate = 300;

export async function GET() {
  // Never throws; a read that fails hides nothing.
  const hidden = await listAllHiddenTreatments();
  return new Response(buildLlmsTxt(hidden), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
