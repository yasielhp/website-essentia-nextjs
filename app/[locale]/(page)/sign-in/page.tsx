import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import SignInForm from "@components/auth/sign-in-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.signIn.meta");
  return {
    title: t("title"),
    robots: { index: false, follow: false },
  };
}

export default function SignInPage() {
  return (
    <section className="bg-sand-50 min-h-dvh">
      <div className="mx-auto max-w-xl px-5 pt-32 pb-24 md:pt-48">
        <SignInForm />
      </div>
    </section>
  );
}
