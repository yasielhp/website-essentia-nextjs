"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function StaffIdRedirect() {
  const { replace } = useRouter();
  const { id } = useParams<{ id: string }>();
  useEffect(() => {
    replace(`/dashboard/users/${id}`);
  }, [replace, id]);
  return null;
}
