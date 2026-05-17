"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "@/components/ui/image-upload";
import { sendEmail } from "@/emails/send";
import { INPUT_CLASS } from "@/constants/form-styles";

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

export default function NewStaffPage() {
  const { push } = useRouter();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [services, setServices] = useState<string[]>([]);

  function toggleService(id: string) {
    setServices((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    const trimmedEmail = email.trim();

    if (!trimmedFirst || !trimmedEmail) {
      setError("First name and email are required.");
      return;
    }

    setSubmitting(true);

    const fullName = [trimmedFirst, trimmedLast].filter(Boolean).join(" ");

    const tempPassword =
      "Essentia" + Math.random().toString(36).slice(2, 10).toUpperCase() + "!";

    const { data, error: signUpError } = await insforge.auth.signUp({
      email: trimmedEmail,
      password: tempPassword,
      name: fullName,
    });

    const userId = (data as { user?: { id: string } } | null)?.user?.id;

    if (!userId) {
      const errMsg =
        (signUpError as { message?: string } | null)?.message ??
        "Failed to create account.";
      setError(
        errMsg.toLowerCase().includes("already")
          ? "An account with this email already exists."
          : errMsg,
      );
      setSubmitting(false);
      return;
    }

    await insforge.database.from("profiles").upsert([
      {
        id: userId,
        role: "staff",
        first_name: trimmedFirst,
        last_name: trimmedLast || null,
        full_name: fullName,
        email: trimmedEmail,
        phone: phone.trim() || null,
        avatar_url: avatarUrl || null,
      },
    ]);

    if (services.length > 0) {
      await insforge.database
        .from("staff_services")
        .insert(
          services.map((service_id) => ({ staff_id: userId, service_id })),
        );
    }

    await sendEmail({
      to: trimmedEmail,
      subject: "Welcome to Essentia — Your staff account",
      html: welcomeStaffEmail({
        name: fullName,
        email: trimmedEmail,
        tempPassword,
      }),
    });

    setSubmitting(false);
    push("/dashboard/settings");
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      <form onSubmit={(e) => void handleSubmit(e)} noValidate>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-display text-petroleum-700 text-3xl">
            New Staff Member
          </h1>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="md" href="/dashboard/settings">
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
        </div>

        {error && (
          <p className="mb-6 rounded-xl bg-red-100 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <div className="border-sand-200 rounded-2xl border bg-white p-6">
              <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
                Details
              </h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="firstName"
                      className="text-petroleum-500 text-xs font-medium"
                    >
                      First name <span className="text-red-400">*</span>
                    </label>
                    <input
                      id="firstName"
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Jane"
                      disabled={submitting}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="lastName"
                      className="text-petroleum-500 text-xs font-medium"
                    >
                      Last name
                    </label>
                    <input
                      id="lastName"
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Doe"
                      disabled={submitting}
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="email"
                    className="text-petroleum-500 text-xs font-medium"
                  >
                    Email <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jane@essentia.com"
                    disabled={submitting}
                    className={INPUT_CLASS}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="phone"
                    className="text-petroleum-500 text-xs font-medium"
                  >
                    Phone
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+34 600 000 000"
                    disabled={submitting}
                    className={INPUT_CLASS}
                  />
                </div>
              </div>
            </div>

            <div className="border-sand-200 rounded-2xl border bg-white p-6">
              <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
                Services assigned
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {SERVICES.map((service) => {
                  const checked = services.includes(service.id);
                  return (
                    <label
                      key={service.id}
                      className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition-colors ${
                        checked
                          ? "border-petroleum-400 bg-petroleum-50 text-petroleum-700"
                          : "border-sand-200 text-petroleum-500 hover:border-sand-400 hover:bg-sand-50 bg-white"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleService(service.id)}
                        disabled={submitting}
                        className="accent-petroleum-700 size-3.5"
                      />
                      {service.title}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="border-sand-200 rounded-2xl border bg-white p-6">
              <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
                Photo
              </h2>
              <ImageUpload
                bucket="events"
                folder="staff"
                value={avatarUrl}
                onChange={setAvatarUrl}
              />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
