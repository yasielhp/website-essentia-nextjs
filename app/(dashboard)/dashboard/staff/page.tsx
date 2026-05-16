"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";

const SERVICES = [
  { id: "contrast-therapy", title: "Contrast Therapy" },
  { id: "breathing-sessions", title: "Breathing Sessions" },
  { id: "red-light-therapy", title: "Red Light Therapy" },
  { id: "manual-therapies", title: "Manual Therapies" },
  { id: "functional-well-being", title: "Functional Well-being" },
  { id: "hyperbaric-chambers", title: "Hyperbaric Chambers" },
  { id: "intravenous-therapy", title: "Intravenous Therapy" },
  { id: "regenerative-medicine", title: "Regenerative Medicine" },
];

type StaffMember = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  services: string[];
};

function IconPlus() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const { push } = useRouter();

  const fetchStaff = useCallback(async () => {
    setLoading(true);

    const { data: profiles } = await insforge.database
      .from("profiles")
      .select("id, full_name, email, phone, avatar_url")
      .eq("role", "staff")
      .order("created_at", { ascending: false });

    if (!profiles || (profiles as unknown[]).length === 0) {
      setStaff([]);
      setLoading(false);
      return;
    }

    const profileList = profiles as {
      id: string;
      full_name: string | null;
      email: string | null;
      phone: string | null;
      avatar_url: string | null;
    }[];
    const ids = profileList.map((p) => p.id);

    const { data: staffServices } = await insforge.database
      .from("staff_services")
      .select("staff_id, service_id")
      .in("staff_id", ids);

    const serviceMap: Record<string, string[]> = {};
    if (staffServices) {
      for (const row of staffServices as {
        staff_id: string;
        service_id: string;
      }[]) {
        if (!serviceMap[row.staff_id]) serviceMap[row.staff_id] = [];
        serviceMap[row.staff_id].push(row.service_id);
      }
    }

    setStaff(
      profileList.map((p) => ({
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        phone: p.phone,
        avatar_url: p.avatar_url,
        services: serviceMap[p.id] ?? [],
      })),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchStaff();
  }, [fetchStaff]);

  function serviceLabel(id: string): string {
    return SERVICES.find((s) => s.id === id)?.title ?? id;
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-petroleum-700 text-3xl">Staff</h1>
        </div>

        <Button
          variant="solid"
          size="md"
          href="/dashboard/staff/new"
          className="gap-2 self-start"
        >
          <IconPlus />
          Add Staff Member
        </Button>
      </div>

      <div className="border-sand-200 rounded-2xl border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-sand-200 border-b text-left">
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  Name
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  Phone
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  Email
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  Services assigned
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-sand-50 border-b">
                    {Array.from({ length: 4 }).map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="bg-sand-100 h-4 animate-pulse rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : staff.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="text-petroleum-400 px-6 py-12 text-center"
                  >
                    No staff members yet.
                  </td>
                </tr>
              ) : (
                staff.map((member) => (
                  <tr
                    key={member.id}
                    onClick={() => push(`/dashboard/staff/${member.id}`)}
                    className="border-sand-50 hover:bg-sand-50 cursor-pointer border-b transition-colors"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {member.avatar_url ? (
                          <div className="bg-sand-100 relative size-10 shrink-0 overflow-hidden rounded-lg">
                            <Image
                              src={member.avatar_url}
                              alt={member.full_name ?? ""}
                              fill
                              sizes="40px"
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div className="bg-sand-100 flex size-10 shrink-0 items-center justify-center rounded-lg">
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              className="text-petroleum-300"
                            >
                              <circle
                                cx="12"
                                cy="8"
                                r="4"
                                stroke="currentColor"
                                strokeWidth="1.5"
                              />
                              <path
                                d="M4 20c0-4 3.6-7 8-7s8 3 8 7"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                              />
                            </svg>
                          </div>
                        )}
                        <span className="text-petroleum-700 font-medium">
                          {member.full_name ?? "—"}
                        </span>
                      </div>
                    </td>
                    <td className="text-petroleum-500 px-5 py-4">
                      {member.phone ?? (
                        <span className="text-petroleum-300">{"—"}</span>
                      )}
                    </td>
                    <td className="text-petroleum-500 px-5 py-4">
                      {member.email ?? (
                        <span className="text-petroleum-300">{"—"}</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {member.services.length === 0 ? (
                        <span className="text-petroleum-300">{"—"}</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {member.services.map((sid) => (
                            <span
                              key={sid}
                              className="bg-petroleum-50 text-petroleum-700 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs"
                            >
                              {serviceLabel(sid)}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
