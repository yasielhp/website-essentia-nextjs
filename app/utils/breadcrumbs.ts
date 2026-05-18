const UUID_RE = /^[0-9a-f-]{36}$/i;

const SECTION_LABELS: Record<string, string> = {
  blog: "Blog",
  bookings: "Bookings",
  contacts: "Users",
  members: "Members",
  staff: "Users",
  users: "Users",
  races: "Races",
  education: "Education",
  transactions: "Transactions",
  account: "Edit account",
  settings: "Settings",
};

// Sections whose canonical list URL differs from /dashboard/<section>
const SECTION_HREFS: Record<string, string> = {
  contacts: "/dashboard/users",
  staff: "/dashboard/users",
};

const LEAF_LABELS: Record<string, string> = {
  new: "New",
  partner: "Partner Booking",
  edit: "Edit",
  registrations: "Registrations",
  checkin: "Check-in",
  enrollees: "Enrollees",
  categories: "Categorías",
};

export function getBreadcrumbs(
  pathname: string,
): { label: string; href?: string }[] {
  const after = pathname.replace(/^\/dashboard\/?/, "");
  if (!after) return [{ label: "Overview" }];

  const segments = after.split("/").filter(Boolean);
  const [section, ...rest] = segments;
  const sectionLabel = SECTION_LABELS[section] ?? section;
  const sectionHref = SECTION_HREFS[section] ?? `/dashboard/${section}`;

  if (rest.length === 0) return [{ label: sectionLabel }];

  const meaningful = rest.filter((s) => !UUID_RE.test(s));

  if (meaningful.length === 0) {
    return [{ label: sectionLabel, href: sectionHref }, { label: "Edit" }];
  }

  const last = meaningful[meaningful.length - 1];
  return [
    { label: sectionLabel, href: sectionHref },
    { label: LEAF_LABELS[last] ?? last },
  ];
}
