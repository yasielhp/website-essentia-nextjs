import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import "../globals.css";
import { fontVariables } from "@lib/fonts";
import { AuthProvider } from "@components/auth-provider";
import { DashboardShell } from "./dashboard-shell";
import { DashboardToaster } from "@components/dashboard/dashboard-toaster";
import { getDashboardLocale, getDashboardMessages } from "./i18n";

/**
 * The dashboard's own root layout.
 *
 * The public site's root moved inside `[locale]` so it could read the locale
 * from `params` instead of `headers()`. Next.js allows several root layouts
 * once every top-level segment is a route group, and each one owns its
 * `<html>` — so the dashboard needs this shell of its own.
 *
 * It is internationalised on its own terms: `proxy.ts` keeps next-intl's
 * middleware off `/dashboard`, so the language comes from a cookie of its own
 * and the provider gets an explicit `locale`/`messages` pair rather than
 * inheriting from `i18n/request.ts`. It still carries no consent banner and no
 * schema.org.
 */

export const metadata: Metadata = {
  title: "Dashboard | Essentia",
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getDashboardLocale();
  const messages = await getDashboardMessages(locale);

  return (
    <html lang={locale} data-scroll-behavior="smooth" className={fontVariables}>
      <body className="antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <AuthProvider requireSession>
            <DashboardShell>{children}</DashboardShell>
          </AuthProvider>
          <DashboardToaster />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
