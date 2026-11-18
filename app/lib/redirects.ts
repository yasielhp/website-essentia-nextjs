/**
 * Addresses that moved, for `redirects()` in `next.config.ts`. Kept here, as
 * plain values with no Next import (and no `@/` alias, which the config cannot
 * resolve), so a test can read them.
 *
 * Messages left the sidebar and became cards of Settings: the list of automatic
 * messages and the WhatsApp templates are two cards of `/dashboard/settings`,
 * found by their anchor, and each message has a page of its own under
 * `/dashboard/settings/messages`. The old addresses keep working for bookmarks,
 * links in emails already sent and pages open in a tab: permanent (308), the
 * tail of a message's address kept. A destination with a `#` is kept whole in
 * the Location header (Next's own router does not touch the hash), and the
 * query string travels along (`?tab=whatsapp` stays, harmless).
 *
 * The order matters: the first rule that matches wins, so the one that asks for
 * a query comes before the plain one.
 */
export type MovedAddress = {
  source: string;
  destination: string;
  permanent: true;
  has?: { type: "query"; key: string; value: string }[];
};

export const dashboardMessagesRedirects: MovedAddress[] = [
  // The old WhatsApp tab: the templates card.
  {
    source: "/dashboard/messages",
    has: [{ type: "query", key: "tab", value: "whatsapp" }],
    destination: "/dashboard/settings#settings-whatsapp-templates",
    permanent: true,
  },
  // The old list (the emails tab, and anything else): the automatic messages card.
  {
    source: "/dashboard/messages",
    destination: "/dashboard/settings#settings-messages",
    permanent: true,
  },
  // A message's own page.
  {
    source: "/dashboard/messages/:path*",
    destination: "/dashboard/settings/messages/:path*",
    permanent: true,
  },
];
