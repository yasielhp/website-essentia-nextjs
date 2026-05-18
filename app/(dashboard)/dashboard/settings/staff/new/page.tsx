"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function StaffNewRedirect() {
  const { replace } = useRouter();
  useEffect(() => {
    replace("/dashboard/users/new");
  }, [replace]);
  return null;
}
