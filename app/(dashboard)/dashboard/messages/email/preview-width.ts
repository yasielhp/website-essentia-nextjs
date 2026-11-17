/**
 * The width of the email preview: a phone's 375 px in "mobile", the whole space in
 * "desktop". Never wider than its container, so on a phone narrower than 375 px
 * (or a column narrower than that) the "mobile" view shrinks to fit instead of
 * being cut off.
 */
export function previewWidth(mode: "mobile" | "desktop"): {
  width: number | string;
  maxWidth: string;
} {
  return { width: mode === "mobile" ? 375 : "100%", maxWidth: "100%" };
}
