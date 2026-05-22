"use client";

import { useReducer, useEffect, useRef, type Ref, type RefObject } from "react";
import Link from "next/link";
import gsap from "gsap";
import { useTranslations } from "next-intl";

import { maiMenu } from "@/constants/menu";
import { contact } from "@/constants/contact";

import { Button } from "@components/ui/button";
import { Logo } from "@components/ui/logo";
import { HamburgerButton } from "@components/ui/hamburger-button";
import { Accordion } from "@components/ui/accordion";
import { IconChevronDown, IconUserCircle } from "@components/ui/icons";
import { AnimatedLink } from "@components/ui/animated-text";
import { useAuth } from "@/components/auth-provider";

// ─── i18n mappings ────────────────────────────────────────────
// Map the hardcoded `maiMenu` href slugs to the keys defined in
// `messages/{locale}/nav.json`. Keeping the constant untouched avoids
// breaking external consumers while we route the displayed strings
// through next-intl.

const menuNameKeyByHref: Record<string, string> = {
  "/wellness": "wellness",
  "/medicine": "medicine",
  "/community": "community",
  "/": "essentia",
};

const itemKeyByHref: Record<string, string> = {
  // wellness
  "/wellness/manual-therapies": "manualTherapies",
  "/wellness/contrast-therapy": "thermalContrast",
  "/wellness/breathing-sessions": "breathingSessions",
  "/wellness/red-light-therapy": "redLightTherapy",
  "/wellness/functional-well-being": "functionalWellBeing",
  // medicine
  "/medicine/regenerative-medicine": "regenerativeMedicine",
  "/medicine/intravenous-therapy": "intravenousTherapy",
  "/medicine/hyperbaric-chambers": "hyperbaricChambers",
  // community
  "/community/running-club": "runningClub",
  "/community/education-programs": "educationAndPrograms",
  "/community/memberships": "memberships",
  // essentia
  "/about": "about",
  "/blog": "blog",
  "/shop": "shop",
  "/contact": "contact",
};

// Section keys used to resolve nested item labels under `nav.items.*`.
const sectionKeyByMenuHref: Record<
  string,
  "wellness" | "medicine" | "community" | null
> = {
  "/wellness": "wellness",
  "/medicine": "medicine",
  "/community": "community",
  "/": null,
};

// Member account links — labels resolved at render time via `nav.account.*`.
// Admin links live under /dashboard and are deliberately not translated.
const memberMenuItems: { href: string; labelKey: string }[] = [
  { href: "/account", labelKey: "account.overview" },
  { href: "/account/bookings", labelKey: "account.myBookings" },
  { href: "/account/races", labelKey: "account.myRaces" },
  { href: "/account/education", labelKey: "account.mySessions" },
];

const adminMenuItems: { href: string; label: string }[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/bookings", label: "Bookings" },
  { href: "/dashboard/races", label: "Races" },
  { href: "/dashboard/education", label: "Education" },
  { href: "/dashboard/contacts", label: "Contacts" },
];

type MenuItem = (typeof maiMenu)[0];
type ItemMenu = (typeof maiMenu)[0]["itemMenu"][0];

// ─── Header state ─────────────────────────────────────────────

type HeaderState = {
  openMobileMenu: boolean;
  activeMenu: MenuItem | null;
  displayedMenu: MenuItem | null;
  activeItem: ItemMenu | null;
  openAccountMenu: boolean;
};

type HeaderAction =
  | { type: "TOGGLE_MOBILE_MENU" }
  | { type: "SET_MOBILE_MENU"; open: boolean }
  | { type: "SET_ACTIVE_MENU"; menu: MenuItem | null }
  | { type: "SET_DISPLAYED_MENU"; menu: MenuItem | null }
  | { type: "SET_ACTIVE_ITEM"; item: ItemMenu | null }
  | { type: "TOGGLE_ACCOUNT_MENU" }
  | { type: "CLOSE_ACCOUNT_MENU" }
  | { type: "MENU_ENTER"; menu: MenuItem }
  | { type: "SCHEDULE_CLOSE" };

function headerReducer(state: HeaderState, action: HeaderAction): HeaderState {
  switch (action.type) {
    case "TOGGLE_MOBILE_MENU":
      return { ...state, openMobileMenu: !state.openMobileMenu };
    case "SET_MOBILE_MENU":
      return { ...state, openMobileMenu: action.open };
    case "SET_ACTIVE_MENU":
      return { ...state, activeMenu: action.menu };
    case "SET_DISPLAYED_MENU":
      return { ...state, displayedMenu: action.menu };
    case "SET_ACTIVE_ITEM":
      return { ...state, activeItem: action.item };
    case "TOGGLE_ACCOUNT_MENU":
      return { ...state, openAccountMenu: !state.openAccountMenu };
    case "CLOSE_ACCOUNT_MENU":
      return { ...state, openAccountMenu: false };
    case "MENU_ENTER":
      return {
        ...state,
        activeMenu: action.menu,
        activeItem: null,
        openAccountMenu: false,
      };
    case "SCHEDULE_CLOSE":
      return { ...state, activeMenu: null, activeItem: null };
  }
}

const initialHeaderState: HeaderState = {
  openMobileMenu: false,
  activeMenu: null,
  displayedMenu: null,
  activeItem: null,
  openAccountMenu: false,
};

// ─── DesktopDropdown ──────────────────────────────────────────

type DesktopDropdownProps = {
  ref: Ref<HTMLDivElement>;
  displayedMenu: MenuItem | null;
  activeItem: ItemMenu | null;
  setActiveItem: (item: ItemMenu | null) => void;
  setActiveMenu: (menu: MenuItem | null) => void;
  cancelClose: () => void;
  scheduleClose: () => void;
  cardTextRef: RefObject<HTMLDivElement | null>;
};

function DesktopDropdown({
  ref,
  displayedMenu,
  activeItem,
  setActiveItem,
  setActiveMenu,
  cancelClose,
  scheduleClose,
  cardTextRef,
}: DesktopDropdownProps) {
  const tNav = useTranslations("nav");

  // Resolve the section key (wellness | medicine | community) for the
  // currently displayed top-level menu. The Essentia menu maps to `null`
  // because its items live at the root of the `nav` namespace.
  const sectionKey = displayedMenu
    ? (sectionKeyByMenuHref[displayedMenu.href] ?? null)
    : null;

  const translateItemName = (item: ItemMenu): string => {
    const key = itemKeyByHref[item.href];
    if (!key) return item.itemName;
    return sectionKey ? tNav(`items.${sectionKey}.${key}`) : tNav(key);
  };

  const translateCard = (
    card: NonNullable<ItemMenu["card"]> | NonNullable<MenuItem["card"]>,
    sourceHref: string,
  ): { title: string | null; description: string | null } => {
    // Top-level menu card → use `cards.{menuKey}`.
    const menuKey = menuNameKeyByHref[sourceHref];
    if (menuKey && menuKey !== "essentia") {
      return {
        title: tNav(`cards.${menuKey}.title`),
        description: tNav(`cards.${menuKey}.description`),
      };
    }
    // Sub-item card → use `cards.{itemKey}`.
    const itemKey = itemKeyByHref[sourceHref];
    if (itemKey) {
      return {
        title: tNav(`cards.${itemKey}.title`),
        description: tNav(`cards.${itemKey}.description`),
      };
    }
    return { title: card.title ?? null, description: card.description ?? null };
  };

  return (
    <div
      ref={ref}
      className="hidden overflow-hidden md:block"
      onMouseEnter={cancelClose}
      onMouseLeave={scheduleClose}
    >
      {displayedMenu && (
        <div className="flex min-h-64 justify-between p-6">
          <div className="flex flex-col">
            {displayedMenu.itemMenu.map((item) => (
              <AnimatedLink
                key={item.href}
                href={item.href}
                data-desktop-item
                className="block py-1.5 transition-opacity duration-150"
                style={{
                  opacity:
                    activeItem && activeItem.href !== item.href ? 0.6 : 1,
                }}
                onMouseEnter={() => setActiveItem(item)}
                onMouseLeave={() => setActiveItem(null)}
                onClick={() => {
                  setActiveMenu(null);
                  setActiveItem(null);
                }}
              >
                {translateItemName(item)}
              </AnimatedLink>
            ))}
          </div>
          <div data-desktop-item className="flex items-end justify-end">
            {(() => {
              const card = activeItem?.card ?? displayedMenu?.card;
              if (!card) return null;
              const sourceHref = activeItem?.href ?? displayedMenu.href;
              const translated = translateCard(card, sourceHref);
              return (
                <div
                  className="relative flex min-h-50 w-112.5 flex-col justify-end overflow-hidden rounded-2xl p-5"
                  style={
                    card.imagen
                      ? {
                          backgroundImage: `url(${card.imagen})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }
                      : undefined
                  }
                >
                  {!card.imagen && (
                    <div className="bg-petroleum-500 absolute inset-0" />
                  )}
                  {card.imagen && (
                    <div
                      className="absolute inset-0"
                      style={{
                        background:
                          "linear-gradient(to top, rgb(9 33 33 / 0.9), rgb(12 44 44 / 0.4), transparent)",
                      }}
                    />
                  )}
                  <div ref={cardTextRef} className="relative z-10 text-white">
                    <p className="text-2xl font-medium">{translated.title}</p>
                    <p className="text-sm opacity-80">
                      {translated.description}
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MobileMenu ───────────────────────────────────────────────

type MobileMenuProps = {
  ref: Ref<HTMLDivElement>;
  setOpenMobileMenu: (open: boolean) => void;
  onSignOut?: () => void;
  isLoggedIn?: boolean;
  userRole?: string;
};

function MobileMenu({
  ref,
  setOpenMobileMenu,
  onSignOut,
  isLoggedIn,
  userRole,
}: MobileMenuProps) {
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const isAdmin = userRole === "admin" || userRole === "staff";
  // Member items are user-facing → translated via `nav.account.*`.
  // Admin items live under /dashboard and are intentionally untranslated.
  const mobileAccountItems = isAdmin
    ? adminMenuItems
    : memberMenuItems.map((it) => ({
        href: it.href,
        label: tNav(it.labelKey),
      }));
  return (
    <div
      ref={ref}
      className="border-petroleum-100 flex flex-col overflow-hidden border-t md:hidden"
      style={{ height: 0, opacity: 0 }}
    >
      <Accordion.Group>
        {maiMenu.slice(0, 3).map((menu) => {
          const menuKey = menuNameKeyByHref[menu.href];
          const sectionKey = sectionKeyByMenuHref[menu.href];
          return (
            <nav
              key={menu.href}
              data-menu-item
              className="border-petroleum-100 border-b px-5"
            >
              <Accordion>
                <Accordion.Header>
                  <div className="font-medium">
                    {menuKey ? tNav(menuKey) : menu.name}
                  </div>
                </Accordion.Header>
                <Accordion.Content>
                  <ul className="pb-3">
                    {menu.itemMenu.map((item) => {
                      const itemKey = itemKeyByHref[item.href];
                      const label = itemKey
                        ? sectionKey
                          ? tNav(`items.${sectionKey}.${itemKey}`)
                          : tNav(itemKey)
                        : item.itemName;
                      return (
                        <li
                          key={item.href}
                          className="border-sand-200 border-l pr-5 pl-3"
                        >
                          <Link
                            href={item.href}
                            onClick={() => setOpenMobileMenu(false)}
                            className="flex flex-col pb-2"
                          >
                            <span className="text-sand-700 text-sm font-medium">
                              {label}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </Accordion.Content>
              </Accordion>
            </nav>
          );
        })}
        {isLoggedIn && (
          <nav data-menu-item className="border-petroleum-100 border-b px-5">
            <Accordion>
              <Accordion.Header>
                <div className="font-medium">{tNav("account.title")}</div>
              </Accordion.Header>
              <Accordion.Content>
                <ul className="pb-3">
                  {mobileAccountItems.map((item) => (
                    <li
                      key={item.href}
                      className="border-sand-200 border-l pr-5 pl-3"
                    >
                      <Link
                        href={item.href}
                        onClick={() => setOpenMobileMenu(false)}
                        className="flex flex-col pb-2"
                      >
                        <span className="text-sand-700 text-sm font-medium">
                          {item.label}
                        </span>
                      </Link>
                    </li>
                  ))}
                  {onSignOut && (
                    <li className="border-sand-200 border-l pr-5 pl-3">
                      <button
                        type="button"
                        onClick={() => {
                          onSignOut();
                          setOpenMobileMenu(false);
                        }}
                        className="text-petroleum-400 flex flex-col pb-2 text-sm font-medium"
                      >
                        {tCommon("signOut")}
                      </button>
                    </li>
                  )}
                </ul>
              </Accordion.Content>
            </Accordion>
          </nav>
        )}
      </Accordion.Group>
      <p data-menu-item className="text-sand-700 py-6 text-center text-xs">
        {contact.address}
      </p>
    </div>
  );
}

// ─── AccountDropdown ──────────────────────────────────────────

type AccountDropdownProps = {
  ref: Ref<HTMLDivElement>;
  isAdmin: boolean;
  menuItems: { href: string; label: string }[];
  onClose: () => void;
  onSignOut: () => void;
};

function AccountDropdown({
  ref,
  isAdmin,
  menuItems,
  onClose,
  onSignOut,
}: AccountDropdownProps) {
  const tHeader = useTranslations("header");
  const tCommon = useTranslations("common");
  return (
    <div
      ref={ref}
      className="border-sand-200 absolute top-full right-0 mt-2 w-48 overflow-hidden rounded-2xl border bg-white shadow-lg"
    >
      <ul className="py-2">
        {isAdmin && (
          <li className="px-4 pt-0.5 pb-1.5">
            <span className="text-petroleum-300 text-xs font-semibold tracking-widest uppercase">
              {tHeader("adminBadge")}
            </span>
          </li>
        )}
        {menuItems.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onClose}
              className="text-petroleum-500 hover:bg-sand-50 block px-4 py-2.5 text-sm font-medium transition-colors"
            >
              {item.label}
            </Link>
          </li>
        ))}
        <li className="border-sand-100 mx-4 mt-1 border-t pt-1">
          <button
            type="button"
            onClick={onSignOut}
            className="text-petroleum-400 hover:text-petroleum-500 w-full py-2.5 text-left text-sm font-medium transition-colors"
          >
            {tCommon("signOut")}
          </button>
        </li>
      </ul>
    </div>
  );
}

// ─── DesktopNav ───────────────────────────────────────────────

type DesktopNavProps = {
  activeMenu: MenuItem | null;
  onMenuEnter: (menu: MenuItem) => void;
  onMouseLeave: () => void;
};

function DesktopNav({
  activeMenu,
  onMenuEnter,
  onMouseLeave,
}: DesktopNavProps) {
  const tNav = useTranslations("nav");
  return (
    <nav className="hidden md:flex">
      <ul className="flex gap-2">
        {maiMenu.slice(0, 3).map((menu) => {
          const isActive = activeMenu?.href === menu.href;
          const isDimmed = activeMenu !== null && !isActive;
          const menuKey = menuNameKeyByHref[menu.href];
          return (
            <li key={menu.href} className="relative">
              <AnimatedLink
                href={menu.href}
                className="flex items-center gap-1 p-4 font-medium transition-opacity duration-200"
                style={{ opacity: isDimmed ? 0.5 : 1 }}
                onMouseEnter={() => onMenuEnter(menu)}
                onMouseLeave={onMouseLeave}
              >
                {menuKey ? tNav(menuKey) : menu.name}
                <span
                  className="transition-transform duration-300 ease-in-out"
                  style={{
                    transform: isActive ? "rotate(180deg)" : "rotate(0deg)",
                  }}
                >
                  <IconChevronDown />
                </span>
              </AnimatedLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// ─── Header ───────────────────────────────────────────────────

export const Header = () => {
  const { user, signOut } = useAuth();
  const tNav = useTranslations("nav");
  const tHeader = useTranslations("header");
  const tCommon = useTranslations("common");
  const isAdmin = user?.role === "admin" || user?.role === "staff";
  // Admin items intentionally stay untranslated (dashboard area).
  const desktopMenuItems: { href: string; label: string }[] = isAdmin
    ? adminMenuItems
    : memberMenuItems.map((it) => ({
        href: it.href,
        label: tNav(it.labelKey),
      }));
  const [
    { openMobileMenu, activeMenu, displayedMenu, activeItem, openAccountMenu },
    dispatch,
  ] = useReducer(headerReducer, initialHeaderState);

  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const desktopMenuRef = useRef<HTMLDivElement>(null);
  const cardTextRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const accountDropdownRef = useRef<HTMLDivElement>(null);

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => {
      dispatch({ type: "SCHEDULE_CLOSE" });
    }, 400);
  };

  const handleMenuEnter = (menu: MenuItem) => {
    cancelClose();
    dispatch({ type: "MENU_ENTER", menu });
  };

  // Sincroniza displayedMenu con activeMenu (solo al abrir)
  useEffect(() => {
    if (activeMenu !== null)
      dispatch({ type: "SET_DISPLAYED_MENU", menu: activeMenu });
  }, [activeMenu]);

  // Animar apertura del dropdown
  useEffect(() => {
    if (!displayedMenu || !desktopMenuRef.current) return;

    const el = desktopMenuRef.current;
    const items = el.querySelectorAll("[data-desktop-item]");
    const isAlreadyOpen = el.offsetHeight > 0;

    gsap.killTweensOf(el);

    if (isAlreadyOpen) {
      gsap.fromTo(
        items,
        { y: 4, opacity: 0 },
        { y: 0, opacity: 1, stagger: 0.04, duration: 0.2, ease: "power2.out" },
      );
    } else {
      gsap
        .timeline()
        .fromTo(
          el,
          { height: 0, opacity: 0 },
          { height: "auto", opacity: 1, duration: 0.3, ease: "power3.out" },
        )
        .fromTo(
          items,
          { y: 8, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            stagger: 0.05,
            duration: 0.25,
            ease: "power2.out",
          },
          "-=0.1",
        );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayedMenu?.href]);

  // Animar cierre del dropdown
  useEffect(() => {
    if (activeMenu !== null || !desktopMenuRef.current || !displayedMenu)
      return;

    const el = desktopMenuRef.current;
    const items = el.querySelectorAll("[data-desktop-item]");
    gsap.killTweensOf(el);
    gsap
      .timeline()
      .to(items, {
        y: -5,
        opacity: 0,
        stagger: 0.03,
        duration: 0.15,
        ease: "power2.in",
      })
      .to(
        el,
        { height: 0, opacity: 0, duration: 0.25, ease: "power3.in" },
        "-=0.05",
      )
      .call(() => dispatch({ type: "SET_DISPLAYED_MENU", menu: null }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMenu]);

  // Animar texto de la card al cambiar el item activo
  const activeCardHref = activeItem?.href ?? displayedMenu?.href;
  useEffect(() => {
    if (!cardTextRef.current) return;
    gsap.fromTo(
      cardTextRef.current.children,
      { y: 10, opacity: 0 },
      { y: 0, opacity: 1, stagger: 0.08, duration: 0.3, ease: "power2.out" },
    );
  }, [activeCardHref]);

  // Click-outside para cerrar el dropdown de cuenta
  useEffect(() => {
    if (!openAccountMenu) return;
    const handler = (e: MouseEvent) => {
      if (
        accountMenuRef.current &&
        !accountMenuRef.current.contains(e.target as Node)
      ) {
        dispatch({ type: "CLOSE_ACCOUNT_MENU" });
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openAccountMenu]);

  // Animar apertura/cierre del dropdown de cuenta
  useEffect(() => {
    const el = accountDropdownRef.current;
    if (!el) return;
    if (openAccountMenu) {
      gsap.fromTo(
        el,
        { opacity: 0, y: -6, scale: 0.97 },
        { opacity: 1, y: 0, scale: 1, duration: 0.2, ease: "power2.out" },
      );
    } else {
      gsap.to(el, {
        opacity: 0,
        y: -6,
        scale: 0.97,
        duration: 0.15,
        ease: "power2.in",
      });
    }
  }, [openAccountMenu]);

  // Animar menú móvil
  useEffect(() => {
    if (!mobileMenuRef.current) return;

    const items = mobileMenuRef.current.querySelectorAll("[data-menu-item]");

    if (openMobileMenu) {
      gsap
        .timeline()
        .to(mobileMenuRef.current, {
          height: "auto",
          opacity: 1,
          duration: 0.35,
          ease: "power3.out",
        })
        .fromTo(
          items,
          { y: 10, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            stagger: 0.06,
            duration: 0.3,
            ease: "power2.out",
          },
          "-=0.15",
        );
    } else {
      gsap
        .timeline()
        .to(items, {
          y: -6,
          opacity: 0,
          stagger: 0.04,
          duration: 0.2,
          ease: "power2.in",
        })
        .to(
          mobileMenuRef.current,
          { height: 0, opacity: 0, duration: 0.3, ease: "power3.in" },
          "-=0.1",
        );
    }
  }, [openMobileMenu]);

  return (
    <header className="text-petroleum-500 fixed top-0 right-0 left-0 z-10 mx-auto flex w-full max-w-4xl flex-col items-center justify-center rounded-b-2xl bg-white md:mt-16 md:rounded-2xl">
      {/* Barra principal: logo, nav desktop, acciones */}
      <section
        className={`flex w-full items-center justify-between px-5 py-4 md:px-6 ${activeMenu ? "border-sand-100 border-b" : ""}`}
      >
        <Link
          className="mb-1"
          href="/"
          aria-label={tHeader("logoAriaLabel")}
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          <Logo />
        </Link>

        <DesktopNav
          activeMenu={activeMenu}
          onMenuEnter={handleMenuEnter}
          onMouseLeave={scheduleClose}
        />

        <div className="gap flex items-center justify-between gap-3">
          {user ? (
            <div ref={accountMenuRef} className="relative hidden md:block">
              <button
                type="button"
                aria-label={tHeader("myAccountAriaLabel")}
                onClick={() => dispatch({ type: "TOGGLE_ACCOUNT_MENU" })}
                className="text-petroleum-500 hover:text-petroleum-700 flex cursor-pointer items-center rounded-full transition-colors"
              >
                <IconUserCircle />
              </button>
              {openAccountMenu && (
                <AccountDropdown
                  ref={accountDropdownRef}
                  isAdmin={isAdmin}
                  menuItems={desktopMenuItems}
                  onClose={() => dispatch({ type: "CLOSE_ACCOUNT_MENU" })}
                  onSignOut={() => {
                    void signOut();
                    dispatch({ type: "CLOSE_ACCOUNT_MENU" });
                  }}
                />
              )}
            </div>
          ) : (
            <Button variant="solid" size="md" href="/booking">
              {tCommon("booking")}
            </Button>
          )}
          <HamburgerButton
            setOpenMobileMenu={openMobileMenu}
            onClick={() => dispatch({ type: "TOGGLE_MOBILE_MENU" })}
            className="md:hidden"
          />
        </div>
      </section>

      {/* Dropdown desktop + menú móvil */}
      <section className="w-full">
        <DesktopDropdown
          ref={desktopMenuRef}
          displayedMenu={displayedMenu}
          activeItem={activeItem}
          setActiveItem={(item) => dispatch({ type: "SET_ACTIVE_ITEM", item })}
          setActiveMenu={(menu) => dispatch({ type: "SET_ACTIVE_MENU", menu })}
          cancelClose={cancelClose}
          scheduleClose={scheduleClose}
          cardTextRef={cardTextRef}
        />
        <MobileMenu
          ref={mobileMenuRef}
          setOpenMobileMenu={(open) =>
            dispatch({ type: "SET_MOBILE_MENU", open })
          }
          isLoggedIn={!!user}
          onSignOut={signOut}
          userRole={user?.role}
        />
      </section>
    </header>
  );
};
