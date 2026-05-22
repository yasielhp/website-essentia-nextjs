import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { Header } from "@components/header";
import { Footer } from "@components/footer";
import { ScrollReset } from "@components/scroll-reset";

export default async function AccountLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <ScrollReset />
      <Header />
      <main>{children}</main>
      <Footer />
    </NextIntlClientProvider>
  );
}
