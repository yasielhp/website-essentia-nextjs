"use client";

import Logo from "@components/logo";
import Link from "next/link";
import { useState } from "react";
import { Button } from "./button";

export const Header = () => {
  const [open, setOpen] = useState(false);

  return (
    <header className="text-petroleum-500 bg-sand-50 sticky top-0 z-10 mx-auto flex w-full max-w-4xl flex-col items-center justify-center rounded-b-2xl px-5 py-4 md:mt-10 md:rounded-2xl md:px-6">
      <div id="top" className="flex w-full items-center justify-between">
        <Link className="mb-1" href="/" aria-label="Home">
          <Logo />
        </Link>
        <div className="gap flex items-center justify-between gap-3">
          <Button variant="solid" size="md" href="/booking">
            Booking
          </Button>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={open}
            className="border-petroleum-500 relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border bg-transparent md:hidden"
          >
            {/* Línea superior */}
            <span
              className="bg-petroleum-500 absolute h-px w-4 transition-all duration-300 ease-in-out"
              style={{
                transform: open
                  ? "translateY(0) rotate(45deg)"
                  : "translateY(-4px)",
              }}
            />
            {/* Línea central */}
            <span
              className="bg-petroleum-500 absolute h-px w-4 transition-all duration-300 ease-in-out"
              style={{ opacity: open ? 0 : 1, scale: open ? "0.5" : "1" }}
            />
            {/* Línea inferior */}
            <span
              className="bg-petroleum-500 absolute h-px w-4 transition-all duration-300 ease-in-out"
              style={{
                transform: open
                  ? "translateY(0) rotate(-45deg)"
                  : "translateY(4px)",
              }}
            />
          </button>
        </div>
      </div>
    </header>
  );
};
