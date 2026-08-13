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
};

const SECTION_KEYS: Record<string, string> = {
  blog: "sections.blog",
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
  registrations: "leaves.registrations",
  checkin: "leaves.checkin",
  enrollees: "leaves.enrollees",
  categories: "leaves.categories",
  staff: "leaves.staff",
};

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

  const meaningful = rest.filter((s) => !UUID_RE.test(s));

  if (meaningful.length === 0) {
    return [{ ...sectionCrumb, href: sectionHref }, { key: "leaves.edit" }];
  }

  const last = meaningful[meaningful.length - 1];
  return [{ ...sectionCrumb, href: sectionHref }, crumb(LEAF_KEYS, last)];
}
