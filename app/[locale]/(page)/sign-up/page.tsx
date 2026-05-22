import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import SignUpForm from "@components/auth/sign-up-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.signUp.meta");
  return {
    title: t("title"),
  };
}

export default function SignUpPage() {
  return (
    <section className="bg-sand-50 min-h-dvh">
      <div className="mx-auto max-w-md px-5 pt-32 pb-24 md:pt-48">
        <SignUpForm />
      </div>
    </section>
  );
}
