import localFont from "next/font/local";

/**
 * The two typefaces, defined once.
 *
 * There are three root layouts — the public site, the dashboard and the
 * account area — and each must put the font variables on its own `<html>`.
 * Declaring them here keeps one set of `next/font` instances, so the files are
 * emitted and preloaded once rather than three times.
 */

export const jedira = localFont({
  src: [
    {
      path: "../../public/fonts/Jedira-Regular.woff2",
      weight: "400",
      style: "normal",
    },
  ],
  variable: "--font-jedira",
  display: "swap",
});

export const dmSans = localFont({
  src: [
    {
      path: "../../public/fonts/DMSans-Light.woff2",
      weight: "300",
      style: "normal",
    },
    {
      path: "../../public/fonts/DMSans-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/DMSans-Medium.woff2",
      weight: "500",
      style: "normal",
    },
  ],
  variable: "--font-dm-sans",
  display: "swap",
});

/** Applied to every `<html>`, so the variables resolve anywhere in the tree. */
export const fontVariables = `${jedira.variable} ${dmSans.variable}`;
