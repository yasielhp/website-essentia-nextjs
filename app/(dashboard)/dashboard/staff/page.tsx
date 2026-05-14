"use client";

import { useEffect, useState, useCallback } from "react";
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
  created_at: string | null;
  services: string[];
};

function welcomeStaffEmail({
  name,
  email,
  tempPassword,
}: {
  name: string;
  email: string;
  tempPassword: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#faf8f5;font-family:system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:1px solid #e6e3da;padding:40px;">
        <tr><td>
          <p style="margin:0 0 8px;font-size:22px;color:#103838;font-weight:600;">Welcome to Essentia, ${name}</p>
          <p style="margin:0 0 24px;font-size:14px;color:#4a6767;">Your staff account has been created. Here are your login credentials:</p>
          <table cellpadding="0" cellspacing="0" style="background:#f0ede6;border-radius:12px;padding:20px;width:100%;margin-bottom:24px;">
            <tr><td>
              <p style="margin:0 0 8px;font-size:13px;color:#4a6767;">Email</p>
              <p style="margin:0 0 16px;font-size:15px;color:#103838;font-weight:500;">${email}</p>
              <p style="margin:0 0 8px;font-size:13px;color:#4a6767;">Temporary Password</p>
              <p style="margin:0;font-size:15px;color:#103838;font-weight:500;font-family:monospace;">${tempPassword}</p>
            </td></tr>
          </table>
          <p style="margin:0 0 8px;font-size:13px;color:#4a6767;">Please change your password after your first sign-in.</p>
          <p style="margin:24px 0 0;font-size:12px;color:#b4a388;">Essentia — Longevity Center &amp; Social Wellness Club</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

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

function IconTrash() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconClose() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M18 6L6 18M6 6l12 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formServices, setFormServices] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const fetchStaff = useCallback(async () => {
    setLoading(true);

    const { data: profiles } = await insforge.database
      .from("profiles")
      .select("id, full_name, created_at")
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
      created_at: string | null;
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
        created_at: p.created_at,
        services: serviceMap[p.id] ?? [],
      })),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchStaff();
  }, [fetchStaff]);

  function openModal() {
    setFormName("");
    setFormEmail("");
    setFormServices([]);
    setFormError(null);
    setFormSuccess(null);
    setModalOpen(true);
  }

  function closeModal() {
    if (submitting) return;
    setModalOpen(false);
  }

  function toggleService(id: string) {
    setFormServices((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const name = formName.trim();
    const email = formEmail.trim();

    if (!name || !email) {
      setFormError("Name and email are required.");
      return;
    }

    setSubmitting(true);

    const tempPassword =
      "Essentia" + Math.random().toString(36).slice(2, 10).toUpperCase() + "!";

    const { data, error } = await insforge.auth.signUp({
      email,
      password: tempPassword,
      name,
    });

    const userId = (data as { user?: { id: string } } | null)?.user?.id;

    if (!userId) {
      const errMsg =
        (error as { message?: string } | null)?.message ??
        "Failed to create account.";
      if (errMsg.toLowerCase().includes("already")) {
        setFormError("An account with this email already exists.");
      } else {
        setFormError(errMsg);
      }
      setSubmitting(false);
      return;
    }

    await insforge.database
      .from("profiles")
      .upsert([{ id: userId, role: "staff", full_name: name }]);

    if (formServices.length > 0) {
      await insforge.database
        .from("staff_services")
        .insert(
          formServices.map((service_id) => ({ staff_id: userId, service_id })),
        );
    }

    await insforge.emails.send({
      to: email,
      subject: "Welcome to Essentia — Your staff account",
      html: welcomeStaffEmail({ name, email, tempPassword }),
    });

    const requiresVerification =
      (error as { message?: string } | null)?.message
        ?.toLowerCase()
        .includes("email") ?? false;

    setSubmitting(false);

    if (requiresVerification) {
      setFormSuccess(
        "Account created. Staff member needs to verify their email.",
      );
    } else {
      setModalOpen(false);
    }

    void fetchStaff();
  }

  async function handleRemove(id: string) {
    setDeletingId(id);
    await insforge.database
      .from("profiles")
      .update({ role: "contact" })
      .eq("id", id);
    setDeletingId(null);
    void fetchStaff();
  }

  function serviceLabel(id: string): string {
    return SERVICES.find((s) => s.id === id)?.title ?? id;
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-petroleum-700 text-3xl">Staff</h1>
          <p className="text-petroleum-400 mt-1 text-sm">
            {loading
              ? "Loading…"
              : `${staff.length} staff member${staff.length !== 1 ? "s" : ""}`}
          </p>
        </div>

        <Button
          variant="solid"
          size="md"
          onClick={openModal}
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
                  ID
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  Services assigned
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  Created
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-sand-50 border-b">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="bg-sand-100 h-4 animate-pulse rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : staff.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="text-petroleum-400 px-6 py-12 text-center"
                  >
                    No staff members yet.
                  </td>
                </tr>
              ) : (
                staff.map((member) => (
                  <tr
                    key={member.id}
                    className="border-sand-50 hover:bg-sand-50 border-b transition-colors"
                  >
                    <td className="text-petroleum-700 px-5 py-4 font-medium">
                      {member.full_name ?? "—"}
                    </td>
                    <td className="text-petroleum-400 px-5 py-4 font-mono text-xs">
                      {member.id.slice(0, 8)}…
                    </td>
                    <td className="px-5 py-4">
                      {member.services.length === 0 ? (
                        <span className="text-petroleum-400">—</span>
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
                    <td className="text-petroleum-500 px-5 py-4">
                      {formatDate(member.created_at)}
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => void handleRemove(member.id)}
                        disabled={deletingId === member.id}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-red-400 px-3 py-1.5 text-xs text-red-500 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <IconTrash />
                        {deletingId === member.id ? "Removing…" : "Remove"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={closeModal}
        >
          <div
            className="mx-4 w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-petroleum-700 text-xl">
                Add Staff Member
              </h2>
              <button
                onClick={closeModal}
                disabled={submitting}
                className="text-petroleum-400 hover:bg-sand-100 hover:text-petroleum-700 rounded-lg p-1.5 transition-colors disabled:opacity-50"
                aria-label="Close"
              >
                <IconClose />
              </button>
            </div>

            <form onSubmit={(e) => void handleSubmit(e)} noValidate>
              <div className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-petroleum-500 text-xs font-medium">
                    Full name
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Jane Doe"
                    disabled={submitting}
                    className="border-sand-200 text-petroleum-700 placeholder:text-petroleum-100 focus:border-petroleum-400 focus:ring-petroleum-100 rounded-xl border bg-white px-4 py-3 text-sm outline-none focus:ring-2 disabled:opacity-60"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-petroleum-500 text-xs font-medium">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="jane@essentia.com"
                    disabled={submitting}
                    className="border-sand-200 text-petroleum-700 placeholder:text-petroleum-100 focus:border-petroleum-400 focus:ring-petroleum-100 rounded-xl border bg-white px-4 py-3 text-sm outline-none focus:ring-2 disabled:opacity-60"
                    required
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-petroleum-500 text-xs font-medium">
                    Services
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {SERVICES.map((service) => {
                      const checked = formServices.includes(service.id);
                      return (
                        <label
                          key={service.id}
                          className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition-colors ${
                            checked
                              ? "border-petroleum-400 bg-petroleum-50 text-petroleum-700"
                              : "border-sand-200 text-petroleum-500 hover:border-sand-500 hover:bg-sand-50 bg-white"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleService(service.id)}
                            disabled={submitting}
                            className="accent-petroleum-700 h-3.5 w-3.5"
                          />
                          {service.title}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              {formError && (
                <p className="mt-4 rounded-xl bg-red-100 px-4 py-3 text-sm text-red-600">
                  {formError}
                </p>
              )}

              {formSuccess && (
                <p className="bg-petroleum-50 text-petroleum-700 mt-4 rounded-xl px-4 py-3 text-sm">
                  {formSuccess}
                </p>
              )}

              <div className="mt-6 flex justify-end gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="md"
                  onClick={closeModal}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="solid"
                  size="md"
                  disabled={submitting}
                >
                  {submitting ? "Creating…" : "Add Staff Member"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
