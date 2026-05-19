"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { insforge } from "@/lib/insforge";

type Race = {
  id: string;
  title: string;
  date: string | null;
  seats_per_table: number | null;
};

type Registration = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  table_number: number | null;
  checked_in_at: string | null;
};

type SearchResult = Registration & { matchScore: number };

function TableBadge({ tableNumber }: { tableNumber: number | null }) {
  if (tableNumber == null) {
    return (
      <div className="text-petroleum-400 flex flex-col items-center">
        <span className="text-6xl font-bold tabular-nums">—</span>
        <span className="mt-1 text-sm">No table assigned</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center">
      <span className="text-petroleum-300 text-sm font-medium tracking-widest uppercase">
        Mesa
      </span>
      <span className="font-display text-petroleum-700 text-[88px] leading-none tabular-nums">
        {tableNumber}
      </span>
    </div>
  );
}

function CheckInCard({
  registration,
  onCheckIn,
  checkingIn,
}: {
  registration: Registration;
  onCheckIn: (id: string) => void;
  checkingIn: boolean;
}) {
  const isCheckedIn = !!registration.checked_in_at;

  return (
    <div
      className={`rounded-3xl border-2 p-8 text-center shadow-lg ${
        isCheckedIn
          ? "border-green-200 bg-green-50"
          : "border-sand-200 bg-white"
      }`}
    >
      {/* Name */}
      <h2 className="text-petroleum-700 text-2xl font-semibold">
        {registration.full_name ?? "—"}
      </h2>
      {registration.email && (
        <p className="text-petroleum-400 mt-1 text-sm">{registration.email}</p>
      )}

      {/* Table number — the main event */}
      <div className="my-8">
        <TableBadge tableNumber={registration.table_number} />
      </div>

      {/* Check-in status */}
      {isCheckedIn ? (
        <div className="inline-flex items-center gap-2 rounded-full bg-green-100 px-5 py-2 text-sm font-medium text-green-700">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M20 6L9 17l-5-5"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Entrada verificada ·{" "}
          {new Date(registration.checked_in_at!).toLocaleTimeString("es-ES", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      ) : (
        <button
          type="button"
          disabled={checkingIn}
          onClick={() => onCheckIn(registration.id)}
          className="bg-petroleum-700 hover:bg-petroleum-800 inline-flex items-center gap-2 rounded-full px-8 py-3 text-sm font-medium text-white transition-colors disabled:opacity-50"
        >
          {checkingIn ? (
            <>
              <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Verificando…
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M20 6L9 17l-5-5"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Verificar entrada
            </>
          )}
        </button>
      )}
    </div>
  );
}

export default function CheckInPage() {
  const { id } = useParams<{ id: string }>();
  const { back } = useRouter();

  const [race, setRace] = useState<Race | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Registration | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    const { data: raceData } = await insforge.database
      .from("races")
      .select("id, title, date, seats_per_table")
      .eq("id", id)
      .limit(1);

    const raceRow = (raceData as Race[] | null)?.[0];
    if (!raceRow) {
      setLoading(false);
      return;
    }
    setRace(raceRow);

    const { data: regs } = await insforge.database
      .from("race_registrations")
      .select(
        "id, contact_id, user_id, table_number, checked_in_at, created_at",
      )
      .eq("race_id", id)
      .order("table_number", { ascending: true });

    if (!regs || (regs as unknown[]).length === 0) {
      setRegistrations([]);
      setLoading(false);
      return;
    }

    const regList = regs as {
      id: string;
      contact_id: string | null;
      user_id: string | null;
      table_number: number | null;
      checked_in_at: string | null;
    }[];

    const contactIds = regList.flatMap((r) =>
      r.contact_id ? [r.contact_id] : [],
    );
    const userIds = regList.flatMap((r) => (r.user_id ? [r.user_id] : []));

    const contactMap: Record<
      string,
      { full_name: string | null; email: string | null; phone: string | null }
    > = {};
    const profileMap: Record<
      string,
      { full_name: string | null; email: string | null }
    > = {};

    if (contactIds.length > 0) {
      const { data } = await insforge.database
        .from("contacts")
        .select("id, first_name, last_name, email, phone")
        .in("id", contactIds);
      if (data) {
        for (const c of data as {
          id: string;
          first_name: string | null;
          last_name: string | null;
          email: string | null;
          phone: string | null;
        }[]) {
          contactMap[c.id] = {
            full_name:
              [c.first_name, c.last_name].filter(Boolean).join(" ") || null,
            email: c.email,
            phone: c.phone,
          };
        }
      }
    }

    if (userIds.length > 0) {
      const { data } = await insforge.database
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      if (data) {
        for (const p of data as {
          id: string;
          full_name: string | null;
          email: string | null;
        }[]) {
          profileMap[p.id] = { full_name: p.full_name, email: p.email };
        }
      }
    }

    setRegistrations(
      regList.map((r) => {
        const c = r.contact_id ? contactMap[r.contact_id] : null;
        const p = r.user_id ? profileMap[r.user_id] : null;
        return {
          id: r.id,
          full_name: c?.full_name ?? p?.full_name ?? null,
          email: c?.email ?? p?.email ?? null,
          phone: c?.phone ?? null,
          table_number: r.table_number,
          checked_in_at: r.checked_in_at,
        };
      }),
    );
    setLoading(false);
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleCheckIn(regId: string) {
    setCheckingIn(true);
    const now = new Date().toISOString();
    await insforge.database
      .from("race_registrations")
      .update({ checked_in_at: now })
      .eq("id", regId);
    setRegistrations((prev) =>
      prev.map((r) => (r.id === regId ? { ...r, checked_in_at: now } : r)),
    );
    if (selected?.id === regId) {
      setSelected((prev) => (prev ? { ...prev, checked_in_at: now } : prev));
    }
    setCheckingIn(false);
  }

  const q = query.trim().toLowerCase();
  const results: SearchResult[] = q
    ? registrations
        .map((r) => {
          const name = (r.full_name ?? "").toLowerCase();
          const email = (r.email ?? "").toLowerCase();
          const phone = (r.phone ?? "").toLowerCase();
          let score = 0;
          if (name.startsWith(q)) score = 3;
          else if (name.includes(q)) score = 2;
          else if (email.includes(q) || phone.includes(q)) score = 1;
          return { ...r, matchScore: score };
        })
        .filter((r) => r.matchScore > 0)
        .sort((a, b) => b.matchScore - a.matchScore)
    : [];

  const checkedInCount = registrations.filter((r) => r.checked_in_at).length;

  return (
    <div className="flex min-h-screen flex-col px-6 py-8 lg:px-10">
      {/* Header */}
      <div className="mb-8 flex items-center gap-4">
        <button
          onClick={() => back()}
          className="text-petroleum-400 hover:text-petroleum-700 transition-colors"
          aria-label="Go back"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M19 12H5M12 19l-7-7 7-7"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <div>
          <h1 className="font-display text-petroleum-700 text-2xl">
            Verificación de entradas
          </h1>
          {race && (
            <p className="text-petroleum-400 mt-0.5 text-sm">
              {race.title} · {checkedInCount}/{registrations.length} verificados
            </p>
          )}
        </div>
      </div>

      <div className="mx-auto w-full max-w-lg">
        {/* Search input */}
        <div className="relative mb-6">
          <span className="text-petroleum-300 pointer-events-none absolute top-1/2 left-4 -translate-y-1/2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle
                cx="11"
                cy="11"
                r="8"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M21 21l-4.35-4.35"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(null);
            }}
            placeholder="Buscar por nombre, email o teléfono…"
            className="border-sand-200 text-petroleum-700 placeholder:text-petroleum-300 focus:border-petroleum-400 focus:ring-petroleum-100 w-full rounded-2xl border bg-white py-4 pr-4 pl-12 text-base outline-none focus:ring-2"
          />
        </div>

        {/* Search results dropdown */}
        {results.length > 0 && !selected && (
          <div className="border-sand-200 mb-4 overflow-hidden rounded-2xl border bg-white shadow-md">
            {results.slice(0, 8).map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setSelected(r);
                  setQuery(r.full_name ?? "");
                }}
                className="hover:bg-sand-50 flex w-full items-center justify-between px-5 py-3.5 text-left transition-colors"
              >
                <div>
                  <p className="text-petroleum-700 text-sm font-medium">
                    {r.full_name ?? "—"}
                  </p>
                  {r.email && (
                    <p className="text-petroleum-400 text-xs">{r.email}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {r.table_number != null && (
                    <span className="bg-petroleum-100 text-petroleum-500 rounded-full px-2.5 py-0.5 text-xs font-medium">
                      Mesa {r.table_number}
                    </span>
                  )}
                  {r.checked_in_at && (
                    <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                      ✓ Verificado
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* No results */}
        {q && results.length === 0 && !selected && !loading && (
          <p className="text-petroleum-400 py-4 text-center text-sm">
            No se encontró ningún registro.
          </p>
        )}

        {/* Check-in card */}
        {selected && (
          <CheckInCard
            registration={selected}
            onCheckIn={(regId) => void handleCheckIn(regId)}
            checkingIn={checkingIn}
          />
        )}

        {/* Loading state */}
        {loading && (
          <div className="space-y-3 py-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="bg-sand-100 h-14 animate-pulse rounded-2xl"
              />
            ))}
          </div>
        )}

        {/* Summary table */}
        {!loading && !selected && !q && registrations.length > 0 && (
          <div className="border-sand-200 overflow-hidden rounded-2xl border bg-white">
            <div className="border-sand-100 border-b px-5 py-3">
              <p className="text-petroleum-500 text-sm font-medium">
                Todas las registraciones
              </p>
            </div>
            <div className="divide-sand-100 divide-y">
              {registrations.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setSelected(r);
                    setQuery(r.full_name ?? "");
                  }}
                  className="hover:bg-sand-50 flex w-full items-center justify-between px-5 py-3 text-left transition-colors"
                >
                  <div>
                    <p className="text-petroleum-700 text-sm font-medium">
                      {r.full_name ?? "—"}
                    </p>
                    {r.email && (
                      <p className="text-petroleum-400 text-xs">{r.email}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {r.table_number != null && (
                      <span className="bg-petroleum-100 text-petroleum-500 rounded-full px-2.5 py-0.5 text-xs font-medium">
                        Mesa {r.table_number}
                      </span>
                    )}
                    {r.checked_in_at ? (
                      <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                        ✓
                      </span>
                    ) : (
                      <span className="bg-sand-100 text-petroleum-400 rounded-full px-2.5 py-0.5 text-xs">
                        Pendiente
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
