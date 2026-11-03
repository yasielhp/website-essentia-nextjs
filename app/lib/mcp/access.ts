/**
 * Who may use which tool of the MCP server, in one place.
 *
 * It mirrors the dashboard: an administrator can do everything, staff can run
 * the day-to-day (bookings, services, availability, the basics of a contact and
 * the blog), and a partner cannot connect an assistant at all. Keeping the
 * table apart from the tools means the rule can be read — and tested — without
 * running a server, and a tool that is not listed here cannot be registered.
 */

export type McpRole = "admin" | "staff";

const ADMIN: readonly McpRole[] = ["admin"];
const STAFF: readonly McpRole[] = ["admin", "staff"];

export const TOOL_ACCESS = {
  // Services and availability
  list_services: STAFF,
  get_availability: STAFF,
  list_session_types: STAFF,
  list_staff: STAFF,

  // Bookings
  list_bookings: STAFF,
  get_booking: STAFF,
  create_booking: STAFF,
  cancel_booking: STAFF,

  // Contacts: staff see who someone is; the money and the memberships are the administrator's
  search_contacts: STAFF,
  get_contact: STAFF,

  // Blog
  list_blog_categories: STAFF,
  create_blog_category: STAFF,
  update_blog_category: STAFF,
  list_blog_posts: STAFF,
  get_blog_post: STAFF,
  create_blog_draft: STAFF,
  update_blog_post: STAFF,
  list_blog_drafts: STAFF,

  // The business
  list_transactions: ADMIN,
  list_memberships: ADMIN,
  list_membership_plans: ADMIN,
  list_campaigns: ADMIN,
  get_campaign: ADMIN,
  list_races: ADMIN,
  list_race_registrations: ADMIN,
  list_education_sessions: ADMIN,
  list_education_enrollees: ADMIN,
} as const satisfies Record<string, readonly McpRole[]>;

export type ToolName = keyof typeof TOOL_ACCESS;

/** Whether a role is on a tool's list. Anything else — partner, client, nothing — is not. */
export function roleAllowed(
  role: string | null | undefined,
  allowed: readonly McpRole[],
): boolean {
  return (allowed as readonly string[]).includes(role ?? "");
}
