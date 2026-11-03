"use client";

import { Fragment, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { UserMenu } from "@/components/dashboard/user-menu";
import { Logo } from "@/components/ui/logo";
import { FavIcon, IconSidebarLeft } from "@/components/ui/icons";
import { navLinks, navIcons } from "@/constants/nav";
import { getBreadcrumbs, type Breadcrumb } from "@/utils/breadcrumbs";
import { avatarInitials } from "@/utils/avatar";
import { RoleProvider, useRole } from "@/context/role-context";
import {
  BreadcrumbProvider,
  useBreadcrumbContext,
} from "@/context/breadcrumb-context";
import type { Role } from "@/types";
import { MobileDrawer } from "./mobile-drawer";

/** What staff and partners see: the two screens their role can act on. */
const restrictedNavLinks = [
  { key: "overview", href: "/dashboard" },
  { key: "bookings", href: "/dashboard/bookings" },
];

function DashboardInner({ children }: { children: React.ReactNode }) {
  const t = useTranslations("dashboard");
  const { user, loading: authLoading, signOut } = useAuth();
  const { role, loading: roleLoading } = useRole();
  const { replace, push } = useRouter();
  const pathname = usePathname();
  const [mobileOpenAtPathname, setMobileOpenAtPathname] = useState<
    string | null
  >(null);
  const mobileOpen = mobileOpenAtPathname === pathname;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      replace("/sign-in");
    }
  }, [user, authLoading, replace]);

  useEffect(() => {
    if (authLoading || roleLoading) return;
    if (
      role !== null &&
      role !== "admin" &&
      role !== "staff" &&
      role !== "partner"
    ) {
      replace("/");
    }
  }, [role, roleLoading, authLoading, replace]);

  const { dynamicLabel } = useBreadcrumbContext();

  if (authLoading || roleLoading || role === null) {
    return (
      <div className="bg-sand-50 flex min-h-screen items-center justify-center">
        <div className="border-petroleum-700 size-8 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    );
  }

  const displayName = user?.name ?? user?.email ?? t("shell.fallbackUser");
  const crumbLabel = (crumb: Breadcrumb) =>
    crumb.key ? t(`breadcrumbs.${crumb.key}`) : (crumb.label ?? "");
  const UUID_RE = /^[0-9a-f-]{36}$/i;
  const rawCrumbs = getBreadcrumbs(pathname);
  const segments = pathname
    .replace(/^\/dashboard\/?/, "")
    .split("/")
    .filter(Boolean);
  const hasUUID = segments.some((s) => UUID_RE.test(s));
  // A page under a record — `.../<id>/edit`, `.../<id>/consent` — keeps the
  // record's name as a crumb that leads back to it, and ends on its own name.
  const lastSegment = segments[segments.length - 1];
  const leafKey =
    lastSegment === "edit"
      ? "leaves.edit"
      : lastSegment === "consent"
        ? "leaves.consent"
        : null;
  // Everything before the last crumb stays (a section, or a section and its
  // sub-list); the record's own name replaces the generic leaf.
  const parents = rawCrumbs.slice(0, -1);
  // `.../<id>/consent/edit` is two levels under the record: its name leads to
  // the file, "Consent" leads to the consent, and the trail ends on "Edit".
  const underConsent =
    segments.length >= 2 &&
    segments[segments.length - 1] === "edit" &&
    segments[segments.length - 2] === "consent";
  const breadcrumbs =
    hasUUID && dynamicLabel && underConsent
      ? [
          ...parents,
          {
            label: dynamicLabel,
            href: pathname.replace(/\/consent\/edit$/, ""),
          },
          {
            key: "leaves.consent",
            href: pathname.replace(/\/edit$/, ""),
          },
          { key: "leaves.edit" },
        ]
      : hasUUID && dynamicLabel
        ? leafKey
          ? [
              ...parents,
              {
                label: dynamicLabel,
                href: pathname.replace(new RegExp(`/${lastSegment}$`), ""),
              },
              { key: leafKey },
            ]
          : [...parents, { label: dynamicLabel }]
        : rawCrumbs;

  const visibleNavLinks =
    (role as Role) === "partner" || (role as Role) === "staff"
      ? restrictedNavLinks
      : navLinks;

  function isNavActive(href: string) {
    if (href === "/dashboard") return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <div className="bg-sand-50 flex min-h-screen">
      {/* ── Desktop sidebar ────────────────────────────────── */}
      <aside
        className={`border-sand-200 sticky top-0 hidden h-screen flex-col border-r bg-white transition-[width] duration-200 lg:flex ${
          sidebarCollapsed ? "w-16" : "w-64"
        }`}
      >
        <div
          className={`border-sand-200 flex h-12 shrink-0 items-center border-b ${
            sidebarCollapsed ? "justify-center px-4" : "px-6"
          }`}
        >
          <Link href="/dashboard">
            {sidebarCollapsed ? <FavIcon className="size-7" /> : <Logo />}
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          <ul className="space-y-0.5">
            {visibleNavLinks.map(({ key, href }) => {
              const active = isNavActive(href);
              const label = t(`nav.${key}`);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    title={sidebarCollapsed ? label : undefined}
                    className={`flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${
                      sidebarCollapsed ? "justify-center" : "gap-3"
                    } ${
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
                    {!sidebarCollapsed && label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-sand-200 shrink-0 border-t p-3">
          {sidebarCollapsed ? (
            <button
              onClick={() => push("/dashboard/account")}
              title={displayName}
              className="bg-petroleum-700 mx-auto flex size-8 items-center justify-center rounded-full"
            >
              <span className="text-xs font-semibold text-white">
                {avatarInitials(displayName)}
              </span>
            </button>
          ) : (
            <UserMenu
              displayName={displayName}
              email={user?.email ?? ""}
              role={role ?? ""}
              onSignOut={() => void signOut()}
              onEditAccount={() => push("/dashboard/account")}
              onSettings={
                role === "admin" ? () => push("/dashboard/settings") : undefined
              }
            />
          )}
        </div>
      </aside>

      {/* ── Right column: top bar + content ───────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-sand-200 sticky top-0 z-30 flex h-12 shrink-0 items-center gap-3 border-b bg-white px-4">
          <button
            onClick={() => {
              if (typeof window !== "undefined" && window.innerWidth >= 1024) {
                setSidebarCollapsed((v) => !v);
              } else {
                setMobileOpenAtPathname((prev) =>
                  prev === pathname ? null : pathname,
                );
              }
            }}
            className="text-petroleum-500 hover:bg-sand-100 hover:text-petroleum-700 flex items-center justify-center rounded-lg p-1.5 transition-colors"
            aria-label={t("shell.toggleSidebar")}
          >
            <IconSidebarLeft />
          </button>

          <span className="text-petroleum-400/30 font-light select-none">
            |
          </span>

          <nav className="flex min-w-0 items-center gap-1.5 text-sm">
            {breadcrumbs.map((crumb, i) => (
              <Fragment key={crumb.href ?? crumb.key ?? crumb.label}>
                {i > 0 && (
                  <span className="text-petroleum-300 shrink-0 text-xs">›</span>
                )}
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="text-petroleum-400 hover:text-petroleum-700 shrink-0 transition-colors"
                  >
                    {crumbLabel(crumb)}
                  </Link>
                ) : (
                  <span className="text-petroleum-700 truncate font-medium">
                    {crumbLabel(crumb)}
                  </span>
                )}
              </Fragment>
            ))}
          </nav>
        </div>

        <main className="flex-1">{children}</main>
      </div>

      {/* ── Mobile drawer ──────────────────────────────────── */}
      <MobileDrawer
        open={mobileOpen}
        onClose={() => setMobileOpenAtPathname(null)}
        navLinks={visibleNavLinks}
        navIcons={navIcons}
        isNavActive={isNavActive}
        t={t}
        displayName={displayName}
        email={user?.email ?? ""}
        role={role ?? ""}
        onSignOut={() => void signOut()}
        onEditAccount={() => push("/dashboard/account")}
        onSettings={
          role === "admin" ? () => push("/dashboard/settings") : undefined
        }
      />
    </div>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <RoleProvider>
      <BreadcrumbProvider>
        <DashboardInner>{children}</DashboardInner>
      </BreadcrumbProvider>
    </RoleProvider>
  );
}
