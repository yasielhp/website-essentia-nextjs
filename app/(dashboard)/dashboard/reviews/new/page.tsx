"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";
import { IconArrowLeft } from "@/components/ui/icons";

const fieldCls =
  "border-sand-200 text-petroleum-500 placeholder:text-petroleum-300 w-full rounded-xl border bg-white px-3 py-2.5 text-sm focus:outline-none focus:border-petroleum-300";

function computeInitials(name: string): string {
  const parts = name
    .replace(/^(Dr\.|Dra\.|Prof\.)\s*/i, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return (parts[0]![0] ?? "").toUpperCase();
  return (
    (parts[0]![0] ?? "").toUpperCase() +
    (parts[parts.length - 1]![0] ?? "").toUpperCase()
  );
}

export default function NewReviewPage() {
  const { push } = useRouter();

  const [quote, setQuote] = useState("");
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [initials, setInitials] = useState("");
  const [style, setStyle] = useState<"dark" | "light">("light");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleNameChange(value: string) {
    setName(value);
    setInitials(computeInitials(value));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!quote.trim() || !name.trim()) return;

    setSaving(true);
    setError(null);

    const { data: maxRow } = await insforge.database
      .from("reviews")
      .select("display_order")
      .order("display_order", { ascending: false })
      .limit(1);

    const maxOrder =
      ((maxRow as { display_order: number }[] | null)?.[0]?.display_order ??
        0) + 1;

    const { error: dbError } = await insforge.database.from("reviews").insert({
      quote: quote.trim(),
      name: name.trim(),
      age: age.trim(),
      initials: initials.trim() || computeInitials(name.trim()),
      style,
      display_order: maxOrder,
      status: "draft",
    });

    if (dbError) {
      setError("Error saving the review. Please try again.");
      setSaving(false);
      return;
    }

    push("/dashboard/reviews");
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      <div className="mb-6">
        <Button
          variant="ghost"
          size="md"
          href="/dashboard/reviews"
          className="gap-2"
        >
          <IconArrowLeft />
          Reviews
        </Button>
      </div>

      <div className="max-w-lg">
        <h1 className="font-display text-petroleum-700 mb-6 text-2xl">
          New Review
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Quote */}
          <label className="flex flex-col gap-1.5">
            <span className="text-petroleum-400 text-xs font-medium">
              Quote <span className="text-red-400">*</span>
            </span>
            <textarea
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              placeholder="What the client said…"
              rows={4}
              required
              className={`${fieldCls} resize-none`}
            />
          </label>

          {/* Name */}
          <label className="flex flex-col gap-1.5">
            <span className="text-petroleum-400 text-xs font-medium">
              Name <span className="text-red-400">*</span>
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Marcus V."
              required
              className={fieldCls}
            />
          </label>

          {/* Age + Initials */}
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-petroleum-400 text-xs font-medium">
                Age label
              </span>
              <input
                type="text"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="e.g. Age 47"
                className={fieldCls}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-petroleum-400 text-xs font-medium">
                Initials
              </span>
              <input
                type="text"
                value={initials}
                onChange={(e) => setInitials(e.target.value.toUpperCase())}
                placeholder="e.g. MV"
                maxLength={3}
                className={fieldCls}
              />
            </label>
          </div>

          {/* Style */}
          <div className="flex flex-col gap-1.5">
            <span className="text-petroleum-400 text-xs font-medium">
              Card style
            </span>
            <div className="flex gap-3">
              {(["light", "dark"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStyle(s)}
                  className={[
                    "flex flex-1 flex-col items-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-medium transition-colors",
                    style === s
                      ? "border-petroleum-700 bg-petroleum-50 text-petroleum-700"
                      : "border-sand-200 text-petroleum-400 hover:border-petroleum-300",
                  ].join(" ")}
                >
                  <div
                    className={`h-6 w-6 rounded-full border ${
                      s === "dark"
                        ? "border-petroleum-700 bg-petroleum-700"
                        : "border-sand-300 bg-sand-50"
                    }`}
                  />
                  <span className="capitalize">{s}</span>
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          {/* Preview */}
          <div className="border-sand-200 rounded-xl border p-4">
            <p className="text-petroleum-300 mb-3 text-xs font-medium">
              Preview
            </p>
            <div
              className={`relative flex flex-col gap-4 rounded-2xl p-5 ${
                style === "dark" ? "bg-petroleum-700" : "bg-sand-50"
              }`}
            >
              <p
                className={`text-sm leading-snug ${
                  style === "dark" ? "text-sand-50" : "text-petroleum-700"
                }`}
              >
                {quote || "Your quote will appear here…"}
              </p>
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                    style === "dark"
                      ? "bg-petroleum-500 text-sand-50"
                      : "bg-petroleum-100 text-petroleum-700"
                  }`}
                >
                  {initials || "??"}
                </div>
                <div>
                  <p
                    className={`text-xs font-medium ${
                      style === "dark" ? "text-sand-50" : "text-petroleum-700"
                    }`}
                  >
                    {name || "Author name"}
                  </p>
                  <p
                    className={`text-xs ${
                      style === "dark"
                        ? "text-sand-50/60"
                        : "text-petroleum-400"
                    }`}
                  >
                    {age || "Age"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <p className="text-petroleum-300 -mt-1 text-xs">
            The review will be saved as a <strong>draft</strong>. Change it to
            Published manually from the list.
          </p>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => push("/dashboard/reviews")}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="solid"
              size="md"
              disabled={saving || !quote.trim() || !name.trim()}
            >
              {saving ? "Saving…" : "Save as Draft"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
