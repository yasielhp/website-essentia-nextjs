import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { unlockAccount } from "@/actions/unlock-account";
import { Button } from "@components/ui/button";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: "auth.unlockAccount.meta",
  });
  return {
    title: t("title"),
    // A page addressed by a token has nothing to index and every reason not to
    // be: a crawler that followed one would spend it.
    robots: { index: false, follow: false },
  };
}

/**
 * The landing page for the link in the lock email.
 *
 * The token is spent on the server as the page renders, so the account is
 * already open by the time anything is shown. It does not sign anybody in —
 * reaching the mailbox is not the same as knowing the password.
 */
export default async function UnlockAccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { token } = await searchParams;
  const t = await getTranslations({ locale, namespace: "auth.unlockAccount" });

  const { status } = token
    ? await unlockAccount(token)
    : { status: "invalid" as const };

  return (
    <section className="bg-sand-50 min-h-dvh">
      <div className="mx-auto flex max-w-md flex-col gap-6 px-5 pt-32 pb-24 md:pt-48">
        <h1 className="font-display text-petroleum-700 text-4xl md:text-5xl">
          {t(`${status}.heading`)}
        </h1>
        <p className="text-petroleum-400">{t(`${status}.body`)}</p>

        <Button
          href="/sign-in"
          variant="solid"
          size="md"
          className="self-start"
        >
          {t("signIn")}
        </Button>

        {status !== "unlocked" && (
          <Link
            href="/forgot-password"
            className="text-petroleum-400 hover:text-petroleum-700 text-sm underline transition-colors"
          >
            {t("forgotPassword")}
          </Link>
        )}
      </div>
    </section>
  );
}
