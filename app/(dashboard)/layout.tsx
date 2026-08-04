import type { Metadata } from "next";
import "../globals.css";
import { fontVariables } from "@lib/fonts";
import { AuthProvider } from "@components/auth-provider";
import { DashboardShell } from "./dashboard-shell";

/**
 * The dashboard's own root layout.
 *
 * The public site's root moved inside `[locale]` so it could read the locale
 * from `params` instead of `headers()`. Next.js allows several root layouts
 * once every top-level segment is a route group, and each one owns its
 * `<html>` — so the dashboard needs this shell of its own.
 *
 * It is deliberately not internationalised: the dashboard is English-only, and
 * it carries no `NextIntlClientProvider`, no consent banner and no schema.org.
 */

export const metadata: Metadata = {
  title: "Dashboard | Essentia",
  robots: { index: false, follow: false },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={fontVariables}>
      <body className="antialiased">
        <AuthProvider>
          <DashboardShell>{children}</DashboardShell>
        </AuthProvider>
      </body>
    </html>
  );
}
