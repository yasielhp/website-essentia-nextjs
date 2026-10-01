import { redirect } from "../../../../../i18n/navigation";

/**
 * Booking from the public site is off while the studio is between premises:
 * only staff and partners book, from the dashboard. The page redirects rather
 * than 404s because the route is linked from elsewhere on the web and from
 * emails already in people's inboxes; `/booking/confirmation`, `/requested`
 * and `/cancel` stay live for appointments made before the change.
 *
 * To bring it back: restore `<BookingSection />`, put `/booking` back in
 * `app/lib/sitemap-data.ts`, and re-enable the CTAs that now render disabled.
 */
export default async function BookPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect({ href: "/contact", locale });
}
