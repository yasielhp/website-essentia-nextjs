import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * `Link` and `redirect` are taken from the factory: the language selector reads
 * the page's own `hreflang` links instead of the route pattern, and nothing
 * else needed the localized `usePathname` or `useRouter`. The rest stay
 * available from `createNavigation` for a caller that does. `redirect` is the
 * localized one on purpose — `next/navigation`'s does not know that `/contact`
 * is `/es/contacto`.
 */
export const { Link, redirect } = createNavigation(routing);
