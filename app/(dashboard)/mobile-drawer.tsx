"use client";

import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { UserMenu } from "@/components/dashboard/user-menu";
import { IconSettings } from "@/components/ui/icons";

/**
 * The navigation a phone gets, behind the hamburger.
 *
 * It mirrors the sidebar rather than sharing it: the sidebar collapses to
 * icons and this one slides, and the two have never wanted the same markup.
 * What they must agree on is what is in them, which is why both take the same
 * `navLinks` and both end with Settings above the account.
 */
export function MobileDrawer({
  open,
  onClose,
  navLinks,
  navIcons,
  isNavActive,
  isAdmin,
  t,
  displayName,
  email,
  role,
  onSignOut,
  onEditAccount,
}: {
  open: boolean;
  onClose: () => void;
  navLinks: { key: string; href: string }[];
  navIcons: Record<string, React.ReactNode>;
  isNavActive: (href: string) => boolean;
  isAdmin: boolean;
  t: (key: string) => string;
  displayName: string;
  email: string;
  role: string;
  onSignOut: () => void;
  onEditAccount: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={open ? 0 : -1}
      className={`fixed inset-0 z-40 transition-opacity duration-300 lg:hidden ${
        open
          ? "pointer-events-auto opacity-100"
          : "pointer-events-none opacity-0"
      }`}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/20" />
      <aside
        className={`absolute top-0 left-0 flex h-full w-64 flex-col bg-white shadow-xl transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="border-sand-200 flex h-12 items-center border-b px-6">
          <Link href="/dashboard" className="text-petroleum-500">
            <Logo />
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          <ul className="space-y-0.5">
            {navLinks.map(({ key, href }) => {
              const active = isNavActive(href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${
                      active
                        ? "bg-petroleum-700 text-white"
                        : "text-petroleum-500 hover:bg-sand-50 hover:text-petroleum-700"
                    }`}
                  >
                    <span
                      className={active ? "text-white" : "text-petroleum-400"}
                    >
                      {navIcons[key]}
                    </span>
                    {t(`nav.${key}`)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Settings sits with the account here too. It lived only in the
          desktop sidebar, so on a phone an administrator had no way to
          reach it at all — the link is outside `navLinks`, and the drawer
          only ever rendered that list. */}
        {isAdmin && (
          <div className="shrink-0 px-2 pb-1">
            <Link
              href="/dashboard/settings"
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${
                isNavActive("/dashboard/settings")
                  ? "bg-petroleum-700 text-white"
                  : "text-petroleum-500 hover:bg-sand-50 hover:text-petroleum-700"
              }`}
            >
              <span
                className={
                  isNavActive("/dashboard/settings")
                    ? "text-white"
                    : "text-petroleum-400"
                }
              >
                <IconSettings />
              </span>
              {t("nav.settings")}
            </Link>
          </div>
        )}

        <div className="border-sand-200 shrink-0 border-t p-3">
          <UserMenu
            displayName={displayName}
            email={email}
            role={role}
            onSignOut={onSignOut}
            onEditAccount={onEditAccount}
          />
        </div>
      </aside>
    </div>
  );
}
