import { NextIntlClientProvider } from "next-intl";
import { getMessages, getLocale } from "next-intl/server";
import "../globals.css";
import { fontVariables } from "@lib/fonts";
import { AuthProvider } from "@components/auth-provider";
import { ConsentManager } from "@components/consent-manager";
import { Header } from "@components/header";
import { Footer } from "@components/footer";
import { ScrollReset } from "@components/scroll-reset";

/**
 * The account area's root layout.
 *
 * These routes sit outside `[locale]` — they are always behind a login and
 * their URLs carry no locale prefix — so the language comes from the request
 * rather than from `params`. That keeps them dynamic, which is correct: every
 * page here is specific to the signed-in user and could never be prerendered.
 */

export default async function AccountLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const messages = await getMessages({ locale });

  return (
    <html lang={locale} data-scroll-behavior="smooth" className={fontVariables}>
      <body className="antialiased">
        <AuthProvider>
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
