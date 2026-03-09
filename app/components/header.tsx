import Logo from "./logo";
import Link from "next/link";
import { MobileMenu } from "./mobile-menu";

const itemsLeft = [
  {
    title: "Services",
    slug: "/services",
  },
  {
    title: "Treatments",
    slug: "/treatments",
  },
  {
    title: "Store",
    slug: "/store",
  },
];

const itemsRight = [
  {
    title: "About",
    slug: "/about",
  },

  {
    title: "Contact",
    slug: "/contact",
  },
];

export const Header = () => {
  return (
    <header className="fixed top-10 z-50 mx-auto flex w-full justify-center">
      <div className="max-w-10xl hidden w-full items-center justify-between px-4 py-8 text-white uppercase md:flex">
        <div className="flex items-center justify-center gap-6">
          {itemsLeft.map((item) => {
            return (
              <Link
                key={item.slug}
                href={item.slug}
                className="px-4 py-2 font-medium transition-transform hover:scale-105"
              >
                {item.title}
              </Link>
            );
          })}
        </div>
        <Link
          href="/"
          className="mx-6 w-40 transition-transform hover:scale-105"
        >
          <Logo />
        </Link>
        <div className="flex items-center justify-center gap-6">
          {itemsRight.map((item) => {
            return (
              <Link
                key={item.slug}
                href={item.slug}
                className="px-4 py-2 font-medium transition-transform hover:scale-105"
              >
                {item.title}
              </Link>
            );
          })}
          <Link
            href="/book"
            className="bg-secondary hover:shadow-hover rounded-md px-4 py-2 font-medium text-black transition-all hover:scale-105"
          >
            Book Now
          </Link>
        </div>
      </div>
      <MobileMenu />
    </header>
  );
};
