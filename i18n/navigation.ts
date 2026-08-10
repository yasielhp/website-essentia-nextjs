import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * Only `Link` is taken from the factory now: the language selector reads the
 * page's own `hreflang` links instead of the route pattern, and nothing else
 * needed the localized `usePathname` or `useRouter`. The rest stay available
 * from `createNavigation` for a caller that does.
 */
export const { Link } = createNavigation(routing);
