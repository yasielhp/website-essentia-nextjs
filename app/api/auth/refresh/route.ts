import { createRefreshAuthRouter } from "@insforge/sdk/ssr";

/**
 * The browser's refresh endpoint, on this site's own domain.
 *
 * The Insforge backend answers from `*.insforge.app`, so its refresh cookie is
 * third-party here and Safari — along with any private window — drops it. This
 * route keeps the refresh token in a cookie we own and talks to Insforge
 * server-side.
 */
export const { POST } = createRefreshAuthRouter();
