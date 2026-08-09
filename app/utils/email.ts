/**
 * Catching the email typos that cost a booking.
 *
 * A wrong address is silent: the confirmation bounces into nowhere, the client
 * believes the session is booked, and the first anyone knows is when they do
 * not turn up. Most of those are a slip in a handful of domains — gmial,
 * hotmial, outlok — so they can be caught while the person is still looking at
 * the field.
 */

/** Pragmatic shape check: a local part, an @, a dotted domain. */
export function isValidEmail(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || /\s/.test(trimmed)) return false;
  return /^[^@]+@[^@.]+(\.[^@.]+)+$/.test(trimmed);
}

/** The domains that account for nearly every address people type here. */
const COMMON_DOMAINS = [
  "gmail.com",
  "hotmail.com",
  "outlook.com",
  "outlook.es",
  "yahoo.com",
  "yahoo.es",
  "icloud.com",
  "me.com",
  "live.com",
  "msn.com",
  "protonmail.com",
  "proton.me",
  "aol.com",
  "telefonica.net",
  "movistar.es",
  "essentiawellnessclub.com",
];

/** Endings people reach for by mistake, and what they meant. */
const TLD_FIXES: Record<string, string> = {
  con: "com",
  cmo: "com",
  ocm: "com",
  co: "com",
  "com.": "com",
  ess: "es",
  se: "es",
};

function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dist = Array.from({ length: rows }, () =>
    new Array<number>(cols).fill(0),
  );

  for (let i = 0; i < rows; i++) dist[i]![0] = i;
  for (let j = 0; j < cols; j++) dist[0]![j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dist[i]![j] = Math.min(
        dist[i - 1]![j]! + 1,
        dist[i]![j - 1]! + 1,
        dist[i - 1]![j - 1]! + cost,
      );
    }
  }
  return dist[rows - 1]![cols - 1]!;
}

/**
 * A corrected address when the domain looks like a near-miss, otherwise null.
 *
 * Deliberately conservative: one edit away from a known domain, or a wrong
 * ending on an otherwise sound domain. Suggesting anything looser turns into
 * noise, and noise trains people to dismiss the hint.
 */
export function suggestEmailFix(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at < 1 || at === trimmed.length - 1) return null;

  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (!domain.includes(".")) return null;
  if (COMMON_DOMAINS.includes(domain)) return null;

  // A recognisable domain with a mistyped ending: gmail.con → gmail.com
  const lastDot = domain.lastIndexOf(".");
  const stem = domain.slice(0, lastDot);
  const tld = domain.slice(lastDot + 1);
  const fixedTld = TLD_FIXES[tld];
  if (fixedTld && COMMON_DOMAINS.includes(`${stem}.${fixedTld}`)) {
    return `${local}@${stem}.${fixedTld}`;
  }

  // A near-miss on the domain itself: gmial.com → gmail.com
  for (const candidate of COMMON_DOMAINS) {
    if (Math.abs(candidate.length - domain.length) > 2) continue;
    if (editDistance(domain, candidate) <= (domain.length > 8 ? 2 : 1)) {
      return `${local}@${candidate}`;
    }
  }

  return null;
}
