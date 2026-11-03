import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "../globals.css";
import { fontVariables } from "@lib/fonts";
import { AuthProvider } from "@components/auth-provider";
import { metadataBase } from "@/lib/site-url";

/**
 * The root layout of the sign-in screen for connecting an AI assistant.
 *
 * It sits outside `[locale]`, like the account area: the address an assistant
 * sends the person to is fixed by the OAuth metadata and carries no language,
 * so the language comes from the request. It has no header or footer — it is a
 * single decision, not a page of the site — and it is never indexed.
 */
export const metadata: Metadata = {
  metadataBase,
  title: { absolute: "Essentia" },
  robots: { index: false, follow: false },
};

export default async function OAuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const messages = await getMessages({ locale });

  return (
    <html lang={locale} data-scroll-behavior="smooth" className={fontVariables}>
      <body className="antialiased">
        <AuthProvider>
          <NextIntlClientProvider messages={messages} locale={locale}>
            <main className="bg-sand-50 flex min-h-dvh items-center justify-center px-5 py-12">
              {children}
            </main>
          </NextIntlClientProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
