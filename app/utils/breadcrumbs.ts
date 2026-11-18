import {
  messageListHref,
  parseMessageRoute,
} from "@/lib/messages/message-route";

const UUID_RE = /^[0-9a-f-]{36}$/i;

/**
 * A crumb carries either a message key under `dashboard.breadcrumbs` or, when
 * the path segment maps to nothing known, the raw segment as a literal label.
 * Resolving the key is the caller's job — this module stays free of any
 * translation runtime so it can be used from both server and client.
 */
export type Breadcrumb = {
  key?: string;
  label?: string;
  href?: string;
  /**
   * A message's own page: the caller names it from the catalogue ("Booking
   * confirmed · Spanish"), which needs the translations this module has not.
   */
  messageRow?: {
    channel: "email" | "whatsapp";
    key: string;
    locale: "es" | "en";
  };
};

const SECTION_KEYS: Record<string, string> = {
  blog: "sections.blog",
  campaigns: "sections.campaigns",
  bookings: "sections.bookings",
  contacts: "sections.users",
  subscriptions: "sections.subscriptions",
  staff: "sections.users",
  users: "sections.users",
  races: "sections.races",
  education: "sections.education",
  transactions: "sections.transactions",
  account: "sections.account",
  settings: "sections.settings",
};

// Sections whose canonical list URL differs from /dashboard/<section>
const SECTION_HREFS: Record<string, string> = {
  contacts: "/dashboard/users",
  staff: "/dashboard/users",
};

const LEAF_KEYS: Record<string, string> = {
  new: "leaves.new",
  partner: "leaves.partner",
  edit: "leaves.edit",
  consent: "leaves.consent",
  registrations: "leaves.registrations",
  checkin: "leaves.checkin",
  enrollees: "leaves.enrollees",
  categories: "leaves.categories",
  staff: "leaves.staff",
  segments: "leaves.segments",
};

/** Segments that are lists of their own inside a section. */
const SUB_LISTS = new Set(["segments"]);

function crumb(map: Record<string, string>, segment: string): Breadcrumb {
  const key = map[segment];
  return key ? { key } : { label: segment };
}

export function getBreadcrumbs(pathname: string): Breadcrumb[] {
  const after = pathname.replace(/^\/dashboard\/?/, "");
  if (!after) return [{ key: "sections.overview" }];

  const segments = after.split("/").filter(Boolean);
  const [section, ...rest] = segments;
  const sectionCrumb = crumb(SECTION_KEYS, section);
  const sectionHref = SECTION_HREFS[section] ?? `/dashboard/${section}`;

  if (rest.length === 0) return [sectionCrumb];

  // A message's own page lives under Settings: Settings › the message. The
  // list is a card of the settings page, so "Settings" leads back to that card.
  if (section === "settings" && rest[0] === "messages") {
    const route =
      rest.length === 4 ? parseMessageRoute(rest[1], rest[2], rest[3]) : null;
    if (route?.ok) {
      return [
        { key: "sections.settings", href: messageListHref() },
        {
          messageRow: {
            channel: route.channel,
            key: route.key,
            locale: route.locale,
          },
        },
      ];
    }
  }

  // A sub-list under a section — campaigns/segments — is its own crumb, so
  // the trail reads Campañas › Segmentos › <name> and not Campañas › <name>.
  const parents: Breadcrumb[] = [{ ...sectionCrumb, href: sectionHref }];
  let tail = rest;
  if (rest[0] && SUB_LISTS.has(rest[0])) {
    parents.push({
      key: LEAF_KEYS[rest[0]],
      href: `${sectionHref}/${rest[0]}`,
    });
    tail = rest.slice(1);
    if (tail.length === 0) {
      const own = parents.pop()!;
      return [...parents, { key: own.key }];
    }
  }

  const meaningful = tail.filter((s) => !UUID_RE.test(s));

  if (meaningful.length === 0) {
    return [...parents, { key: "leaves.edit" }];
  }

  const last = meaningful[meaningful.length - 1];
  return [...parents, crumb(LEAF_KEYS, last)];
}
