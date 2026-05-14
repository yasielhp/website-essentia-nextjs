import type { Metadata } from "next";
import SignInForm from "@components/auth/sign-in-form";

export const metadata: Metadata = {
  title: "Sign In",
};

export default function SignInPage() {
  return (
    <section className="bg-sand-50 min-h-dvh">
      <div className="mx-auto max-w-md px-5 pt-32 pb-24 md:pt-48">
        <SignInForm />
      </div>
    </section>
  );
}
