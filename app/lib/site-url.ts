import { contact } from "@/constants/contact";

/**
 * The public origin, and the base every relative metadata URL resolves against.
 *
 * `NEXT_PUBLIC_APP_URL` is typed by hand into a deployment dashboard, so it is
 * checked rather than trusted: `new URL()` throws on a malformed value, and
 * from here that would fail the render of every page on the site.
 *
 * It lives in its own module because there is no root layout any more — the
 * site, the account area and the dashboard are three separate trees, and each
 * needs the same base. Without it Next resolves social images against
 * `http://localhost:3000`, which is what it had been doing for two of them.
 */
const fallbackUrl = `https://${contact.domain}`;
const configuredUrl = process.env.NEXT_PUBLIC_APP_URL;

export const siteUrl =
  configuredUrl && URL.canParse(configuredUrl) ? configuredUrl : fallbackUrl;

/** Built once, with the published domain as its base so it cannot throw. */
export const metadataBase = new URL(siteUrl, fallbackUrl);
