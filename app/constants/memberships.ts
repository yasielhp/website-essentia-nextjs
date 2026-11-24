/**
 * THE switch for selling memberships. Off (the owner, 2026-11-24): memberships
 * are not launched, `memberships` has no row, and nothing may start a payment
 * for one. `/api/checkout/membership-session` then answers 404
 * `{ error: "memberships_not_on_sale" }` before it reads a plan or builds a
 * Redsys form, so a direct call cannot start one either. The page it returns to
 * (`/experiences/memberships`) stays reachable (a "Coming soon"), so a payment
 * begun before the switch was turned off still lands somewhere.
 *
 * Turning it on is the checkout's half of the launch only: the page must get
 * its plans back (and leave `UNLAUNCHED_ROUTES`), and the Redsys webhook does
 * not record a membership payment today. See CLAUDE.md, "Memberships".
 */
export const MEMBERSHIPS_ON_SALE: boolean = false;
