"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { insforge } from "@/lib/insforge";

type Role = "admin" | "staff" | "member" | "contact" | null;

const navLinks = [
  { label: "Overview", href: "/dashboard" },
  { label: "Bookings", href: "/dashboard/bookings" },
  { label: "Contacts", href: "/dashboard/contacts" },
  { label: "Staff", href: "/dashboard/staff" },
  { label: "Races", href: "/dashboard/races" },
  { label: "Education", href: "/dashboard/education" },
];

// ─── Breadcrumbs ──────────────────────────────────────────────

const UUID_RE = /^[0-9a-f-]{36}$/i;

const SECTION_LABELS: Record<string, string> = {
  bookings: "Bookings",
  contacts: "Contacts",
  staff: "Staff",
  races: "Races",
  education: "Education",
  account: "My account",
};

const LEAF_LABELS: Record<string, string> = {
  new: "New",
  edit: "Edit",
  registrations: "Registrations",
  enrollees: "Enrollees",
};

function getBreadcrumbs(pathname: string): { label: string; href?: string }[] {
  const after = pathname.replace(/^\/dashboard\/?/, "");
  if (!after) return [{ label: "Overview" }];

  const segments = after.split("/").filter(Boolean);
  const [section, ...rest] = segments;
  const sectionLabel = SECTION_LABELS[section] ?? section;
  const sectionHref = `/dashboard/${section}`;

  if (rest.length === 0) return [{ label: sectionLabel }];

  const meaningful = rest.filter((s) => !UUID_RE.test(s));

  if (meaningful.length === 0) {
    return [{ label: sectionLabel, href: sectionHref }, { label: "Edit" }];
  }

  const last = meaningful[meaningful.length - 1];
  return [
    { label: sectionLabel, href: sectionHref },
    { label: LEAF_LABELS[last] ?? last },
  ];
}

// ─── Icons ────────────────────────────────────────────────────

function IconSidebarLeft() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect
        x="2"
        y="3"
        width="20"
        height="18"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M8 3v18" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconGrid() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="3"
        y="3"
        width="7"
        height="7"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="14"
        y="3"
        width="7"
        height="7"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="3"
        y="14"
        width="7"
        height="7"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="14"
        y="14"
        width="7"
        height="7"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="3"
        y="5"
        width="18"
        height="16"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M3 10h18"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M8 3v4M16 3v4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M3 20c0-3.314 2.686-6 6-6s6 2.686 6 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="17" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M21 20c0-2.761-1.791-5-4-5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconFlag() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M5 21V4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M5 4h10l-2.5 4.5L15 13H5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconBook() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M4 4h16v16H6.5A2.5 2.5 0 0 1 4 17.5V4z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M8 8h8M8 12h5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconContacts() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="4"
        y="2"
        width="16"
        height="20"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M7 19c0-2.761 2.239-4 5-4s5 1.239 5 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconLogOut() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points="16,17 21,12 16,7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1="21"
        y1="12"
        x2="9"
        y2="12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconEdit() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconChevronsUpDown() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path
        d="M7 15l5 5 5-5M7 9l5-5 5 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Helpers ──────────────────────────────────────────────────

function avatarInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2)
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ─── UserMenu ─────────────────────────────────────────────────

function UserMenu({
  displayName,
  email,
  role,
  onSignOut,
  onEditAccount,
}: {
  displayName: string;
  email: string;
  role: string;
  onSignOut: () => void;
  onEditAccount: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const initials = avatarInitials(displayName);

  return (
    <div ref={ref} className="relative">
      {open && (
        <div className="border-sand-200 absolute right-0 bottom-full left-0 mb-2 overflow-hidden rounded-2xl border bg-white shadow-lg">
          <div className="border-sand-100 flex items-center gap-3 border-b px-4 py-3">
            <div className="bg-petroleum-700 flex size-9 shrink-0 items-center justify-center rounded-full">
              <span className="text-xs font-semibold text-white">
                {initials}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-petroleum-700 truncate text-sm font-medium">
                {displayName}
              </p>
              <p className="text-petroleum-400 truncate text-xs">{email}</p>
              <p className="text-petroleum-300 mt-0.5 text-xs capitalize">
                {role}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setOpen(false);
              onEditAccount();
            }}
            className="text-petroleum-600 hover:bg-sand-50 flex w-full items-center gap-2.5 px-4 py-2.5 text-sm transition-colors"
          >
            <IconEdit />
            Edit account
          </button>
          <button
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 transition-colors hover:bg-red-50"
          >
            <IconLogOut />
            Sign out
          </button>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="border-sand-200 hover:bg-sand-50 flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors"
      >
        <div className="bg-petroleum-700 flex size-8 shrink-0 items-center justify-center rounded-full">
          <span className="text-xs font-semibold text-white">{initials}</span>
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p className="text-petroleum-700 truncate text-sm leading-none font-medium">
            {email}
          </p>
          <p className="text-petroleum-400 mt-1 text-xs leading-none capitalize">
            {role}
          </p>
        </div>
        <span className="text-petroleum-300 shrink-0">
          <IconChevronsUpDown />
        </span>
      </button>
    </div>
  );
}

// ─── Nav icons map ────────────────────────────────────────────

const navIcons: Record<string, React.ReactNode> = {
  Overview: <IconGrid />,
  Bookings: <IconCalendar />,
  Contacts: <IconContacts />,
  Staff: <IconUsers />,
  Races: <IconFlag />,
  Education: <IconBook />,
};

// ─── Layout ───────────────────────────────────────────────────

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const { replace } = router;
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
      if (userRole !== "admin" && userRole !== "staff") {
        replace("/");
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
        {/* Logo */}
        <div
          className={`border-sand-200 flex h-12 shrink-0 items-center border-b ${
            sidebarCollapsed ? "justify-center px-4" : "px-6"
          }`}
        >
          {sidebarCollapsed ? (
            <span className="font-display text-petroleum-700 text-lg font-bold">
              E
            </span>
          ) : (
            <span className="font-display text-petroleum-700 text-xl">
              Essentia
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          <ul className="space-y-0.5">
            {navLinks.map(({ label, href }) => {
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

        {/* Bottom: UserMenu or avatar-only when collapsed */}
        <div className="border-sand-200 shrink-0 border-t p-3">
          {sidebarCollapsed ? (
            <button
              onClick={() => router.push("/dashboard/account")}
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
              onEditAccount={() => router.push("/dashboard/account")}
            />
          )}
        </div>
      </aside>

      {/* ── Right column: top bar + content ───────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <div className="border-sand-200 sticky top-0 z-30 flex h-12 shrink-0 items-center gap-3 border-b bg-white px-4">
          {/* Toggle — desktop: collapse sidebar; mobile: open drawer */}
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

          {/* Separator */}
          <span className="text-sand-300 font-light select-none">|</span>

          {/* Breadcrumbs */}
          <nav className="flex min-w-0 items-center gap-1.5 text-sm">
            {breadcrumbs.map((crumb, i) => (
              <Fragment key={i}>
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

          {/* Mobile: brand on the right */}
          <span className="font-display text-petroleum-700 ml-auto text-lg lg:hidden">
            Essentia
          </span>
        </div>

        {/* Main content */}
        <main className="flex-1">{children}</main>
      </div>

      {/* ── Mobile drawer ──────────────────────────────────── */}
      {mobileOpen && (
        <div
          role="button"
          tabIndex={0}
          className="fixed inset-0 z-40 lg:hidden"
          onClick={() => setMobileOpenAtPathname(null)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ")
              setMobileOpenAtPathname(null);
          }}
        >
          <div className="absolute inset-0 bg-black/20" />
          <aside
            className="absolute top-0 left-0 flex h-full w-64 flex-col bg-white shadow-xl"
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
                {navLinks.map(({ label, href }) => {
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
                          className={
                            active ? "text-white" : "text-petroleum-400"
                          }
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
                onEditAccount={() => router.push("/dashboard/account")}
              />
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
