"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/dashboard/pagination";

type Member = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  plan: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
};

const PAGE_SIZE = 20;

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  expired: "bg-sand-100 text-petroleum-400",
  cancelled: "bg-red-50 text-red-500",
};

const PLAN_STYLES: Record<string, string> = {
  essential: "bg-sand-100 text-petroleum-500",
  premium: "bg-blue-50 text-blue-700",
  founder: "bg-purple-50 text-purple-700",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function IconPlus() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [activeCount, setActiveCount] = useState<number | null>(null);
  const { push } = useRouter();

  useEffect(() => {
    async function run() {
      setLoading(true);

      const [listRes, activeRes] = await Promise.all([
        insforge.database
          .from("memberships")
          .select(
            "id, first_name, last_name, email, phone, plan, status, start_date, end_date, created_at",
            { count: "exact" },
          )
          .order("created_at", { ascending: false })
          .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1),
        page === 0
          ? insforge.database
              .from("memberships")
              .select("id", { count: "exact", head: true })
              .eq("status", "active")
          : Promise.resolve(null),
      ]);

      setMembers((listRes.data as Member[] | null) ?? []);
      setTotal(listRes.count ?? 0);
      if (activeRes && "count" in activeRes) {
        setActiveCount((activeRes as { count: number | null }).count ?? 0);
      }
      setLoading(false);
    }
    void run();
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="px-6 py-8 lg:px-10">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-petroleum-700 text-3xl">Members</h1>
          {activeCount !== null && (
            <p className="text-petroleum-400 mt-1 text-sm">
              {activeCount} active membership{activeCount !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        <Button
          onClick={() => push("/dashboard/members/new")}
          className="flex items-center gap-2"
        >
          <IconPlus />
          New Member
        </Button>
      </div>

      {/* Table */}
      <div className="border-sand-200 overflow-hidden rounded-2xl border bg-white">
        {loading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-sand-100 h-10 animate-pulse rounded-xl"
              />
            ))}
          </div>
        ) : members.length === 0 ? (
          <div className="text-petroleum-300 py-20 text-center text-sm">
            No members yet.
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-sand-100 border-b">
                    <th className="text-petroleum-400 px-5 py-3 text-left text-xs font-medium">
                      Name
                    </th>
                    <th className="text-petroleum-400 px-5 py-3 text-left text-xs font-medium">
                      Contact
                    </th>
                    <th className="text-petroleum-400 px-5 py-3 text-left text-xs font-medium">
                      Plan
                    </th>
                    <th className="text-petroleum-400 px-5 py-3 text-left text-xs font-medium">
                      Status
                    </th>
                    <th className="text-petroleum-400 px-5 py-3 text-left text-xs font-medium">
                      Start
                    </th>
                    <th className="text-petroleum-400 px-5 py-3 text-left text-xs font-medium">
                      Expires
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr
                      key={m.id}
                      onClick={() => push(`/dashboard/members/${m.id}`)}
                      className="border-sand-100 hover:bg-sand-50 cursor-pointer border-b transition-colors last:border-0"
                    >
                      <td className="text-petroleum-700 px-5 py-3.5 font-medium">
                        {m.first_name} {m.last_name}
                      </td>
                      <td className="text-petroleum-500 px-5 py-3.5">
                        <div>{m.email ?? "—"}</div>
                        {m.phone && (
                          <div className="text-petroleum-400 text-xs">
                            {m.phone}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${PLAN_STYLES[m.plan] ?? "bg-sand-100 text-petroleum-500"}`}
                        >
                          {m.plan}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[m.status] ?? "bg-sand-100 text-petroleum-400"}`}
                        >
                          {m.status}
                        </span>
                      </td>
                      <td className="text-petroleum-500 px-5 py-3.5 text-xs">
                        {formatDate(m.start_date)}
                      </td>
                      <td className="text-petroleum-500 px-5 py-3.5 text-xs">
                        {formatDate(m.end_date)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="divide-sand-100 divide-y md:hidden">
              {members.map((m) => (
                <button
                  key={m.id}
                  onClick={() => push(`/dashboard/members/${m.id}`)}
                  className="hover:bg-sand-50 flex w-full items-center justify-between px-5 py-4 text-left transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-petroleum-700 truncate font-medium">
                      {m.first_name} {m.last_name}
                    </p>
                    <p className="text-petroleum-400 truncate text-xs">
                      {m.email ?? m.phone ?? "—"}
                    </p>
                  </div>
                  <div className="ml-4 flex shrink-0 flex-col items-end gap-1">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${STATUS_STYLES[m.status] ?? "bg-sand-100 text-petroleum-400"}`}
                    >
                      {m.status}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${PLAN_STYLES[m.plan] ?? "bg-sand-100 text-petroleum-500"}`}
                    >
                      {m.plan}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            <Pagination
              page={page}
              totalPages={totalPages}
              onPage={setPage}
              loading={loading}
            />
          </>
        )}
      </div>
    </div>
  );
}
