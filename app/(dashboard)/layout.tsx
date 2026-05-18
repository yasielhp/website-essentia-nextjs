"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { insforge } from "@/lib/insforge";
import { UserMenu } from "@/components/dashboard/user-menu";
import { Logo } from "@/components/ui/logo";
import { FavIcon, IconSidebarLeft } from "@/components/ui/icons";
import { navLinks, navIcons } from "@/constants/nav";
import { getBreadcrumbs } from "@/utils/breadcrumbs";
import { avatarInitials } from "@/utils/avatar";
import type { Role } from "@/types";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const { replace, push } = router;
  const pathname = usePathname();
  const [role, setRole] = useState<Role>(null);
  const roleLoadingRef = useRef(true);
  const [mobileOpenAtPathname, setMobileOpenAtPathname] = useState<
    string | null
  >(null);
  const mobileOpen = mobileOpenAtPathname === pathname;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      replace("/sign-in");
      return;
    }

    async function fetchRole() {
      if (!user) return;
      const { data } = await insforge.database
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      const userRole = (data as { role: Role } | null)?.role ?? null;
      if (
        userRole !== "admin" &&
        userRole !== "staff" &&
        userRole !== "partner"
      ) {
        replace("/");
        return;
      }
      if (
        userRole === "partner" &&
        !window.location.pathname.startsWith("/dashboard/bookings/partner")
      ) {
        replace("/dashboard/bookings/partner");
        return;
      }
      setRole(userRole);
      roleLoadingRef.current = false;
    }

    void fetchRole();
  }, [user, loading, replace]);

  if (loading || role === null) {
    return (
      <div className="bg-sand-50 flex min-h-screen items-center justify-center">
        <div className="border-petroleum-700 size-8 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    );
  }

  const displayName = user?.name ?? user?.email ?? "User";
  const breadcrumbs = getBreadcrumbs(pathname);

  const visibleNavLinks =
    role === "partner"
      ? [{ label: "Bookings", href: "/dashboard/bookings/partner" }]
      : navLinks;

  function isNavActive(href: string) {
    if (href === "/dashboard") return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <div className="bg-sand-50 flex min-h-screen">
      {/* ── Desktop sidebar ────────────────────────────────── */}
      <aside
        className={`border-sand-200 sticky top-0 hidden h-screen flex-col border-r bg-white transition-all duration-200 lg:flex ${
          sidebarCollapsed ? "w-16" : "w-64"
        }`}
      >
        <div
          className={`border-sand-200 flex h-12 shrink-0 items-center border-b ${
            sidebarCollapsed ? "justify-center px-4" : "px-6"
          }`}
        >
          {sidebarCollapsed ? <FavIcon /> : <Logo />}
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          <ul className="space-y-0.5">
            {visibleNavLinks.map(({ label, href }) => {
              const active = isNavActive(href);
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
                      {navIcons[label]}
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
            aria-label="Toggle sidebar"
          >
            <IconSidebarLeft />
          </button>

          <span className="text-petroleum-400/30 font-light select-none">
            |
          </span>

          <nav className="flex min-w-0 items-center gap-1.5 text-sm">
            {breadcrumbs.map((crumb, i) => (
              <Fragment key={crumb.href ?? crumb.label}>
                {i > 0 && (
                  <span className="text-petroleum-300 shrink-0 text-xs">›</span>
                )}
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="text-petroleum-400 hover:text-petroleum-700 shrink-0 transition-colors"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-petroleum-700 truncate font-medium">
                    {crumb.label}
                  </span>
                )}
              </Fragment>
            ))}
          </nav>
        </div>

        <main className="flex-1">{children}</main>
      </div>

      {/* ── Mobile drawer ──────────────────────────────────── */}
      <div
        role="button"
        tabIndex={mobileOpen ? 0 : -1}
        className={`fixed inset-0 z-40 transition-opacity duration-300 lg:hidden ${
          mobileOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
        onClick={() => setMobileOpenAtPathname(null)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setMobileOpenAtPathname(null);
        }}
      >
        <div className="absolute inset-0 bg-black/20" />
        <aside
          className={`absolute top-0 left-0 flex h-full w-64 flex-col bg-white shadow-xl transition-transform duration-300 ease-in-out ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <div className="border-sand-200 flex h-12 items-center border-b px-6">
            <span className="font-display text-petroleum-700 text-xl">
              Essentia
            </span>
          </div>

          <nav className="flex-1 overflow-y-auto px-2 py-3">
            <ul className="space-y-0.5">
              {visibleNavLinks.map(({ label, href }) => {
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
                        {navIcons[label]}
                      </span>
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="border-sand-200 shrink-0 border-t p-3">
            <UserMenu
              displayName={displayName}
              email={user?.email ?? ""}
              role={role ?? ""}
              onSignOut={() => void signOut()}
              onEditAccount={() => push("/dashboard/account")}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
