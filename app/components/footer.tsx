"use client";

import { useRef } from "react";
import Link from "next/link";

import { legalMenu, maiMenu } from "@/constants/menu";

import LanguageSelector from "@components/languageSelector";
import { contact } from "@/constants/contact";
import { Accordion, type AccordionGroupHandle } from "@components/ui/accordion";
import { AnimatedLink, AnimatedIconLink } from "@components/ui/animated-text";

export const Footer = () => {
  const accordionRef = useRef<AccordionGroupHandle>(null);

  return (
    <footer className="bg-petroleum-700 text-sand-500 z-10 -mt-6 flex w-full flex-col rounded-tl-3xl rounded-tr-3xl">
      {/* Link */}
      <section className="flex w-full items-center justify-center pt-4 md:px-5 md:py-10">
        <div className="mx-auto flex w-full max-w-4xl flex-col items-start justify-between gap-3 md:flex-row">
          {/* Desktop Menu */}
          {maiMenu.map((item) => (
            <div key={item.name} className="hidden flex-col gap-2 md:flex">
              <span className="text-sand-700 text-base font-semibold">
                {item.name}
              </span>
              <ul className="flex flex-col gap-1 text-sm md:gap-1">
                {item.itemMenu.map((subItem) => (
                  <li key={subItem.itemName}>
                    <AnimatedLink href={subItem.href}>
                      {subItem.itemName}
                    </AnimatedLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {/* Desktop Menu */}
          <div className="flex w-full md:hidden">
            <Accordion.Group ref={accordionRef} className="w-full">
              {maiMenu.map((menu) => (
                <nav
                  key={menu.href}
                  data-menu-item
                  className="border-petroleum-500 last:border-petroleum-700 w-full border-b px-5"
                >
                  <Accordion>
                    <Accordion.Header iconClassName="text-sand-500">
                      <div className="text-sand-500 font-medium">
                        {menu.name}
                      </div>
                    </Accordion.Header>
                    <Accordion.Content>
                      <ul className="pb-3">
                        {menu.itemMenu.map((item) => (
                          <li
                            key={item.href}
                            className="border-petroleum-500 border-l pr-5 pl-3"
                          >
                            <AnimatedLink
                              href={item.href}
                              className="flex flex-col pb-2"
                              onClick={() => accordionRef.current?.close()}
                            >
                              <span className="text-sand-700 text-sm font-medium">
                                {item.itemName}
                              </span>
                            </AnimatedLink>
                          </li>
                        ))}
                      </ul>
                    </Accordion.Content>
                  </Accordion>
                </nav>
              ))}
            </Accordion.Group>
          </div>
        </div>
      </section>
      {/* Contact */}
      <section className="border-petroleum-500 flex w-full items-center justify-between border-t p-5 text-sm">
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center justify-between gap-3 md:flex-row">
          {/*Contact Address*/}
          <div className="border-petroleum-500 flex w-full max-w-72 text-center md:max-w-full md:border-r md:text-left">
            <Link
              href="https://maps.app.goo.gl/63DC95GEfWDydgrg8"
              target="_blank"
            >
              {contact.address}
            </Link>
          </div>
          {/*Contact Email and Phone*/}
          <div className="border-petroleum-500 flex w-full flex-col items-center text-center md:border-r">
            <AnimatedLink href={`mailto:${contact.email}`} target="_blank">
              {contact.email}
            </AnimatedLink>
            <AnimatedLink href={`tel:${contact.phone}`} target="_blank">
              {contact.phone}
            </AnimatedLink>
          </div>
          {/*Contact Social Media*/}
          <div className="flex w-full justify-center gap-5 md:justify-end">
            {contact.socialMedia.map((social) => (
              <AnimatedIconLink
                key={social.name}
                href={social.url}
                target="_blank"
                className="border-petroleum-500 rounded-full border p-2 text-center"
              >
                <social.icon />
              </AnimatedIconLink>
            ))}
          </div>
        </div>
      </section>
      {/* Legal */}
      <section className="border-petroleum-500 flex w-full items-center justify-center border-y p-5">
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center justify-between gap-3 md:flex-row">
          <LanguageSelector />
          <ul className="flex gap-8 md:gap-6">
            {legalMenu.map((item) => (
              <li key={item.name}>
                <AnimatedLink href={item.href} className="text-sm">
                  {item.name}
                </AnimatedLink>
              </li>
            ))}
          </ul>
        </div>
      </section>
      {/* Copyright */}
      <section className="pt-4 pb-5 md:py-5">
        <p className="text-center text-xs">
          © {new Date().getFullYear()} Essentia Wellness Club. All rights
          reserved.
        </p>
      </section>
    </footer>
  );
};
