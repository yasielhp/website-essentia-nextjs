"use client";

import { useEffect, useRef, useState } from "react";
import {
  IconChevronsUpDown,
  IconEdit,
  IconLogOut,
} from "@/components/ui/icons";
import { avatarInitials } from "@/utils/avatar";

type UserMenuProps = {
  displayName: string;
  email: string;
  role: string;
  onSignOut: () => void;
  onEditAccount: () => void;
};

export function UserMenu({
  displayName,
  email,
  role,
  onSignOut,
  onEditAccount,
}: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const initials = avatarInitials(displayName);

  return (
    <div ref={ref} className="relative">
      {open && (
        <div className="border-sand-200 absolute right-0 bottom-full left-0 mb-2 overflow-hidden rounded-2xl border bg-white shadow-lg">
          <div className="border-sand-100 flex items-center gap-3 border-b px-4 py-3">
            <div className="bg-petroleum-700 flex size-9 shrink-0 items-center justify-center rounded-full">
              <span className="text-xs font-semibold text-white">
                {initials}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-petroleum-400 truncate text-xs">{email}</p>
              <p className="text-petroleum-300 mt-0.5 text-xs capitalize">
                {role}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setOpen(false);
              onEditAccount();
            }}
            className="text-petroleum-600 hover:bg-sand-50 flex w-full items-center gap-2.5 px-4 py-2.5 text-sm transition-colors"
          >
            <IconEdit />
            Edit account
          </button>
          <button
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 transition-colors hover:bg-red-50"
          >
            <IconLogOut />
            Sign out
          </button>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="border-sand-200 hover:bg-sand-50 flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors"
      >
        <div className="bg-petroleum-700 flex size-8 shrink-0 items-center justify-center rounded-full">
          <span className="text-xs font-semibold text-white">{initials}</span>
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p className="text-petroleum-700 truncate text-sm leading-none font-medium">
            {email}
          </p>
          <p className="text-petroleum-400 mt-1 text-xs leading-none capitalize">
            {role}
          </p>
        </div>
        <span className="text-petroleum-400 shrink-0">
          <IconChevronsUpDown />
        </span>
      </button>
    </div>
  );
}
