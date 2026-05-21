"use client";

import { useEffect, useReducer, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";
import {
  subscribeToNewsletter,
  unsubscribeFromNewsletter,
} from "@/actions/newsletter";
import { IconCheckmark, IconTrash } from "@/components/ui/icons";

const INPUT_CLASS =
  "border-sand-200 bg-white text-petroleum-700 placeholder:text-petroleum-300 focus:border-petroleum-400 focus:ring-petroleum-100 rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 w-full disabled:opacity-60";

type Contact = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  newsletter_subscribed: boolean | null;
};

type Booking = {
  id: string;
  service_title: string | null;
  date: string | null;
  time: string | null;
  status: string | null;
  created_at: string | null;
};

type RaceReg = {
  id: string;
  created_at: string | null;
  race_id: string;
  race: {
    title: string | null;
    date: string | null;
    location: string | null;
  } | null;
};

type EduReg = {
  id: string;
  created_at: string | null;
  session_id: string;
  session: {
    title: string | null;
    date: string | null;
    location: string | null;
  } | null;
};

// ─── Load reducer ─────────────────────────────────────────────

type LoadState = {
  loading: boolean;
  notFound: boolean;
  bookings: Booking[];
  raceRegs: RaceReg[];
  eduRegs: EduReg[];
};

type LoadAction =
  | {
      type: "LOADED";
      bookings: Booking[];
      raceRegs: RaceReg[];
      eduRegs: EduReg[];
    }
  | { type: "NOT_FOUND" };

const initialLoadState: LoadState = {
  loading: true,
  notFound: false,
  bookings: [],
  raceRegs: [],
  eduRegs: [],
};

function loadReducer(state: LoadState, action: LoadAction): LoadState {
  switch (action.type) {
    case "LOADED":
      return {
        loading: false,
        notFound: false,
        bookings: action.bookings,
        raceRegs: action.raceRegs,
        eduRegs: action.eduRegs,
      };
    case "NOT_FOUND":
      return { ...state, loading: false, notFound: true };
    default:
      return state;
  }
}

// ─── Form reducer ─────────────────────────────────────────────

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  newsletterSubscribed: boolean;
  error: string | null;
  saving: boolean;
  deleting: boolean;
  deleteOpen: boolean;
};

type FormAction =
  | {
      type: "INIT";
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      newsletterSubscribed: boolean;
    }
  | {
      type: "SET_FIELD";
      field: "firstName" | "lastName" | "email" | "phone";
      value: string;
    }
  | { type: "TOGGLE_NEWSLETTER" }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "SAVING_START" }
  | { type: "SAVING_END" }
  | { type: "DELETING_START" }
  | { type: "OPEN_DELETE" }
  | { type: "CLOSE_DELETE" };

const initialFormState: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  newsletterSubscribed: false,
  error: null,
  saving: false,
  deleting: false,
  deleteOpen: false,
};

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "INIT":
      return {
        ...state,
        firstName: action.firstName,
        lastName: action.lastName,
        email: action.email,
        phone: action.phone,
        newsletterSubscribed: action.newsletterSubscribed,
      };
    case "TOGGLE_NEWSLETTER":
      return { ...state, newsletterSubscribed: !state.newsletterSubscribed };
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "SET_ERROR":
      return { ...state, error: action.error };
    case "SAVING_START":
      return { ...state, saving: true, error: null };
    case "SAVING_END":
      return { ...state, saving: false };
    case "DELETING_START":
      return { ...state, deleting: true };
    case "OPEN_DELETE":
      return { ...state, deleteOpen: true };
    case "CLOSE_DELETE":
      return { ...state, deleteOpen: false };
    default:
      return state;
  }
}

// ─── Shared helpers ───────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-50 text-yellow-700",
  confirmed: "bg-green-50 text-green-700",
  cancelled: "bg-red-50 text-red-600",
};

function StatusBadge({ status }: { status: string | null }) {
  const s = status ?? "unknown";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[s] ?? "bg-sand-100 text-petroleum-500"}`}
    >
      {s}
    </span>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function RowSkeleton({ cols }: { cols: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="bg-sand-100 h-10 animate-pulse rounded-xl" />
      ))}
      <span className="sr-only">{cols}</span>
    </div>
  );
}

function DeleteDialog({
  name,
  deleting,
  onConfirm,
  onCancel,
}: {
  name: string;
  deleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex flex-col gap-1">
          <h3 className="font-display text-petroleum-700 text-xl">
            Delete contact?
          </h3>
          <p className="text-petroleum-400 text-sm">
            <strong className="text-petroleum-500 font-medium">{name}</strong>{" "}
            and all their associated bookings and registrations will be
            permanently deleted.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Button
            variant="danger"
            size="md"
            onClick={onConfirm}
            disabled={deleting}
            className="w-full"
          >
            {deleting ? "Deleting…" : "Yes, delete"}
          </Button>
          <Button
            variant="outline"
            size="md"
            onClick={onCancel}
            disabled={deleting}
            className="w-full"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Section components ───────────────────────────────────────

function ContactDetailsCard({
  firstName,
  lastName,
  email,
  phone,
  newsletterSubscribed,
  loading,
  saving,
  dispatchForm,
}: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  newsletterSubscribed: boolean;
  loading: boolean;
  saving: boolean;
  dispatchForm: React.Dispatch<FormAction>;
}) {
  function field(
    f: "firstName" | "lastName" | "email" | "phone",
    value: string,
  ) {
    dispatchForm({ type: "SET_FIELD", field: f, value });
  }

  return (
    <div className="border-sand-200 mb-6 rounded-2xl border bg-white p-6">
      <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">Details</h2>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="firstName"
              className="text-petroleum-500 text-xs font-medium"
            >
              First name <span className="text-red-400">*</span>
            </label>
            {loading ? (
              <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
            ) : (
              <input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => field("firstName", e.target.value)}
                placeholder="Jane"
                disabled={saving}
                className={INPUT_CLASS}
              />
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="lastName"
              className="text-petroleum-500 text-xs font-medium"
            >
              Last name
            </label>
            {loading ? (
              <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
            ) : (
              <input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => field("lastName", e.target.value)}
                placeholder="Doe"
                disabled={saving}
                className={INPUT_CLASS}
              />
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="email"
            className="text-petroleum-500 text-xs font-medium"
          >
            Email
          </label>
          {loading ? (
            <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
          ) : (
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => field("email", e.target.value)}
              placeholder="jane@example.com"
              disabled={saving}
              className={INPUT_CLASS}
            />
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="phone"
            className="text-petroleum-500 text-xs font-medium"
          >
            Phone
          </label>
          {loading ? (
            <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
          ) : (
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => field("phone", e.target.value)}
              placeholder="+34 600 000 000"
              disabled={saving}
              className={INPUT_CLASS}
            />
          )}
        </div>

        {loading ? (
          <div className="bg-sand-100 h-16 animate-pulse rounded-2xl" />
        ) : (
          <button
            type="button"
            disabled={saving}
            onClick={() => dispatchForm({ type: "TOGGLE_NEWSLETTER" })}
            className={[
              "flex w-full items-center justify-between rounded-2xl border p-4 text-left transition-all duration-200",
              newsletterSubscribed
                ? "border-petroleum-200 bg-petroleum-50"
                : "border-sand-200 bg-sand-50",
              saving ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
            ].join(" ")}
          >
            <div className="flex flex-col gap-0.5">
              <p className="text-petroleum-700 text-sm font-medium">Newsletter</p>
              <p className="text-petroleum-400 text-xs">
                {newsletterSubscribed ? "Subscribed" : "Not subscribed"}
              </p>
            </div>
            <div
              className={[
                "flex h-6 w-11 shrink-0 items-center rounded-full px-0.5 transition-colors duration-200",
                newsletterSubscribed ? "bg-petroleum-500" : "bg-sand-300",
              ].join(" ")}
            >
              <div
                className={[
                  "size-5 rounded-full bg-white shadow-sm transition-transform duration-200",
                  newsletterSubscribed ? "translate-x-5" : "translate-x-0",
                ].join(" ")}
              />
            </div>
          </button>
        )}
      </div>
    </div>
  );
}

function BookingsSection({
  loading,
  bookings,
}: {
  loading: boolean;
  bookings: Booking[];
}) {
  return (
    <div className="border-sand-200 rounded-2xl border bg-white p-6">
      <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
        Bookings
      </h2>
      {loading ? (
        <RowSkeleton cols={4} />
      ) : bookings.length === 0 ? (
        <p className="text-petroleum-300 text-sm">No bookings yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-sand-100 border-b text-left">
                {["Service", "Date", "Time", "Status"].map((h) => (
                  <th
                    key={h}
                    className="text-petroleum-400 pr-4 pb-2.5 font-medium"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr
                  key={b.id}
                  className="border-sand-50 border-b last:border-0"
                >
                  <td className="text-petroleum-700 py-3 pr-4 font-medium">
                    {b.service_title ?? "—"}
                  </td>
                  <td className="text-petroleum-500 py-3 pr-4">
                    {formatDate(b.date)}
                  </td>
                  <td className="text-petroleum-500 py-3 pr-4">
                    {b.time ?? "—"}
                  </td>
                  <td className="py-3">
                    <StatusBadge status={b.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RaceRegsSection({
  loading,
  raceRegs,
}: {
  loading: boolean;
  raceRegs: RaceReg[];
}) {
  return (
    <div className="border-sand-200 rounded-2xl border bg-white p-6">
      <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
        Race registrations
      </h2>
      {loading ? (
        <RowSkeleton cols={4} />
      ) : raceRegs.length === 0 ? (
        <p className="text-petroleum-300 text-sm">No race registrations yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-sand-100 border-b text-left">
                {["Race", "Date", "Location", "Registered"].map((h) => (
                  <th
                    key={h}
                    className="text-petroleum-400 pr-4 pb-2.5 font-medium"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {raceRegs.map((r) => (
                <tr
                  key={r.id}
                  className="border-sand-50 border-b last:border-0"
                >
                  <td className="text-petroleum-700 py-3 pr-4 font-medium">
                    {r.race?.title ?? "—"}
                  </td>
                  <td className="text-petroleum-500 py-3 pr-4">
                    {r.race?.date ? formatDate(r.race.date) : "—"}
                  </td>
                  <td className="text-petroleum-500 py-3 pr-4">
                    {r.race?.location ?? "—"}
                  </td>
                  <td className="text-petroleum-400 py-3">
                    {formatDate(r.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EduRegsSection({
  loading,
  eduRegs,
}: {
  loading: boolean;
  eduRegs: EduReg[];
}) {
  return (
    <div className="border-sand-200 rounded-2xl border bg-white p-6">
      <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
        Education sessions
      </h2>
      {loading ? (
        <RowSkeleton cols={4} />
      ) : eduRegs.length === 0 ? (
        <p className="text-petroleum-300 text-sm">
          No education session registrations yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-sand-100 border-b text-left">
                {["Session", "Date", "Location", "Registered"].map((h) => (
                  <th
                    key={h}
                    className="text-petroleum-400 pr-4 pb-2.5 font-medium"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {eduRegs.map((r) => (
                <tr
                  key={r.id}
                  className="border-sand-50 border-b last:border-0"
                >
                  <td className="text-petroleum-700 py-3 pr-4 font-medium">
                    {r.session?.title ?? "—"}
                  </td>
                  <td className="text-petroleum-500 py-3 pr-4">
                    {r.session?.date ? formatDate(r.session.date) : "—"}
                  </td>
                  <td className="text-petroleum-500 py-3 pr-4">
                    {r.session?.location ?? "—"}
                  </td>
                  <td className="text-petroleum-400 py-3">
                    {formatDate(r.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { push, back } = useRouter();

  const [loadState, dispatch] = useReducer(loadReducer, initialLoadState);
  const { loading, notFound, bookings, raceRegs, eduRegs } = loadState;

  const [form, dispatchForm] = useReducer(formReducer, initialFormState);
  const {
    firstName,
    lastName,
    email,
    phone,
    newsletterSubscribed,
    error,
    saving,
    deleting,
    deleteOpen,
  } = form;

  const originalNewsletter = useRef<boolean>(false);

  useEffect(() => {
    async function load() {
      const [
        { data: contacts },
        { data: bookingData },
        { data: raceRegData },
        { data: eduRegData },
      ] = await Promise.all([
        insforge.database
          .from("contacts")
          .select("id, first_name, last_name, email, phone, newsletter_subscribed")
          .eq("id", id)
          .limit(1),
        insforge.database
          .from("bookings")
          .select("id, service_title, date, time, status, created_at")
          .eq("contact_id", id)
          .order("created_at", { ascending: false }),
        insforge.database
          .from("race_registrations")
          .select("id, created_at, race_id")
          .eq("contact_id", id)
          .order("created_at", { ascending: false }),
        insforge.database
          .from("education_registrations")
          .select("id, created_at, session_id")
          .eq("contact_id", id)
          .order("created_at", { ascending: false }),
      ]);

      const contact = (contacts as Contact[] | null)?.[0];
      if (!contact) {
        dispatch({ type: "NOT_FOUND" });
        return;
      }

      const initialNewsletter = contact.newsletter_subscribed ?? false;
      originalNewsletter.current = initialNewsletter;
      dispatchForm({
        type: "INIT",
        firstName: contact.first_name ?? "",
        lastName: contact.last_name ?? "",
        email: contact.email ?? "",
        phone: contact.phone ?? "",
        newsletterSubscribed: initialNewsletter,
      });

      const raceRows =
        (raceRegData as
          | { id: string; created_at: string | null; race_id: string }[]
          | null) ?? [];
      const eduRows =
        (eduRegData as
          | { id: string; created_at: string | null; session_id: string }[]
          | null) ?? [];

      const raceIds = raceRows.map((r) => r.race_id);
      const sessionIds = eduRows.map((r) => r.session_id);

      const [{ data: racesData }, { data: sessionsData }] = await Promise.all([
        raceIds.length > 0
          ? insforge.database
              .from("races")
              .select("id, title, date, location")
              .in("id", raceIds)
          : Promise.resolve({ data: [] }),
        sessionIds.length > 0
          ? insforge.database
              .from("education_sessions")
              .select("id, title, date, location")
              .in("id", sessionIds)
          : Promise.resolve({ data: [] }),
      ]);

      const racesMap = new Map(
        (
          (racesData as {
            id: string;
            title: string | null;
            date: string | null;
            location: string | null;
          }[]) ?? []
        ).map((r) => [r.id, r]),
      );
      const sessionsMap = new Map(
        (
          (sessionsData as {
            id: string;
            title: string | null;
            date: string | null;
            location: string | null;
          }[]) ?? []
        ).map((s) => [s.id, s]),
      );

      dispatch({
        type: "LOADED",
        bookings: (bookingData as Booking[] | null) ?? [],
        raceRegs: raceRows.map((r) => ({
          ...r,
          race: racesMap.get(r.race_id) ?? null,
        })),
        eduRegs: eduRows.map((r) => ({
          ...r,
          session: sessionsMap.get(r.session_id) ?? null,
        })),
      });
    }

    void load();
  }, [id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    dispatchForm({ type: "SET_ERROR", error: null });

    const trimmedFirst = firstName.trim();
    if (!trimmedFirst) {
      dispatchForm({ type: "SET_ERROR", error: "First name is required." });
      return;
    }

    dispatchForm({ type: "SAVING_START" });

    const { error: updateError } = await insforge.database
      .from("contacts")
      .update({
        first_name: trimmedFirst,
        last_name: lastName.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        newsletter_subscribed: newsletterSubscribed,
      })
      .eq("id", id);

    dispatchForm({ type: "SAVING_END" });

    if (updateError) {
      dispatchForm({
        type: "SET_ERROR",
        error:
          (updateError as { message?: string })?.message ??
          "Failed to save contact.",
      });
      return;
    }

    // Sync Resend audience only when the newsletter status actually changed
    const trimmedEmail = email.trim();
    if (trimmedEmail && newsletterSubscribed !== originalNewsletter.current) {
      try {
        if (newsletterSubscribed) {
          await subscribeToNewsletter(trimmedEmail);
        } else {
          await unsubscribeFromNewsletter(trimmedEmail);
        }
        originalNewsletter.current = newsletterSubscribed;
      } catch {
        // fail-open: Resend sync failure must not block navigation
      }
    }

    push("/dashboard/contacts");
  }

  async function handleDelete() {
    dispatchForm({ type: "DELETING_START" });
    await Promise.all([
      insforge.database
        .from("race_registrations")
        .delete()
        .eq("contact_id", id),
      insforge.database
        .from("education_registrations")
        .delete()
        .eq("contact_id", id),
      insforge.database.from("bookings").delete().eq("contact_id", id),
    ]);
    await insforge.database.from("contacts").delete().eq("id", id);
    push("/dashboard/contacts");
  }

  const displayName =
    [firstName, lastName].filter(Boolean).join(" ") || "Contact";

  if (notFound) {
    return (
      <div className="text-petroleum-400 flex flex-col items-center justify-center py-24">
        <p className="text-sm">Contact not found.</p>
        <button
          onClick={() => back()}
          className="hover:text-petroleum-700 mt-4 text-xs underline"
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      <form onSubmit={(e) => void handleSave(e)} noValidate>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-display text-petroleum-700 text-3xl">
            Edit Contact
          </h1>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline-danger"
              size="md"
              onClick={() => dispatchForm({ type: "OPEN_DELETE" })}
              disabled={loading}
              className="gap-1.5"
            >
              <IconTrash />
              Delete
            </Button>
            <Button
              type="submit"
              variant="solid"
              size="md"
              disabled={saving || loading}
              className="gap-1.5"
            >
              <IconCheckmark />
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>

        {error && (
          <p className="mb-6 rounded-xl bg-red-100 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <ContactDetailsCard
          firstName={firstName}
          lastName={lastName}
          email={email}
          phone={phone}
          newsletterSubscribed={newsletterSubscribed}
          loading={loading}
          saving={saving}
          dispatchForm={dispatchForm}
        />
      </form>

      <div className="space-y-5">
        <BookingsSection loading={loading} bookings={bookings} />
        <RaceRegsSection loading={loading} raceRegs={raceRegs} />
        <EduRegsSection loading={loading} eduRegs={eduRegs} />
      </div>

      {deleteOpen && (
        <DeleteDialog
          name={displayName}
          deleting={deleting}
          onConfirm={() => void handleDelete()}
          onCancel={() => dispatchForm({ type: "CLOSE_DELETE" })}
        />
      )}
    </div>
  );
}
