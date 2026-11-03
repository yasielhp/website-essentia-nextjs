/**
 * A `returnTo` that came from a URL, made safe to navigate to.
 *
 * Screens that can be reached from more than one place take a `?returnTo=` so
 * they can send the person back where they came from. A value from a URL is
 * anyone's, so only a path inside the dashboard is accepted: it must start with
 * `/dashboard/` (or be `/dashboard`), carry no scheme, no host, no protocol-
 * relative `//`, no backslash and no control characters. Anything else is null
 * and the caller uses its own default — never an open redirect.
 */
export function safeDashboardPath(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  if (value.length > 300) return null;
  // Control characters, and the backslash some browsers read as a slash.
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return null;
  if (value !== "/dashboard" && !value.startsWith("/dashboard/")) return null;
  if (value.includes("//")) return null;

  try {
    // Resolved against a throwaway origin: if it escapes it, it is not ours.
    const resolved = new URL(value, "https://dashboard.invalid");
    if (resolved.origin !== "https://dashboard.invalid") return null;
    if (
      resolved.pathname !== "/dashboard" &&
      !resolved.pathname.startsWith("/dashboard/")
    ) {
      return null;
    }
  } catch {
    return null;
  }
  return value;
}
