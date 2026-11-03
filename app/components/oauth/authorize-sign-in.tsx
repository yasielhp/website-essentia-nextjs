"use client";

import { useRouter } from "next/navigation";
import SignInForm from "@/components/auth/sign-in-form";

/**
 * The site's own sign-in form, with one difference: when it succeeds it asks
 * the server to render the page again — now with a session — instead of
 * sending the person to their dashboard.
 */
export function AuthorizeSignIn() {
  const { refresh } = useRouter();
  return <SignInForm onSignedIn={refresh} />;
}
