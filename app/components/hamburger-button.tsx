"use client";

type HamburgerButtonProps = {
  setOpenMobileMenu: boolean;
  onClick: () => void;
  className?: string;
};

export function HamburgerButton({
  setOpenMobileMenu,
  onClick,
  className,
}: HamburgerButtonProps) {
  return (
    <button
      onClick={onClick}
      aria-label={setOpenMobileMenu ? "Cerrar menú" : "Abrir menú"}
      aria-expanded={setOpenMobileMenu}
      className={`border-petroleum-500 relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border bg-transparent ${className ?? ""}`}
    >
      <span
        className="bg-petroleum-500 absolute h-px w-4 transition-all duration-300 ease-in-out"
        style={{
          transform: setOpenMobileMenu
            ? "translateY(0) rotate(45deg)"
            : "translateY(-4px)",
        }}
      />
      <span
        className="bg-petroleum-500 absolute h-px w-4 transition-all duration-300 ease-in-out"
        style={{
          opacity: setOpenMobileMenu ? 0 : 1,
          scale: setOpenMobileMenu ? "0.5" : "1",
        }}
      />
      <span
        className="bg-petroleum-500 absolute h-px w-4 transition-all duration-300 ease-in-out"
        style={{
          transform: setOpenMobileMenu
            ? "translateY(0) rotate(-45deg)"
            : "translateY(4px)",
        }}
      />
    </button>
  );
}
