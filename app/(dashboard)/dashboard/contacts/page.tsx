"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ContactsRedirect() {
  const { replace } = useRouter();
  useEffect(() => {
    replace("/dashboard/users");
  }, [replace]);
  return null;
}
