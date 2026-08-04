import { RedsysProvider } from "./redsys";

export type { PaymentProvider, PaymentConfig, ProviderName } from "./types";
export type {
  CreateCheckoutParams,
  CheckoutSession,
  CreateRefundParams,
  Refund,
  WebhookEvent,
  RedsysConfig,
} from "./types";

/**
 * Builds the Redsys provider from environment variables.
 *
 * Replaces four identical `buildRedsysProvider()` copies across the checkout
 * routes, the webhook and the payment-status action. `REDSYS_TERMINAL` defaults
 * to `"001"`, which is what those copies already assumed.
 */
export function getRedsysProvider(): RedsysProvider | null {
  const merchantCode = process.env.REDSYS_MERCHANT_CODE;
  const secretKey = process.env.REDSYS_SECRET_KEY;
  if (!merchantCode || !secretKey) return null;

  return new RedsysProvider({
    merchantCode,
    terminal: process.env.REDSYS_TERMINAL ?? "001",
    secretKey,
    environment: (process.env.REDSYS_ENVIRONMENT as "test" | "live") ?? "test",
  });
}
