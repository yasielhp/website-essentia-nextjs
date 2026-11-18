/**
 * Addresses that moved, for `redirects()` in `next.config.ts`. Kept here, as
 * plain values with no Next import, so a test can read them.
 *
 * Messages left the sidebar and became a page of Settings. The old addresses
 * keep working for bookmarks, the links in emails already sent and the pages of
 * the dashboard open in a tab: permanent (308), the rest of the address and the
 * query (`?tab=whatsapp`) kept. Next carries the query string of a redirect over
 * by itself.
 */
export type MovedAddress = {
  source: string;
  destination: string;
  permanent: true;
};

export const dashboardMessagesRedirects: MovedAddress[] = [
  {
    source: "/dashboard/messages",
    destination: "/dashboard/settings/messages",
    permanent: true,
  },
  {
    source: "/dashboard/messages/:path*",
    destination: "/dashboard/settings/messages/:path*",
    permanent: true,
  },
];
