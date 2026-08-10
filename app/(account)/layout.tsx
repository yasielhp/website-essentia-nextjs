import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getLocale } from "next-intl/server";
import "../globals.css";
import { fontVariables } from "@lib/fonts";
import { AuthProvider } from "@components/auth-provider";
import { ConsentManager } from "@components/consent-manager";
import { Header } from "@components/header";
import { Footer } from "@components/footer";
import { ScrollReset } from "@components/scroll-reset";
import { metadataBase } from "@/lib/site-url";

/**
 * The account area's root layout.
 *
 * These routes sit outside `[locale]` — they are always behind a login and
 * their URLs carry no locale prefix — so the language comes from the request
 * rather than from `params`. That keeps them dynamic, which is correct: every
 * page here is specific to the signed-in user and could never be prerendered.
 */

export const metadata: Metadata = {
  // No root layout sits above this tree, so the base has to be stated here or
  // Next resolves social images against localhost.
  metadataBase,
  // Without a root layout above it any more, this area had no title at all and
  // browsers fell back to showing the URL.
  title: { default: "My account | Essentia", template: "%s | Essentia" },
  robots: { index: false, follow: false },
};

export default async function AccountLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const messages = await getMessages({ locale });

  return (
    <html lang={locale} data-scroll-behavior="smooth" className={fontVariables}>
      <body className="antialiased">
        <AuthProvider requireSession>
          <ConsentManager>
            <NextIntlClientProvider messages={messages} locale={locale}>
              <ScrollReset />
              <Header />
              <main>{children}</main>
              <Footer />
            </NextIntlClientProvider>
          </ConsentManager>
        </AuthProvider>
      </body>
    </html>
  );
}
