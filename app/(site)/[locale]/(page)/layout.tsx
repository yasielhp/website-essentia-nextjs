import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "../../../../i18n/routing";
import { Header } from "@components/header";
import { Footer } from "@components/footer";
import { ScrollReset } from "@components/scroll-reset";

/** The centre is in Tenerife; everything it schedules happens there. */
const TIME_ZONE = "Atlantic/Canary";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function PageLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) notFound();

  setRequestLocale(locale);
  const messages = await getMessages({ locale });

  return (
    // On the server this provider fills in whatever it is not given by reading
    // the request, and each of those reads opts the whole subtree into dynamic
    // rendering. It defaults five things — messages, locale, timeZone, now and
    // `formats` — and the documentation only lists the first four. `formats`
    // alone was enough to keep all 38 public pages off the static path.
    //
    // `now` stays absent on purpose: nothing here shows a relative time, and a
    // build-time value would freeze at the moment of deploy.
    //
    // This is necessary but not sufficient. The root layout still derives the
    // locale from `headers()`, which is dynamic for the entire app; see the
    // note there.
    <NextIntlClientProvider
      messages={messages}
      locale={locale}
      timeZone={TIME_ZONE}
      formats={{}}
    >
      <ScrollReset />
      <Header />
      <main>{children}</main>
      <Footer />
    </NextIntlClientProvider>
  );
}
