"use client";

import { useState, useEffect, useRef, type Ref, type RefObject } from "react";
import Link from "next/link";
import gsap from "gsap";

import { maiMenu } from "@/constants/menu";
import { contact } from "@/constants/contact";

import { Button } from "@components/ui/button";
import { Logo } from "@components/ui/logo";
import { HamburgerButton } from "@components/ui/hamburger-button";
import { Accordion } from "@components/ui/accordion";
import { IconChevronDown } from "@components/ui/icons";
import { AnimatedLink } from "@components/ui/animated-text";

type MenuItem = (typeof maiMenu)[0];
type ItemMenu = (typeof maiMenu)[0]["itemMenu"][0];

// ─── DesktopDropdown ──────────────────────────────────────────

type DesktopDropdownProps = {
  ref: Ref<HTMLDivElement>;
  displayedMenu: MenuItem | null;
  activeItem: ItemMenu | null;
  setActiveItem: (item: ItemMenu | null) => void;
  setActiveMenu: (menu: MenuItem | null) => void;
  cancelClose: () => void;
  scheduleClose: () => void;
  cardTextRef: RefObject<HTMLDivElement>;
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
                {item.itemName}
              </AnimatedLink>
            ))}
          </div>
          <div data-desktop-item className="flex items-end justify-end">
            {(() => {
              const card = activeItem?.card ?? displayedMenu?.card;
              if (!card) return null;
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
                    <p className="text-2xl font-medium">{card.title}</p>
                    <p className="text-sm opacity-80">{card.description}</p>
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
};

function MobileMenu({ ref, setOpenMobileMenu }: MobileMenuProps) {
  return (
    <div
      ref={ref}
      className="border-petroleum-100 flex flex-col overflow-hidden border-t md:hidden"
      style={{ height: 0, opacity: 0 }}
    >
      <Accordion.Group>
        {maiMenu.slice(0, 3).map((menu) => (
          <nav
            key={menu.href}
            data-menu-item
            className="border-petroleum-100 border-b px-5"
          >
            <Accordion>
              <Accordion.Header>
                <div className="font-medium">{menu.name}</div>
              </Accordion.Header>
              <Accordion.Content>
                <ul className="pb-3">
                  {menu.itemMenu.map((item) => (
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
                          {item.itemName}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Accordion.Content>
            </Accordion>
          </nav>
        ))}
      </Accordion.Group>
      <p data-menu-item className="text-sand-700 py-6 text-center text-xs">
        {contact.address}
      </p>
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────

export const Header = () => {
  const [openMobileMenu, setOpenMobileMenu] = useState(false);
  const [activeMenu, setActiveMenu] = useState<MenuItem | null>(null);
  const [displayedMenu, setDisplayedMenu] = useState<MenuItem | null>(null);
  const [activeItem, setActiveItem] = useState<ItemMenu | null>(null);

  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const desktopMenuRef = useRef<HTMLDivElement>(null);
  const cardTextRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => {
      setActiveMenu(null);
      setActiveItem(null);
    }, 400);
  };

  const handleMenuEnter = (menu: MenuItem) => {
    cancelClose();
    setActiveMenu(menu);
    setActiveItem(null);
  };

  // Sincroniza displayedMenu con activeMenu (solo al abrir)
  useEffect(() => {
    if (activeMenu !== null) setDisplayedMenu(activeMenu);
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
      .call(() => setDisplayedMenu(null));
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
    <header className="text-petroleum-500 bg-sand-50 fixed top-0 right-0 left-0 z-10 mx-auto flex w-full max-w-4xl flex-col items-center justify-center rounded-b-2xl md:mt-16 md:rounded-2xl">
      {/* Barra principal: logo, nav desktop, acciones */}
      <section
        className={`flex w-full items-center justify-between px-5 py-4 md:px-6 ${activeMenu ? "border-sand-100 border-b" : ""}`}
      >
        <Link className="mb-1" href="/" aria-label="Home">
          <Logo />
        </Link>

        <nav className="hidden md:flex">
          <ul className="flex gap-2">
            {maiMenu.slice(0, 3).map((menu) => {
              const isActive = activeMenu?.href === menu.href;
              const isDimmed = activeMenu !== null && !isActive;
              return (
                <li key={menu.href} className="relative">
                  <AnimatedLink
                    href={menu.href}
                    className="flex items-center gap-1 p-4 font-medium transition-opacity duration-200"
                    style={{ opacity: isDimmed ? 0.5 : 1 }}
                    onMouseEnter={() => handleMenuEnter(menu)}
                    onMouseLeave={scheduleClose}
                  >
                    {menu.name}
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

        <div className="gap flex items-center justify-between gap-3">
          <Button variant="solid" size="md" href="/booking">
            Booking
          </Button>
          <HamburgerButton
            setOpenMobileMenu={openMobileMenu}
            onClick={() => setOpenMobileMenu((v) => !v)}
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
          setActiveItem={setActiveItem}
          setActiveMenu={setActiveMenu}
          cancelClose={cancelClose}
          scheduleClose={scheduleClose}
          cardTextRef={cardTextRef}
        />
        <MobileMenu ref={mobileMenuRef} setOpenMobileMenu={setOpenMobileMenu} />
      </section>
    </header>
  );
};
