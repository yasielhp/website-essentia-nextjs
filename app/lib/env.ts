/**
 * Centralised, validated access to environment variables.
 *
 * Every module used to read `process.env.X!` inline, which silently produced
 * `undefined` at runtime when a variable was missing. These helpers fail loudly
 * instead, and give a single place to see what the app depends on.
 *
 * Only `serverEnv` values are server-only — never import it from a Client
 * Component. `publicEnv` values are inlined into the browser bundle by Next.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. See env.example.`,
    );
  }
  return value;
}

export const publicEnv = {
  get insforgeUrl(): string {
    return required(
      "NEXT_PUBLIC_INSFORGE_URL",
      process.env.NEXT_PUBLIC_INSFORGE_URL,
    );
  },
  get insforgeAnonKey(): string {
    return required(
      "NEXT_PUBLIC_INSFORGE_ANON_KEY",
      process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY,
    );
  },
};

export const serverEnv = {
  get insforgeServiceKey(): string {
    return required("INSFORGE_SERVICE_KEY", process.env.INSFORGE_SERVICE_KEY);
  },
};

/**
 * Public origin of the app, used for absolute URLs in emails, webhooks,
 * OAuth redirects and payment return URLs.
 *
 * Previously duplicated as a local `getAppUrl()` in four different files.
 */
export function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
