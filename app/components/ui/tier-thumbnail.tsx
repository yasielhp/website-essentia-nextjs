import Image from "next/image";

/**
 * The square in front of a session type.
 *
 * Uses the tier's own image when it has one, and otherwise its colour — every
 * tier has a colour configured, so the row never renders without a marker, and
 * a service whose types are plain durations still reads as a list rather than
 * a wall of text.
 */
export function TierThumbnail({
  imageUrl,
  color,
  label,
  className = "size-10",
  sizes = "40px",
}: {
  imageUrl?: string | null;
  color?: string | null;
  label?: string | null;
  className?: string;
  sizes?: string;
}) {
  if (imageUrl) {
    return (
      <div
        className={`relative ${className} shrink-0 overflow-hidden rounded-lg`}
      >
        <Image
          src={imageUrl}
          alt={label ?? ""}
          fill
          sizes={sizes}
          // The dropdown mounts on open, so lazy loading starts fetching at the
          // moment the list is already on screen and the thumbnails fade in
          // late. At 40px there is nothing to defer.
          loading="eager"
          className="object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={`${className} shrink-0 rounded-lg`}
      // An arbitrary hex per tier cannot come from a Tailwind class.
      style={{ backgroundColor: color ?? "#c2baa5" }}
      aria-hidden
    />
  );
}
