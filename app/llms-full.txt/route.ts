import { buildLlmsFullTxt } from "@/lib/llms";
import { listAllHiddenTreatments } from "@/lib/treatments/public-prices";

/**
 * `/llms-full.txt`, every treatment with its description (`app/lib/llms.ts`).
 * Served from here, like `/llms.txt`, so a treatment whose session type is
 * switched off is left out while it is off. Same five minutes, same tag.
 */
export const revalidate = 300;

export async function GET() {
  // Never throws; a read that fails hides nothing.
  const hidden = await listAllHiddenTreatments();
  return new Response(buildLlmsFullTxt(hidden), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
