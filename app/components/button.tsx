"use client";

import Link from "next/link";
import { type ComponentPropsWithoutRef, type ReactNode } from "react";
import { SplitText, useTextAnimation } from "./animated-text";

// ─── Variantes y Tamaños ──────────────────────────────────────

type Variant =
  | "solid"
  | "outline"
  | "ghost"
  | "soft"
  | "white"
  | "outline-white"
  | "ghost-white";

type Size = "sm" | "md" | "lg";

const variantClasses: Record<Variant, string> = {
  solid:
    "bg-petroleum-700 text-white border border-transparent hover:bg-petroleum-800 active:bg-petroleum-900",
  outline:
    "bg-transparent text-petroleum-700 border border-petroleum-700 hover:bg-petroleum-50 active:bg-petroleum-100",
  ghost:
    "bg-transparent text-petroleum-700 border border-transparent hover:bg-petroleum-50 active:bg-petroleum-100",
  soft: "bg-petroleum-50 text-petroleum-700 border border-transparent hover:bg-petroleum-100 active:bg-petroleum-100",
  white:
    "bg-white text-petroleum-700 border border-transparent hover:bg-sand-50 active:bg-sand-100",
  "outline-white":
    "bg-transparent text-white border border-white hover:bg-white/10 active:bg-white/20",
  "ghost-white":
    "bg-transparent text-white border border-transparent hover:bg-white/10 active:bg-white/20",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-7 py-2.5 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2.5",
};

const baseClasses =
  "inline-flex items-center justify-center rounded-full font-medium font-body transition-all duration-200 ease-in-out cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-petroleum-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap shrink-0";

function buildClassName(variant: Variant, size: Size, className?: string) {
  return [baseClasses, variantClasses[variant], sizeClasses[size], className]
    .filter(Boolean)
    .join(" ");
}

// ─── Tipos del componente ─────────────────────────────────────

type ButtonBaseProps = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children?: ReactNode;
};

type AsButton = ButtonBaseProps &
  ComponentPropsWithoutRef<"button"> & { href?: undefined };

type AsLink = ButtonBaseProps &
  ComponentPropsWithoutRef<typeof Link> & { href: string };

type ButtonProps = AsButton | AsLink;

// ─── Componente ───────────────────────────────────────────────

export function Button({
  variant = "solid",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  const classes = buildClassName(variant, size, className);
  const { ref, handleMouseEnter } = useTextAnimation<HTMLButtonElement & HTMLAnchorElement>();

  if ("href" in props && props.href !== undefined) {
    const { href, ...linkProps } = props as AsLink;
    return (
      <Link
        href={href}
        ref={ref}
        className={classes}
        onMouseEnter={handleMouseEnter}
        {...linkProps}
      >
        <SplitText>{children}</SplitText>
      </Link>
    );
  }

  return (
    <button
      ref={ref}
      className={classes}
      onMouseEnter={handleMouseEnter}
      {...(props as AsButton)}
    >
      <SplitText>{children}</SplitText>
    </button>
  );
}
