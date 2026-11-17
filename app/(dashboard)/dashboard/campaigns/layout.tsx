import type { ReactNode } from "react";

/**
 * The pages here are client components, which cannot carry route segment
 * config, so it lives on this layout. The campaign form and the detail page
 * call server actions that send a WhatsApp campaign (`sendCampaignNow`,
 * `retryFailedRecipients`): they stop at 50 s, and the platform must allow
 * them that long.
 */
export const maxDuration = 60;

export default function CampaignsLayout({ children }: { children: ReactNode }) {
  return children;
}
